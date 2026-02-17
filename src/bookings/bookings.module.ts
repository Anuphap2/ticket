import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schema/booking.shema';
import { Event, EventSchema } from '../events/schema/event.schema';
import { BookingQueueService } from './booking-queue.service';
import { TicketsModule } from 'src/tickets/tickets.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    TicketsModule, // นำเข้า TicketsModule เพื่อให้ BookingsService ใช้งาน TicketsService ได้
    QueueModule, // นำเข้า QueueModule เพื่อให้ BookingsService ใช้งาน QueueService ได้
  ],
  providers: [BookingsService, BookingQueueService],
  controllers: [BookingsController],
})
export class BookingsModule {}
