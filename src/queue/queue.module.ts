import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Queue, QueueSchema } from './schema/queue.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Queue.name, schema: QueueSchema }]),
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService], // Export ออกไปเพื่อให้ BookingsService เรียกใช้ได้
})
export class QueueModule {}
