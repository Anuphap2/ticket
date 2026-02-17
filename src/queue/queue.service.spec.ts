import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { Queue } from './schema/queue.schema';
import { Types } from 'mongoose';

describe('QueueService', () => {
  let service: QueueService;
  let model: any;

  // 🎯 สร้าง Mock ข้อมูลตัวอย่าง (ใช้ ID 24 หลักจริง)
  const mockQueueData = {
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    eventId: new Types.ObjectId(),
    status: 'waiting',
    queueNumber: 1,
  };

  // 🎯 ปรับ Mock ให้ทำหน้าที่เป็น Constructor ได้ด้วย (เพื่อแก้ Error "not a constructor")
  function mockModel(dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue({ ...dto, _id: mockQueueData._id });
  }

  // เติม Method ต่างๆ เข้าไปในฟังก์ชัน mockModel
  mockModel.findOne = jest.fn();
  mockModel.findByIdAndUpdate = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getModelToken(Queue.name),
          useValue: mockModel, // 🎯 ใช้ function แทน object
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    model = module.get(getModelToken(Queue.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('ควรจองคิวใหม่ได้ (create)', async () => {
    // 🎯 จำลองว่าหาคิวเก่าไม่เจอ เพื่อเริ่มคิวที่ 1
    model.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    const result = await service.create(
      mockQueueData.userId.toString(),
      mockQueueData.eventId.toString(),
    );

    expect(result).toBeDefined();
    expect(model.findOne).toHaveBeenCalled();
  });

  it('ควรหาคิวของผู้ใช้เจอ (findOneByUser)', async () => {
    model.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockQueueData),
    });

    const result = await service.findOneByUser(
      mockQueueData.userId.toString(),
      mockQueueData.eventId.toString(),
    );

    expect(result).toBeDefined();
    expect(result.status).toEqual('waiting');
  });

  it('ควรอัปเดตสถานะคิวได้ (updateStatus)', async () => {
    model.findByIdAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...mockQueueData, status: 'active' }),
    });

    const result = await service.updateStatus(mockQueueData._id, 'active');
    expect(result.status).toEqual('active');
  });
});