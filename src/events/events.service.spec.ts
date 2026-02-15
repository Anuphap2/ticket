
import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getModelToken } from '@nestjs/mongoose';
import { Event } from './schema/event.schema';

describe('EventsService', () => {
  let service: EventsService;
  let model: any;

  const mockEvent = {
    _id: 'event-id',
    title: 'Test Event',
    zones: [],
    save: jest.fn(),
  };

  class MockEventModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(mockEvent);
    static find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([mockEvent]) });
    static findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockEvent) });
    static findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockEvent) });
    static findByIdAndDelete = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockEvent) });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getModelToken(Event.name),
          useValue: MockEventModel,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    model = module.get(getModelToken(Event.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new event', async () => {
      const dto: any = {
        title: 'New Event',
        zones: [{ name: 'A', price: 100, totalSeats: 50 }],
      };

      // Since we mock the class, we can check if save is called on the instance.
      // But here we just check if it returns the mockEvent.
      const result = await service.create(dto);
      expect(result).toEqual(mockEvent);
    });
  });

  describe('findAll', () => {
    it('should return all events', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockEvent]);
    });
  });

  describe('findOne', () => {
    it('should return one event', async () => {
      const result = await service.findOne('event-id');
      expect(result).toEqual(mockEvent);
    });
  });
});