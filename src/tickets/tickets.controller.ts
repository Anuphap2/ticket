import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto';

// 🎯 นำเข้า Swagger Decorators และ Guards
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiBody, 
  ApiParam 
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tickets') // จัดกลุ่ม API
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างตั๋วใหม่ (Admin Only)' })
  @ApiResponse({ status: 201, description: 'สร้างตั๋วสำเร็จ' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post()
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @ApiOperation({ summary: 'ดึงรายการตั๋วทั้งหมดของกิจกรรมที่ระบุ' })
  @ApiParam({ name: 'eventId', description: 'ID ของกิจกรรม' })
  @ApiResponse({ status: 200, description: 'คืนค่ารายการตั๋วสำเร็จ' })
  @Get('event/:eventId')
  findByEvent(@Param('eventId') eventId: string) {
    return this.ticketsService.findByEvent(eventId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'อัปเดตสถานะตั๋ว (Admin Only)' })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะตั๋วสำเร็จ' })
  @ApiBody({ type: UpdateTicketStatusDto })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
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
