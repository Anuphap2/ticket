import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Event } from '../../events/schema/event.schema';
import { Ticket } from '../../tickets/schema/ticket.schema';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User | Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true })
  eventId: Event | Types.ObjectId;

  @Prop({ required: true })
  zoneName: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({
    default: 'pending',
    enum: ['pending', 'confirmed', 'cancelled'], // 🎯 กำหนดค่าที่ยอมรับได้
  })
  status: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  imageUrl?: string; // 🎯 ใส่ ? เผื่อกรณีเริ่มจองยังไม่มีรูปหลักฐาน

  // 🎯 จุดสำคัญ: เปลี่ยนมาเก็บเป็น Reference ของ Ticket IDs แทน
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Ticket' }],
    default: [],
  })
  tickets: Ticket[] | Types.ObjectId[];

  // เก็บ seatNumbers ไว้เป็น string เผื่อเอาไว้ดูง่ายๆ โดยไม่ต้อง populate
  @Prop({ type: [String], default: [] })
  seatNumbers: string[];

  @Prop({ type: Date })
expiresAt: Date;

}
export const BookingSchema = SchemaFactory.createForClass(Booking);
