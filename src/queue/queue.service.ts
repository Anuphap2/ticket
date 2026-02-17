import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Queue, QueueDocument } from './schema/queue.schema';

@Injectable()
export class QueueService {
  constructor(
    @InjectModel(Queue.name) private queueModel: Model<QueueDocument>,
  ) {}

  // Logic การเพิ่มคิว (เหมือนที่เราคุยกันตะกี้)
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
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).save();
  }

  // หาคิวของผู้ใช้
  async findOneByUser(userId: string, eventId: string) {
    return this.queueModel
      .findOne({
        userId: new Types.ObjectId(userId),
        eventId: new Types.ObjectId(eventId),
        status: 'waiting',
      })
      .exec();
  }
}
