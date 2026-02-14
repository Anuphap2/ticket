import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getModelToken } from '@nestjs/mongoose';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getModelToken('Event'), // ต้องใส่ตัวนี้เข้าไปด้วยครับ
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            // เพิ่ม mock function อื่นๆ ที่ service เรียกใช้
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});