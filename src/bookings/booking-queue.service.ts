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

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly ticketsService: TicketsService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * 1. เพิ่มข้อมูลเข้าคิว (O(1))
   */
  async enqueue(userId: string, dto: CreateBookingDto) {
    const trackingId = `${userId}-${Date.now()}`;

    // ใช้ Global Counter เพื่อให้เลขลำดับไม่เพี้ยนเวลา Trim Array
    this.globalCounter++;
    const position = this.globalCounter;

    // บันทึกลง MongoDB
    await this.queueService.create(userId, dto.eventId);

    // ล็อคที่นั่งทันทีเพื่อกันคนอื่นแย่ง
    if (dto.seatNumbers && dto.seatNumbers.length > 0) {
      await this.ticketsService.reserveTickets(
        dto.seatNumbers,
        userId,
        dto.eventId,
      );
    }

    this.bookingStatus.set(trackingId, {
      status: 'processing',
      initialPosition: position,
    });

    this.queue.push({ trackingId, userId, dto });

    // สั่งเริ่ม Worker
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
    if (this.isProcessing || this.headIndex >= this.queue.length) return;
    this.isProcessing = true;

    // ปรับจำนวนการประมวลผลพร้อมกันตามความเหมาะสม
    const CONCURRENCY = 100;

    while (this.headIndex < this.queue.length) {
      // ดึงงานออกมาเป็น Batch โดยไม่ใช้ .shift()
      const batch = this.queue.slice(
        this.headIndex,
        this.headIndex + CONCURRENCY,
      );
      this.headIndex += batch.length;

      await Promise.all(
        batch.map((item) =>
          this.handleTask(item).finally(() => {
            this.totalProcessed++; // อัปเดตตัวนับเพื่อคำนวณตำแหน่งสดๆ
          }),
        ),
      );

      // คืนหายใจให้ Event Loop (Unblock)
      await new Promise((resolve) => setImmediate(resolve));

      // ทำความสะอาด Memory เมื่อ Array เริ่มใหญ่เกินไป
      if (this.headIndex > 5000) {
        this.queue = this.queue.slice(this.headIndex);
        this.headIndex = 0;
      }
    }

    this.isProcessing = false;
  }

  /**
   * 3. จัดการแต่ละรายการ (Business Logic)
   */
  private async handleTask(item: QueueItem) {
    const { trackingId, userId, dto } = item;
    try {
      const userQueue = await this.queueService.findAndActivateQueue(
        userId,
        dto.eventId,
      );
      if (!userQueue) {
        throw new Error(
          'ไม่พบคิวที่พร้อมใช้งาน (คิวอาจหมดอายุหรือสถานะไม่ถูกต้อง)',
        );
      }

      const result: Booking = await this.bookingsService.create(userId, dto);

      await this.queueService.updateStatus(
        userQueue._id.toString(),
        'completed',
      );

      this.finishTask(trackingId, { status: 'success', data: result });
    } catch (error: any) {
      this.logger.error(`Booking failed for ${trackingId}: ${error.message}`);

      // Rollback ตั๋วเมื่อเกิดข้อผิดพลาด
      if (dto.seatNumbers && dto.seatNumbers.length > 0) {
        await this.ticketsService.reserveTickets(
          dto.seatNumbers,
          null,
          dto.eventId,
        );
      }
      this.finishTask(trackingId, { status: 'failed', error: error.message });
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
