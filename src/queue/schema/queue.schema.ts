import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QueueDocument = Queue & Document;

@Schema({ timestamps: true })
export class Queue {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

  // สถานะ: 'waiting', 'active', 'completed', 'expired'
  @Prop({ default: 'waiting' })
  status: string;

  @Prop({ required: true })
  queueNumber: number;

  @Prop({ required: true })
  expiresAt: Date;
}

export const QueueSchema = SchemaFactory.createForClass(Queue);
