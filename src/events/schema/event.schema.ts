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

  // 🎯 ยุบรวมทุกอย่างใน zones เป็น Array ของ Object เดียวจบ
  @Prop({
    type: [
      {
        name: String,
        price: {
        type: Number,
        required: true,
        min:[100, 'ราคาตั๋วต้องไม่น้อยกว่า 100 บาท']
      },
        totalSeats: Number,
        availableSeats: Number,
        type: {
          type: String,
          enum: ['seated', 'standing'],
          default: 'standing',
        },
        rows: Number, // จะมีค่าเฉพาะตอนเป็น 'seated'
        seatsPerRow: Number, // จะมีค่าเฉพาะตอนเป็น 'seated'
      },
    ],
    default: [],
  })
  zones: any[];

  @Prop({ default: 'active' })
  status: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
