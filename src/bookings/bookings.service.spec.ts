import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';

describe('BookingsService', () => {
  let service: BookingsService;

  // 1. แก้ตรงนี้: ทำให้ mockBookingModel สามารถถูก 'new' ได้ (Constructor)
  const mockBookingModel = jest.fn().mockImplementation((dto) => ({
    ...dto,
    save: jest.fn().mockResolvedValue({ _id: 'booking1', ...dto }),
  }));

  // ใส่ static method เพิ่มเติมเข้าไปใน mock function
  (mockBookingModel as any).find = jest.fn();
  (mockBookingModel as any).create = jest.fn();

  const mockEventModel = {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken('Booking'),
          // 2. ใช้ useValue ตามปกติแต่ตอนนี้ตัวแปร mockBookingModel ของเราเป็น function แล้ว
          useValue: mockBookingModel
        },
        { provide: getModelToken('Event'), useValue: mockEventModel },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('ควรจะจองสำเร็จถ้าที่นั่งยังเหลือ', async () => {
    mockEventModel.findById.mockResolvedValue({
      _id: 'event1',
      date: new Date(Date.now() + 86400000), // วันพรุ่งนี้
      zones: [{ name: 'A', availableSeats: 10 }],
    });

    mockEventModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await service.create('user1', {
      eventId: 'event1',
      zoneName: 'A',
      quantity: 1,
    });

    expect(result).toBeDefined();
  });

  it('ควรจะ Error ถ้าไม่พบกิจกรรม', async () => {
    mockEventModel.findById.mockResolvedValue(null);

    await expect(
      service.create('user1', {
        eventId: 'event1',
        zoneName: 'A',
        quantity: 1,
      }),
    ).rejects.toThrow('ไม่พบกิจกรรมนี้');
  });
});