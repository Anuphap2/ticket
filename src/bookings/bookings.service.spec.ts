/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

// 🎯 แก้ปัญหา Path src/
jest.mock('src/tickets/tickets.service', () => require('../tickets/tickets.service'), { virtual: true });
jest.mock('src/queue/queue.service', () => require('../queue/queue.service'), { virtual: true });

jest.mock('../tickets/tickets.service');
jest.mock('../queue/queue.service');

import { BookingsService } from './bookings.service';
import { Booking } from './schema/booking.shema';
import { Event } from '../events/schema/event.schema';
import { TicketsService } from '../tickets/tickets.service';
import { QueueService } from '../queue/queue.service';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockEventId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();
  const mockZoneId = new Types.ObjectId().toString();

  // 🎯 สร้าง Mock ของ Event ให้คงที่
  const mockEventData = {
    _id: mockEventId,
    title: 'Mock Event',
    zones: [{ 
      _id: mockZoneId, 
      name: 'Zone A', 
      type: 'standing', 
      price: 1000, 
      availableSeats: 10 
    }]
  };

  const mockBookingModel = jest.fn().mockImplementation((dto) => ({
    ...dto,
    save: jest.fn().mockResolvedValue({ ...dto, _id: 'booking_123' }),
  }));

  // 🎯 ปรับโครงสร้าง Mock Model ให้เรียกใช้ได้หลายรอบไม่พัง
  const mockEventModel = {
    findById: jest.fn().mockReturnThis(), // ให้ findById คืนค่าตัวเอง
    updateOne: jest.fn().mockReturnThis(),
    exec: jest.fn(), // เดี๋ยวจะไประบุค่าในแต่ละ Test Case
  };

  const mockTicketsService = {
    findSpecificTickets: jest.fn(),
    findAvailableTickets: jest.fn(),
    reserveTickets: jest.fn(),
    cancelReserve: jest.fn(),
  };

  const mockQueueService = {
    findOneByUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
        { provide: getModelToken(Event.name), useValue: mockEventModel },
        { provide: TicketsService, useValue: mockTicketsService },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('ควรโยน Error ถ้ายังไม่ถึงคิว (status ไม่ใช่ active)', async () => {
      // Mock ให้หา Event เจอเสมอเพื่อผ่านด่าน validate
      mockEventModel.exec.mockResolvedValue(mockEventData);
      // Mock คิวให้เป็น waiting
      mockQueueService.findOneByUser.mockResolvedValue({ status: 'waiting' });

      const dto = { eventId: mockEventId, zoneName: 'Zone A', quantity: 1 } as any;

      await expect(service.create(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('ควรจองสำเร็จสำหรับโซนยืน (Standing) เมื่อมีตั๋วว่าง', async () => {
      mockEventModel.exec.mockResolvedValue(mockEventData);
      mockQueueService.findOneByUser.mockResolvedValue({ status: 'active' });
      mockTicketsService.findAvailableTickets.mockResolvedValue([{ _id: 'ticket_1' }]);
      mockEventModel.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });

      const dto = { eventId: mockEventId, zoneName: 'Zone A', quantity: 1 } as any;
      const result = await service.create(mockUserId, dto);

      expect(result).toBeDefined();
      expect(mockTicketsService.reserveTickets).toHaveBeenCalled();
    });

    it('ควรโยน Error ถ้าตั๋วในโซนนั้นหมดแล้ว', async () => {
      const soldOutEvent = {
        ...mockEventData,
        zones: [{ ...mockEventData.zones[0], availableSeats: 0 }]
      };
      mockEventModel.exec.mockResolvedValue(soldOutEvent);
      mockQueueService.findOneByUser.mockResolvedValue({ status: 'active' });

      const dto = { eventId: mockEventId, zoneName: 'Zone A', quantity: 1 } as any;
      await expect(service.create(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });
});