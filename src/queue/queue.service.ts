import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Queue, QueueDocument } from './schema/queue.schema';

@Injectable()
export class QueueService {
  constructor(
    @InjectModel(Queue.name) private queueModel: Model<QueueDocument>,
  ) {}

  // 1. สร้างคิวใหม่
  async create(userId: string, eventId: string) {
    const lastQueue = await this.queueModel
      .findOne({ eventId: new Types.ObjectId(eventId) })
      .sort({ queueNumber: -1 })
      .exec();

    const nextNumber = lastQueue ? lastQueue.queueNumber + 1 : 1;

    return new this.queueModel({
      userId: new Types.ObjectId(userId),
      eventId: new Types.ObjectId(eventId),
      queueNumber: nextNumber,
      // ตั้งเวลาหมดอายุ 5 นาที
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).save();
  }

  // 2. หาคิวล่าสุดของผู้ใช้ (ปรับให้หาได้กว้างขึ้นเพื่อให้ BookingQueueService ทำงานง่าย)
  async findOneByUser(userId: string, eventId: string) {
    return this.queueModel
      .findOne({
        userId: new Types.ObjectId(userId),
        eventId: new Types.ObjectId(eventId),
        // หาคิวที่ยังไม่สำเร็จหรือหมดอายุ
        status: { $in: ['waiting', 'active'] },
      })
      .sort({ createdAt: -1 }) // เอาคิวล่าสุด
      .exec();
  }

  // 🎯 3. ฟังก์ชันอัปเดตสถานะ (ที่ BookingQueueService เรียกหา)
  async updateStatus(id: string, status: string) {
    return this.queueModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
  }
}
