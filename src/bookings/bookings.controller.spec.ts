/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */

// 🎯 1. ดัก Path 'src/...' ด้วย Virtual Mock เหมือนเดิม
jest.mock('src/tickets/tickets.service', () => {
  return require('../tickets/tickets.service');
}, { virtual: true });

jest.mock('src/queue/queue.service', () => {
  return require('../queue/queue.service');
}, { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingQueueService } from './booking-queue.service';
import { BookingsService } from './bookings.service';
// 🎯 2. ต้อง Import ตัวนี้เข้ามาด้วยเพื่อใช้ใน providers (จุดที่พังตะกี้)
import { TicketsService } from '../tickets/tickets.service';

describe('BookingsController', () => {
  let controller: BookingsController;
  let queueService: BookingQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingQueueService,
          useValue: { 
            enqueue: jest.fn().mockResolvedValue({ status: 'processing', trackingId: 'tr-123' }), 
            getStatus: jest.fn() 
          },
        },
        {
          provide: BookingsService,
          useValue: { create: jest.fn() },
        },
        {
          // 🎯 3. ใส่ตัวนี้เพื่อให้ Controller ที่เรียกใช้ TicketsService ใน Constructor ทำงานได้
          provide: TicketsService,
          useValue: { reserveTickets: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    queueService = module.get<BookingQueueService>(BookingQueueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('POST /bookings ควรเรียกใช้ enqueue ของ QueueService', async () => {
      const req = { user: { sub: 'user123' } } as any;
      const dto = { eventId: '507f1f77bcf86cd799439011', zoneName: 'A', quantity: 1 } as any;

      const result = await controller.create(req, dto);

      expect(queueService.enqueue).toHaveBeenCalledWith('user123', dto);
      expect(result).toEqual({ status: 'processing', trackingId: 'tr-123' });
    });
  });

  describe('getStatus', () => {
    it('GET /status/:id ควรเรียกใช้ getStatus ของ QueueService', async () => {
      const trackingId = 'tr-123';
      const mockStatus = { status: 'confirmed', bookingId: 'b-123' };
      (queueService.getStatus as jest.Mock).mockReturnValue(mockStatus);

      const result = await controller.getStatus(trackingId);

      expect(queueService.getStatus).toHaveBeenCalledWith(trackingId);
      expect(result).toEqual(mockStatus);
    });
  });
});