/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingQueueService {
  private queue: any[] = [];
  private isProcessing = false;

  // ใช้ Map เก็บสถานะ และเพิ่มช่องเก็บลำดับคิวเริ่มต้น
  private bookingStatus = new Map<
    string,
    { status: string; data?: any; error?: string; initialPosition?: number }
  >();

  // ตั้งเวลาลบข้อมูลออกจาก RAM (มิลลิวินาที) เช่น 10 นาที
  private readonly CLEANUP_TIMEOUT = 10 * 60 * 1000;

  constructor(private readonly bookingsService: BookingsService) {}

  // 1. เพิ่มเข้าคิวแล้วตอบกลับลำดับคิวทันที
  async enqueue(userId: string, dto: any) {
    const trackingId = `${userId}-${Date.now()}`;
    const currentQueuePosition = this.queue.length + 1; // ลำดับที่ต่อท้ายคิว

    this.bookingStatus.set(trackingId, {
      status: 'processing',
      initialPosition: currentQueuePosition,
    });

    this.queue.push({ trackingId, userId, dto });
    this.processQueue();

    return {
      trackingId,
      status: 'processing',
      queuePosition: currentQueuePosition, // ส่งลำดับให้หน้าบ้านโชว์
      message: `คุณอยู่ในคิวที่ ${currentQueuePosition} กรุณารอสักครู่`,
    };
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { trackingId, userId, dto } = this.queue.shift();
      try {
        const result = await this.bookingsService.create(userId, dto);
        this.updateStatusAndScheduleCleanup(trackingId, {
          status: 'success',
          data: result,
        });
      } catch (error) {
        this.updateStatusAndScheduleCleanup(trackingId, {
          status: 'failed',
          error: error.message,
        });
      }
    }
    this.isProcessing = false;
  }

  // ฟังก์ชันช่วยอัปเดตสถานะและตั้งเวลาลบข้อมูลทิ้ง (Prevent Memory Leak)
  private updateStatusAndScheduleCleanup(trackingId: string, finalStatus: any) {
    this.bookingStatus.set(trackingId, finalStatus);

    // ลบข้อมูลออกจาก Map หลังจากเวลาที่กำหนด
    setTimeout(() => {
      this.bookingStatus.delete(trackingId);
    }, this.CLEANUP_TIMEOUT);
  }

  // 2. ฟังก์ชันเช็คสถานะแบบโชว์คิวที่เหลือ
  getStatus(trackingId: string) {
    const statusEntry = this.bookingStatus.get(trackingId);

    if (!statusEntry) {
      return {
        status: 'not_found',
        message: 'ไม่พบข้อมูลการจองหรือเซสชันหมดอายุ',
      };
    }

    if (statusEntry.status === 'processing') {
      const indexInQueue = this.queue.findIndex(
        (item) => item.trackingId === trackingId,
      );

      // ถ้า indexInQueue เป็น -1 แปลว่าถูก shift() ออกจาก queue ไปเข้ากระบวนการบันทึก DB แล้ว
      const isBeingProcessed = indexInQueue === -1;

      return {
        ...statusEntry,
        remainingQueue: isBeingProcessed ? 0 : indexInQueue + 1,
        message: isBeingProcessed
          ? 'กำลังบันทึกข้อมูลการจองของคุณ...'
          : `รออีก ${indexInQueue + 1} คิวจะถึงตาคุณ`,
      };
    }

    return statusEntry;
  }
}
