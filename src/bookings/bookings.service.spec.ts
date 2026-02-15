/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { getModelToken } from '@nestjs/mongoose';
import { Booking } from './schema/booking.shema';
import { Event } from '../events/schema/event.schema';
import { BadRequestException } from '@nestjs/common';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingModel: any;
  let eventModel: any;

  const mockEvent = {
    _id: 'event123',
    title: 'Bodyslam Concert',
    date: new Date(Date.now() + 86400000),
    zones: [
      { name: 'Zone A', price: 5000, availableSeats: 10 },
      { name: 'Zone B', price: 2000, availableSeats: 0 },
    ],
  };

  beforeEach(async () => {
    // 🎯 แก้จุดนี้ครับ: ทำให้ mockBookingModel เป็นฟังก์ชัน (Constructor)
    const mockBookingModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: 'booking123', ...dto }),
    }));

    // เพิ่ม Method ต่างๆ ให้กับ Mock Model (รวมถึงระบบ Chaining สำหรับ find)
    (mockBookingModel as any).find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    });
    (mockBookingModel as any).findByIdAndUpdate = jest.fn();
    (mockBookingModel as any).countDocuments = jest.fn();

    const mockEventModel = {
      findById: jest.fn(),
      updateOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel, // 👈 ใช้ Mock ที่แก้แล้ว
        },
        {
          provide: getModelToken(Event.name),
          useValue: mockEventModel,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    eventModel = module.get(getModelToken(Event.name));
  });

  describe('create', () => {
    it('ควรจองสำเร็จเมื่อข้อมูลครบและที่นั่งว่างพอ', async () => {
      eventModel.findById.mockResolvedValue(mockEvent);
      eventModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const dto = { eventId: 'event123', zoneName: 'Zone A', quantity: 2 };
      const result = await service.create('user123', dto);

      expect(result).toBeDefined();
      // ตรวจสอบว่ามีการเรียก save()
      expect(eventModel.updateOne).toHaveBeenCalledWith(expect.any(Object), {
        $inc: { 'zones.$.availableSeats': -2 },
      });
    });

    it('ควร Error ถ้าจองกิจกรรมที่ไม่มีอยู่จริง', async () => {
      eventModel.findById.mockResolvedValue(null);
      const dto = { eventId: 'invalid', zoneName: 'Zone A', quantity: 1 };

      await expect(service.create('user1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ควร Error ถ้าที่นั่งในโซนไม่พอ', async () => {
      eventModel.findById.mockResolvedValue(mockEvent);
      const dto = { eventId: 'event123', zoneName: 'Zone B', quantity: 1 };

      await expect(service.create('user1', dto)).rejects.toThrow(
        /ที่นั่งว่างไม่เพียงพอ|ที่นั่งในโซนนี้ไม่เพียงพอ/,
      );
    });

    it('ควร Error ถ้ากิจกรรมสิ้นสุดลงแล้ว', async () => {
      const expiredEvent = {
        ...mockEvent,
        date: new Date(Date.now() - 86400000),
      };
      eventModel.findById.mockResolvedValue(expiredEvent);

      const dto = { eventId: 'event123', zoneName: 'Zone A', quantity: 1 };
      await expect(service.create('user1', dto)).rejects.toThrow(
        /กิจกรรมนี้สิ้นสุดลงแล้ว/,
      );
    });
  });

  describe('findAllForAdmin', () => {
    it('ควรคืนค่าข้อมูลการจองพร้อมระบบแบ่งหน้า (Pagination)', async () => {
      const mockBookings = [{ _id: 'b1' }, { _id: 'b2' }];
      const total = 2;

      // 🎯 แก้ไขการ Mock Chaining ตรงนี้ครับ
      // เราต้องทำให้ find() คืนค่า Object ที่มี Method อื่นๆ และ Method เหล่านั้นต้องเป็น Jest Mock
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBookings),
      };

      bookingModel.find.mockReturnValue(mockQuery);
      bookingModel.countDocuments.mockResolvedValue(total);

      const result = await service.findAllForAdmin(1, 10);

      // ✅ ตรวจสอบผลลัพธ์
      expect(result.data).toEqual(mockBookings);
      expect(result.total).toBe(total);
      expect(result.page).toBe(1);

      // ✅ ตอนนี้เราจะเช็คจาก mockQuery แทนครับ เพราะตัวแปรนี้เก็บฟังก์ชัน Mock ไว้
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.skip).toHaveBeenCalledWith(0); // (1-1) * 10
    });
  });

  describe('updateStatus', () => {
    it('ควร Error เมื่อส่งสถานะที่ไม่ถูกต้องมา', async () => {
      await expect(
        service.updateStatus('b1', 'invalid_status'),
      ).rejects.toThrow('สถานะไม่ถูกต้อง');
    });
  });
});
