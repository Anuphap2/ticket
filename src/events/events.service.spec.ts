/* eslint-disable @typescript-eslint/no-var-requires */
// 🎯 ดัก Path ก่อนโหลดไฟล์จริง
jest.mock('src/tickets/tickets.service', () => {
  return require('../tickets/tickets.service');
}, { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getModelToken } from '@nestjs/mongoose';
import { Event } from './schema/event.schema';
import { TicketsService } from '../tickets/tickets.service';

describe('EventsService', () => {
  let service: EventsService;

  const mockEventModel = {
    find: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...dto, save: jest.fn().mockResolvedValue({ _id: 'e1' }) })),
  };

  const mockTicketsService = {
    createMany: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getModelToken(Event.name), useValue: mockEventModel },
        { provide: TicketsService, useValue: mockTicketsService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});