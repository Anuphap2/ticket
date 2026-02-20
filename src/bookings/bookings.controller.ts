/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Delete,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BookingQueueService } from './booking-queue.service';
import { TicketsService } from '../tickets/tickets.service';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingQueueService: BookingQueueService,
    private readonly ticketsService: TicketsService,
  ) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างรายการจองใหม่ (เข้า Queue)' })
  @ApiResponse({ status: 201, description: 'ส่งคำขอเข้าคิวจองสำเร็จ' })
  @ApiResponse({
    status: 400,
    description: 'ข้อมูลไม่ถูกต้อง หรือที่นั่งไม่พอ',
  })
  @ApiBody({ type: CreateBookingDto })
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateBookingDto) {
    const userId = req.user['sub'];

    if (dto.seatNumbers && dto.seatNumbers.length > 0) {
      await this.ticketsService.reserveTickets(
        dto.seatNumbers,
        userId,
        dto.eventId,
      );
    }

    return this.bookingQueueService.enqueue(userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงรายการจองของตัวเอง' })
  @ApiResponse({ status: 200, description: 'คืนค่ารายการจองของผู้ใช้' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @UseGuards(AccessTokenGuard)
  @Get('myBookings')
  async getMyBookings(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId, Number(page), Number(limit));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] อัปเดตสถานะการจอง' })
  @ApiResponse({ status: 200, description: 'อัปเดตสถานะสำเร็จ' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiBody({
    schema: {
      properties: { status: { type: 'string', example: 'confirmed' } },
    },
  })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'เช็คสถานะจากคิว (Polling)' })
  @ApiResponse({ status: 200, description: 'คืนค่าสถานะคิว' })
  @ApiParam({ name: 'trackingId', description: 'Tracking ID จากการ Enqueue' })
  @UseGuards(AccessTokenGuard)
  @Get('status/:trackingId')
  async getStatus(@Param('trackingId') trackingId: string) {
    return this.bookingQueueService.getStatus(trackingId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] ดูประวัติการจองทั้งหมด' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'คืนค่ารายการจองทั้งหมดพร้อมระบบแบ่งหน้า',
  })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Get('all-bookings')
  async findAllBookings(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.bookingsService.findAllForAdmin(
      parseInt(page),
      parseInt(limit),
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'ยืนยันการจอง (Confirm Booking)' })
  @ApiResponse({ status: 200, description: 'ยืนยันการจองสำเร็จ' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @UseGuards(AccessTokenGuard)
  @Patch(':id/confirm')
  async confirmBooking(@Param('id') id: string) {
    return this.bookingsService.updateStatus(id, 'confirmed');
  }

  @ApiOperation({ summary: 'เช็คสถานะคิวแบบละเอียด' })
  @ApiParam({ name: 'trackingId', description: 'Tracking ID' })
  @Get('queue-status/:trackingId')
  checkStatus(@Param('trackingId') trackingId: string): any {
    return this.bookingQueueService.getStatus(trackingId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] ลบรายการจอง' })
  @ApiResponse({ status: 200, description: 'ลบรายการจองสำเร็จ' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.bookingsService.deleteBooking(id);
  }
}
