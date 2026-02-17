import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Get('event/:eventId')
  findByEvent(@Param('eventId') eventId: string) {
    return this.ticketsService.findByEvent(eventId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(
      id,
      updateStatusDto.status,
      updateStatusDto.userId,
    );
  }
}
