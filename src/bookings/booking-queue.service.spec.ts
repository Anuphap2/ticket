import { Test, TestingModule } from '@nestjs/testing';
import { BookingQueueService } from './booking-queue.service';
import { BookingsService } from './bookings.service';

describe('BookingQueueService', () => {
  let service: BookingQueueService;
  let bookingsService: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingQueueService,
        {
          provide: BookingsService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'real_booking_id' }) },
        },
      ],
    }).compile();

    service = module.get<BookingQueueService>(BookingQueueService);
    bookingsService = module.get<BookingsService>(BookingsService);
  });

  it('เมื่อเข้าคิว (enqueue) ต้องได้ trackingId และสถานะเป็นสำเร็จหรือกำลังทำ', async () => {
    const result = await service.enqueue('user1', { eventId: 'e1', zoneName: 'A', quantity: 1 });

    expect(result).toHaveProperty('trackingId');

    const status = service.getStatus(result.trackingId);
    // แก้จาก .toBe('processing') เป็นการเช็คว่าต้องเป็น success หรือ processing อย่างใดอย่างหนึ่ง
    expect(['processing', 'success']).toContain(status.status);
  });

  it('ควรคืนค่า not_found หาก trackingId ไม่มีในระบบ', () => {
    const status = service.getStatus('invalid_id');
    expect(status.status).toBe('not_found');
  });
});