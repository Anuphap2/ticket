import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TicketDocument = Ticket & Document;

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true })
  eventId: string;

  @Prop({ required: true })
  seatNumber: string;

  @Prop({ required: true })
  zoneName: string;

  @Prop({
    required: true,
    enum: ['available', 'reserved', 'sold'],
    default: 'available',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  userId: string;

  @Prop({ default: null })
  reservedAt: Date;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
