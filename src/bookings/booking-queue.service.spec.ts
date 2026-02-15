import { Test, TestingModule } from '@nestjs/testing';
import { BookingQueueService } from './booking-queue.service';
import { BookingsService } from './bookings.service';

describe('BookingQueueService', () => {
  let service: BookingQueueService;
  let bookingsService: BookingsService;

  beforeEach(async () => {
    // 1. เปิดใช้งาน Fake Timers ก่อนเริ่มเทสแต่ละเคส
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingQueueService,
        {
          provide: BookingsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'real_booking_id' }),
          },
        },
      ],
    }).compile();

    service = module.get<BookingQueueService>(BookingQueueService);
    bookingsService = module.get<BookingsService>(BookingsService);
  });

  // 2. ล้าง Timer ทั้งหมดหลังจากจบแต่ละเทส
  afterEach(() => {
    jest.runOnlyPendingTimers(); // รันคิวที่ค้างอยู่ให้จบ
    jest.useRealTimers(); // กลับไปใช้เวลาจริง
  });

  it('เมื่อเข้าคิว (enqueue) ต้องได้ trackingId และสถานะเป็นสำเร็จหรือกำลังทำ', async () => {
    const result = await service.enqueue('user1', {
      eventId: 'e1',
      zoneName: 'A',
      quantity: 1,
    });

    expect(result).toHaveProperty('trackingId');

    const status = service.getStatus(result.trackingId);
    expect(['processing', 'success']).toContain(status.status);
  });

  it('ควรคืนค่า not_found หาก trackingId ไม่มีในระบบ', () => {
    const status = service.getStatus('invalid_id');
    expect(status.status).toBe('not_found');
  });

  // 3. (Optional) เพิ่มเทสเพื่อเช็คว่า Cleanup ทำงานจริงไหมโดยไม่ต้องรอนาน
  it('ควรลบข้อมูลออกจาก Map หลังจากเวลาที่กำหนด (Cleanup)', async () => {
    const result = await service.enqueue('user1', {
      eventId: 'e1',
      zoneName: 'A',
      quantity: 1,
    });

    // เร่งเวลาไป 11 นาที (เกิน 10 นาทีที่ตั้งไว้)
    jest.advanceTimersByTime(11 * 60 * 1000);

    const status = service.getStatus(result.trackingId);
    expect(status.status).toBe('not_found');
  });
});
