import { Controller } from '@nestjs/common';
import { Body, Get, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get() // User ทุกคนดูได้
  findAll() {
    return this.eventsService.findAll();
  }

  @Roles('admin') // เฉพาะ Admin เท่านั้น
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }
}
