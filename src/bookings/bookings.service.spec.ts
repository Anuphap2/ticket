
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

  const mockBooking = {
    _id: 'booking-id',
    userId: 'user-id',
    eventId: 'event-id',
    zoneName: 'A',
    quantity: 2,
    totalPrice: 200,
    status: 'confirmed',
    save: jest.fn(),
  };

  const mockEvent = {
    _id: 'event-id',
    date: new Date(Date.now() + 86400000).toISOString(), // Future date
    zones: [
      { name: 'A', price: 100, availableSeats: 50 },
    ],
  };

  class MockBookingModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(mockBooking);
    static find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([mockBooking]),
    });
    static findByIdAndUpdate = jest.fn().mockResolvedValue(mockBooking);
    static countDocuments = jest.fn().mockResolvedValue(1);
  }

  const mockEventModelObject = {
    findById: jest.fn().mockResolvedValue(mockEvent),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: MockBookingModel,
        },
        {
          provide: getModelToken(Event.name),
          useValue: mockEventModelObject,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingModel = module.get(getModelToken(Booking.name));
    eventModel = module.get(getModelToken(Event.name));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a booking', async () => {
      const dto = {
        eventId: 'event-id',
        zoneName: 'A',
        quantity: 2,
      };

      // Mock internal validation & atomic update
      // Since create() calls validateBookingRequest and decreaseAvailableSeats internally
      // and they depend on eventModel.

      const result = await service.create('user-id', dto);
      expect(result).toBeDefined();
      expect(eventModel.updateOne).toHaveBeenCalled();
    });

    it('should throw BadRequest if seats are not enough (atomic check)', async () => {
      eventModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
      const dto = {
        eventId: 'event-id',
        zoneName: 'A',
        quantity: 2,
      };

      await expect(service.create('user-id', dto)).rejects.toThrow(BadRequestException);
    });
  });
});
