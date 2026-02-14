import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingQueueService } from './booking-queue.service';
import { BookingsService } from './bookings.service';

describe('BookingsController', () => {
  let controller: BookingsController;
  let queueService: BookingQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingQueueService,
          useValue: { enqueue: jest.fn(), getStatus: jest.fn() },
        },
        {
          provide: BookingsService, // ใช้ชื่อ Class เลยครับ ไม่ต้องมีเครื่องหมายคำพูด
          useValue: { create: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    queueService = module.get<BookingQueueService>(BookingQueueService);
  });

  it('POST /bookings ควรเรียกใช้ enqueue ของ QueueService', async () => {
    const req = { user: { sub: 'user123' } };
    const dto = { eventId: 'e1', zoneName: 'A', quantity: 1 };

    await controller.create(req, dto);
    expect(queueService.enqueue).toHaveBeenCalledWith('user123', dto);
  });
});