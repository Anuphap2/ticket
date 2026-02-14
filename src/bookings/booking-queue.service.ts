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
  // ใช้ Map เพื่อเก็บสถานะการจองตาม ID (ใน RAM)
  private bookingStatus = new Map<
    string,
    { status: string; data?: any; error?: string }
  >();

  constructor(private readonly bookingsService: BookingsService) {}

  // 1. เพิ่มเข้าคิวแล้วตอบกลับทันที
  async enqueue(userId: string, dto: any) {
    const trackingId = `${userId}-${Date.now()}`; // สร้าง ID ชั่วคราวไว้เช็คสถานะ
    this.bookingStatus.set(trackingId, { status: 'processing' });

    this.queue.push({ trackingId, userId, dto });
    this.processQueue(); // รันเบื้องหลัง (Background Process)

    return {
      trackingId,
      status: 'processing',
      message: 'เราได้รับคำขอของคุณแล้ว กรุณารอสักครู่',
    };
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { trackingId, userId, dto } = this.queue.shift();
      try {
        const result = await this.bookingsService.create(userId, dto);
        this.bookingStatus.set(trackingId, { status: 'success', data: result });
      } catch (error) {
        this.bookingStatus.set(trackingId, {
          status: 'failed',
          error: error.message,
        });
      }
    }
    this.isProcessing = false;
  }

  // 2. ฟังก์ชันให้หน้าบ้านมาถามว่า "จองได้หรือยัง?"
  getStatus(trackingId: string) {
    return this.bookingStatus.get(trackingId) || { status: 'not_found' };
  }
}
