import { Test, TestingModule } from '@nestjs/testing';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { Queue } from './schema/queue.schema';

describe('QueueController', () => {
  let controller: QueueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [
        {
          provide: QueueService,
          useValue: { create: jest.fn(), findOneByUser: jest.fn() },
        },
        {
          provide: getModelToken(Queue.name),
          useValue: {}, // Mock Model
        },
      ],
    }).compile();

    controller = module.get<QueueController>(QueueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});