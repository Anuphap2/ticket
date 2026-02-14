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
  Patch,
  Param,
  Query, // เพิ่ม Query ตรงนี้
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; // เพิ่ม RolesGuard
import { Roles } from '../auth/decorators/roles.decorator';
import { BookingQueueService } from './booking-queue.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingQueueService: BookingQueueService,
  ) {}

  // 1. Endpoint สำหรับการจองตั๋ว
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateBookingDto) {
    const userId = req.user['sub'];
    return this.bookingQueueService.enqueue(userId, dto);
  }

  // 2. Endpoint สำหรับดูประวัติการจองของตัวเอง
  @UseGuards(AccessTokenGuard)
  @Get('myBookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId);
  }

  // 3. Endpoint สำหรับ Admin อัปเดตสถานะตั๋วรายใบ
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  // 4. Endpoint สำหรับเช็คสถานะจากคิว (Polling)
  @Get('status/:trackingId')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Param('trackingId') trackingId: string) {
    return this.bookingQueueService.getStatus(trackingId);
  }

  // 5. Endpoint สำหรับ Admin ดูการจองทั้งหมด (รองรับ Pagination สำหรับตั๋วแสนใบ!)
  @Roles('admin')
  @Get('all-bookings')
  @UseGuards(AccessTokenGuard, RolesGuard)
  async findAllBookings(
    @Query('page') page: string = '1', // รับเป็น string ก่อนแล้วค่อยแปลง
    @Query('limit') limit: string = '20',
  ) {
    return this.bookingsService.findAllForAdmin(
      parseInt(page),
      parseInt(limit),
    );
  }
}
