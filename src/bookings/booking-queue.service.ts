/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { TicketsService } from '../tickets/tickets.service';
import { QueueService } from '../queue/queue.service';

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

  private readonly CLEANUP_TIMEOUT = 10 * 60 * 1000; // 10 นาที

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly ticketsService: TicketsService,
    private readonly queueService: QueueService, // 🎯 ใช้ Service ที่มี MongoDB
  ) {}

  /**
   * 1. เพิ่มข้อมูลเข้าคิว
   */
  async enqueue(userId: string, dto: CreateBookingDto) {
    const trackingId = `${userId}-${Date.now()}`;
    const position = this.queue.length + 1;

    // 🎯 บันทึกลง MongoDB Queue Collection ก่อน (เพื่อให้มีข้อมูลใน DB ตามเกณฑ์ CRUD)
    await this.queueService.create(userId, dto.eventId);

    // ล็อคที่นั่งทันที (เหมือนเดิมของพู่กัน)
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
    this.processQueue().catch((err) =>
      this.logger.error('Queue processing error', err),
    );

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
      // 🎯 ดึงคิวจาก DB และอัปเดตเป็น 'active' เพื่อให้ BookingsService ยอมให้จอง
      const userQueue = await this.queueService.findOneByUser(
        userId,
        dto.eventId,
      );
      if (userQueue) {
        // สมมติพู่กันมี method updateStatus ใน QueueService นะครับ
        await (this.queueService as any).updateStatus(userQueue._id, 'active');
      }

      const result = await this.bookingsService.create(userId, dto);

      // 🎯 จองสำเร็จ อัปเดต DB เป็น completed
      if (userQueue) {
        await (this.queueService as any).updateStatus(
          userQueue._id,
          'completed',
        );
      }

      this.finishTask(trackingId, { status: 'success', data: result });
    } catch (error: any) {
      this.logger.error(`Booking failed for ${trackingId}: ${error.message}`);

      // Rollback ตั๋ว
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

  /**
   * 4. สรุปผล
   */
  private finishTask(trackingId: string, finalStatus: BookingStatus) {
    this.bookingStatus.set(trackingId, finalStatus);
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

    if (currentStatus.status === 'success') {
      return {
        status: 'confirmed',
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
        message: 'การจองไม่สำเร็จ: ' + currentStatus.error,
      };
    }

    return currentStatus;
  }

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
