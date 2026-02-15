import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Event } from '../../events/schema/event.schema';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: User | Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Event;

  @Prop({ required: true })
  zoneName: string; // จองโซนไหน

  @Prop({ required: true })
  quantity: number; // จองกี่ใบ

  @Prop({ required: true })
  totalPrice: number; // ราคาทั้งหมด



  @Prop({ default: 'pending' }) // pending, confirmed, cancelled
  status: string;

  @Prop()
  paidAt?: Date; // เก็บเวลาที่จ่ายจริงไว้โชว์ในระบบ

  @Prop()
  imageUrl: string; // เก็บเป็น URL จาก Cloudinary หรือ Link รูปทั่วไป

  @Prop([String])
  seatNumbers: string[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
