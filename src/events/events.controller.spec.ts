/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('src/tickets/tickets.service', () => {
  return { TicketsService: jest.fn() };
}, { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ConfigService } from '@nestjs/config'; // 🎯 1. เพิ่ม Import ตรงนี้

describe('EventsController', () => {
  let controller: EventsController;

  const mockEventsService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'e1', title: 'Concert' }),
    create: jest.fn().mockResolvedValue({ id: 'e1', title: 'New Concert' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
        {
          // 🎯 2. เพิ่ม ConfigService จำลองตรงนี้
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock-value') },
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('ควรเรียกใช้ eventsService.findAll และคืนค่าเป็น array', async () => {
      const result = await controller.findAll();
      expect(mockEventsService.findAll).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('ควรเรียกใช้ eventsService.findOne ด้วย ID ที่ถูกต้อง', async () => {
      const id = 'e1';
      await controller.findOne(id);
      expect(mockEventsService.findOne).toHaveBeenCalledWith(id);
    });
  });
});