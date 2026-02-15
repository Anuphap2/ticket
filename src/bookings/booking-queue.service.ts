import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

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

  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * 1. เพิ่มข้อมูลเข้าคิว
   */
  async enqueue(userId: string, dto: CreateBookingDto) {
    const trackingId = `${userId}-${Date.now()}`;
    const position = this.queue.length + 1;

    // บันทึกสถานะเริ่มต้น
    this.bookingStatus.set(trackingId, {
      status: 'processing',
      initialPosition: position,
    });

    this.queue.push({ trackingId, userId, dto });

    // รันกระบวนการเบื้องหลัง (ไม่รอ await เพื่อให้ตอบกลับ User ทันที)
    this.processQueue().catch((err) =>
      this.logger.error('Queue processing error', err),
    );

    return {
      trackingId,
      status: 'processing',
      queuePosition: position,
      message: `คุณอยู่ในคิวที่ ${position} กรุณารอสักครู่`,
    };
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
  private async handleTask({ trackingId, userId, dto }: QueueItem) {
    try {
      const result = await this.bookingsService.create(userId, dto);
      this.finishTask(trackingId, { status: 'success', data: result });
    } catch (error: any) {
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

    if (currentStatus.status === 'processing') {
      return this.calculateLivePosition(trackingId, currentStatus);
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
