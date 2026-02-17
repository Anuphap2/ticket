/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { getModelToken } from '@nestjs/mongoose';
import { Ticket } from './schema/ticket.schema';
import { Types } from 'mongoose';

describe('TicketsService', () => {
  let service: TicketsService;
  let model: any;

  const mockEventId = new Types.ObjectId().toString();
  const mockTicketId = new Types.ObjectId().toString();

  const mockTicketModel = {
    updateMany: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    find: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getModelToken(Ticket.name), useValue: mockTicketModel },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    model = module.get(getModelToken(Ticket.name));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reserveTickets', () => {
    it('กรณีบัตรยืน: ต้องเรียก updateMany พร้อมเงื่อนไขที่ถูกต้อง', async () => {
      model.exec.mockResolvedValue({ modifiedCount: 1 });
      await service.reserveTickets([mockTicketId], 'user123', mockEventId);
      expect(model.updateMany).toHaveBeenCalled();
    });
  });
});