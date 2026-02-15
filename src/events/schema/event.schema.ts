import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  location: string;

  @Prop()
  imageUrl: string;

  // เขียนเป็น Array ของ Object ตรงๆ ไปเลย ไม่ต้องสร้าง class Zone แยก
  @Prop({
    type: [
      {
        name: String,
        price: Number,
        totalSeats: Number,
        availableSeats: Number,
      },
    ],
    default: [],
  })
  zones: any[];

  @Prop({ default: 'active' })
  status: string;

  @Prop({ enum: ['seated', 'standing'], default: 'standing' })
  type: string;

  @Prop()
  rows: number; // เช่น 10 แถว

  @Prop()
  seatsPerRow: number; // เช่น แถวละ 10 ที่นั่ง

  // หรือถ้าจะเก็บสถานะที่นั่งแบบละเอียด
  @Prop([
    {
      seatNo: String,
      isAvailable: { type: Boolean, default: true },
    },
  ])
  seats: { seatNo: string; isAvailable: boolean }[];
}

export const EventSchema = SchemaFactory.createForClass(Event);
