/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
  posterUrl: string;

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
}

export const EventSchema = SchemaFactory.createForClass(Event);
