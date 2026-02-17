import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schema/event.schema';
import { TicketsModule } from 'src/tickets/tickets.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    TicketsModule, // นำเข้า TicketsModule เพื่อให้ EventsService ใช้งาน TicketsService ได้
  ],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
