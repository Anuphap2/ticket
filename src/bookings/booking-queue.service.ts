import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { TicketsService } from '../tickets/tickets.service';

// สร้าง Interface เพื่อให้อ่านง่ายและมี Type Safety
interface QueueItem {
  trackingId: string;
  userId: string;
  dto: CreateBookingDto;
}

export interface BookingStatus {
  status: 'processing' | 'success' | 'failed' | 'not_found';
  data?: any;
  error?: string;
  initialPosition?: number;
  remainingQueue?: number;
  message?: string;
}

@Injectable()
export class BookingQueueService {
  private readonly logger = new Logger(BookingQueueService.name);
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private bookingStatus = new Map<string, BookingStatus>();

  private readonly CLEANUP_TIMEOUT = 10 * 60 * 1000; // 10 นาที

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly ticketsService: TicketsService,
  ) { }

  /**
   * 1. เพิ่มข้อมูลเข้าคิว
   */
  async enqueue(userId: string, dto: CreateBookingDto) {
    const trackingId = `${userId}-${Date.now()}`;
    const position = this.queue.length + 1;

    // 🎯 2. ล็อคที่นั่งทันทีที่กดจอง (ก่อนเข้าคิว)
    // เพื่อให้ที่นั่งเปลี่ยนสถานะเป็น 'reserved' ใน DB ทันที คนอื่นจะได้ไม่เห็นที่ว่าง
    if (dto.seatNumbers && dto.seatNumbers.length > 0) {
      await this.ticketsService.reserveTickets(dto.seatNumbers, userId, dto.eventId);  
    }

    this.bookingStatus.set(trackingId, {
      status: 'processing',
      initialPosition: position,
    });

    this.queue.push({ trackingId, userId, dto });
    this.processQueue().catch((err) => this.logger.error('Queue processing error', err));

    return { trackingId, status: 'processing', queuePosition: position };
  }

  /**
   * 2. กระบวนการประมวลผลคิว (Worker)
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      await this.handleTask(item);
    }

    this.isProcessing = false;
  }

  /**
   * 3. จัดการแต่ละรายการในคิว
   */
  private async handleTask(item: QueueItem) {
    const { trackingId, userId, dto } = item;
    try {
      const result = await this.bookingsService.create(userId, dto);
      this.finishTask(trackingId, { status: 'success', data: result });
    } catch (error: any) {
      // 🎯 3. ถ้าคิวล้มเหลว (เช่น Error ระหว่างบันทึก) ต้องคืนที่นั่ง (Rollback)
      if (dto.seatNumbers && dto.seatNumbers.length > 0) {
        this.logger.warn(`Rollback tickets for trackingId: ${trackingId}`);
        // ส่ง userId เป็น null เพื่อเปลี่ยนสถานะกลับเป็น 'available'
        await this.ticketsService.reserveTickets(dto.seatNumbers, null , dto.eventId);
      }

      this.finishTask(trackingId, { status: 'failed', error: error.message });
    }
  }

  /**
   * 4. สรุปผลและตั้งเวลาล้างข้อมูล
   */
  private finishTask(trackingId: string, finalStatus: BookingStatus) {
    this.bookingStatus.set(trackingId, finalStatus);

    // ลบข้อมูลทิ้งอัตโนมัติเมื่อถึงเวลา
    setTimeout(
      () => this.bookingStatus.delete(trackingId),
      this.CLEANUP_TIMEOUT,
    );
  }

  /**
   * 5. เช็คสถานะปัจจุบัน
   */
  getStatus(trackingId: string): BookingStatus {
    const currentStatus = this.bookingStatus.get(trackingId);

    if (!currentStatus) {
      return { status: 'not_found', message: 'ไม่พบข้อมูลหรือเซสชันหมดอายุ' };
    }

    // 🎯 ถ้าจองสำเร็จ (success) ให้เปลี่ยนคำเป็น 'confirmed' และแนบ bookingId ไปให้หน้าบ้าน
    if (currentStatus.status === 'success') {
      return {
        status: 'confirmed', // 🎯 หน้าบ้านรอคำนี้
        bookingId: currentStatus.data?._id || currentStatus.data?.id,
        message: 'จองที่นั่งสำเร็จ!',
        ...currentStatus.data,
      };
    }

    if (currentStatus.status === 'processing') {
      return this.calculateLivePosition(trackingId, currentStatus);
    }

    if (currentStatus.status === 'failed') {
      return {
        ...currentStatus,
        message: 'การจองไม่สําเร็จ: ' + currentStatus.error,
      };
    }

    return currentStatus;
  }
  /**
   * Helper: คำนวณตำแหน่งล่าสุดในคิว
   */
  private calculateLivePosition(
    trackingId: string,
    status: BookingStatus,
  ): BookingStatus {
    const index = this.queue.findIndex(
      (item) => item.trackingId === trackingId,
    );
    const isWorking = index === -1;

    return {
      ...status,
      remainingQueue: isWorking ? 0 : index + 1,
      message: isWorking
        ? 'กำลังบันทึกข้อมูลการจองของคุณ...'
        : `รออีก ${index + 1} คิวจะถึงตาคุณ`,
    };
  }
}
