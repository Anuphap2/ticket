import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { TicketsService } from '../tickets/tickets.service';
import { QueueService } from '../queue/queue.service';
import { Booking } from './schema/booking.shema';

interface QueueItem {
  trackingId: string;
  userId: string;
  dto: CreateBookingDto;
}

export interface BookingStatus {
  status: 'processing' | 'success' | 'failed' | 'not_found' | 'confirmed';
  data?: any;
  error?: string;
  initialPosition?: number;
  remainingQueue?: number;
  message?: string;
  bookingId?: string;
}

@Injectable()
export class BookingQueueService {
  private readonly logger = new Logger(BookingQueueService.name);
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private bookingStatus = new Map<string, BookingStatus>();

  // 🎯 ตัวแปรสำหรับ O(1) Optimization
  private headIndex = 0; // ชี้ตำแหน่งหัวคิวปัจจุบัน
  private totalProcessed = 0; // นับจำนวนที่ประมวลผลเสร็จแล้วทั้งหมด (สำเร็จ/ล้มเหลว)
  private globalCounter = 0; // นับลำดับคิวสะสม

  private readonly CLEANUP_TIMEOUT = 10 * 60 * 1000; // 10 นาที
  private readonly CONCURRENCY = 50; // จํานวน Worker ที่ทำงานพร้อมกัน

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly ticketsService: TicketsService,
    private readonly queueService: QueueService,
  ) {}

  private async worker() {
    // Worker แต่ละตัวจะแย่งกันหยิบงานจาก Index ปัจจุบัน
    while (this.headIndex < this.queue.length) {
      const item = this.queue[this.headIndex++]; // หยิบงานและเลื่อน Index ทันที

      if (!item) continue;

      try {
        await this.handleTask(item);
      } catch (err) {
        this.logger.error('Worker error', err);
      } finally {
        this.totalProcessed++;

        // คืน Breath ให้ Event Loop เป็นระยะๆ เพื่อให้รับ Request ใหม่ได้ลื่น
        if (this.totalProcessed % 20 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Memory Management: Trim คิวเมื่อสะสมเยอะเกินไป
      if (this.headIndex > 0 && this.headIndex >= this.queue.length / 2) {
        this.queue = this.queue.slice(this.headIndex);
        this.headIndex = 0;
      }
    }
  }
  /**
   * 1. เพิ่มข้อมูลเข้าคิว (O(1))
   */
  async enqueue(userId: string, dto: CreateBookingDto) {
    const trackingId = `${userId}-${Date.now()}-${Math.random()}`;

    this.globalCounter++;
    const position = this.globalCounter;

    this.bookingStatus.set(trackingId, {
      status: 'processing',
      initialPosition: position,
    });

    // ✅ push เข้า queue อย่างเดียว
    this.queue.push({ trackingId, userId, dto });

    if (!this.isProcessing) {
      this.processQueue().catch((err) =>
        this.logger.error('Queue processing error', err),
      );
    }

    return { trackingId, status: 'processing', queuePosition: position };
  }

  /**
   * 2. กระบวนการประมวลผลคิวแบบ Batch (O(1) Access)
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // สร้าง Worker ตามจำนวนที่กำหนด ให้ทำงานพร้อมกัน
    const workers = Array(this.CONCURRENCY)
      .fill(null)
      .map(() => this.worker());

    // รอจนกว่าทุก Worker จะทำงานเสร็จ (เมื่อคิวว่าง)
    await Promise.all(workers);

    this.isProcessing = false;
  }

  /**
   * 3. จัดการแต่ละรายการ (Business Logic)
   */
  private async handleTask(item: QueueItem) {
    const { trackingId, userId, dto } = item;

    try {
      // ✅ 1. สร้าง Queue Record ใน DB
      const queueRecord = await this.queueService.create(
        userId,
        dto.eventId,
      );

      // ✅ 2. Reserve seat (ถ้ามี)
      if (dto.seatNumbers?.length) {
        await this.ticketsService.reserveTickets(
          dto.seatNumbers,
          userId,
          dto.eventId,
        );
      }

      // ✅ 3. Activate queue
      const userQueue = await this.queueService.findAndActivateQueue(
        userId,
        dto.eventId,
      );

      if (!userQueue) {
        throw new Error('ไม่พบคิวที่พร้อมใช้งาน');
      }

      // ✅ 4. สร้าง Booking
      const result: Booking = await this.bookingsService.create(userId, dto);

      // ✅ 5. Update queue status
      await this.queueService.updateStatus(
        userQueue._id.toString(),
        'completed',
      );

      this.finishTask(trackingId, { status: 'success', data: result });
    } catch (error: any) {
      this.logger.error(`Booking failed for ${trackingId}: ${error.message}`);

      // Rollback seat
      if (dto.seatNumbers?.length) {
        await this.ticketsService.reserveTickets(
          dto.seatNumbers,
          null,
          dto.eventId,
        );
      }

      this.finishTask(trackingId, {
        status: 'failed',
        error: error.message,
      });
    }
  }

  private finishTask(trackingId: string, finalStatus: BookingStatus) {
    this.bookingStatus.set(trackingId, finalStatus);
    setTimeout(
      () => this.bookingStatus.delete(trackingId),
      this.CLEANUP_TIMEOUT,
    );
  }

  /**
   * 4. เช็คสถานะปัจจุบัน (O(1) Response)
   */
  getStatus(trackingId: string): BookingStatus {
    const currentStatus = this.bookingStatus.get(trackingId);

    if (!currentStatus) {
      return { status: 'not_found', message: 'ไม่พบข้อมูลหรือเซสชันหมดอายุ' };
    }

    if (currentStatus.status === 'success') {
      return {
        status: 'confirmed',
        bookingId: currentStatus.data?._id || currentStatus.data?.id,
        message: 'จองที่นั่งสำเร็จ!',
        ...currentStatus.data,
      };
    }

    if (currentStatus.status === 'processing') {
      const initialPos = currentStatus.initialPosition ?? 0;
      const remaining = initialPos - this.totalProcessed;
      const isWorking = remaining <= 0;

      return {
        ...currentStatus,
        remainingQueue: isWorking ? 0 : remaining,
        message: isWorking
          ? 'กำลังบันทึกข้อมูลการจองของคุณ...'
          : `รออีก ${remaining} คิวจะถึงตาคุณ`,
      };
    }

    return currentStatus;
  }
}
