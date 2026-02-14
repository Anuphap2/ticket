/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Patch,
  Param,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { BookingQueueService } from './booking-queue.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingQueueService: BookingQueueService,
  ) { }

  // 1. Endpoint สำหรับการจองตั๋ว
  @UseGuards(AccessTokenGuard) // บังคับให้ต้อง Login ก่อนถึงจะจองได้
  @Post() // ตั้งค่าให้รับ HTTP POST สำหรับการจอง
  async create(@Req() req: any, @Body() dto: CreateBookingDto) {
    const userId = req.user['sub'];

    // ส่งงานเข้า Queue แทนการรันตรงๆ เพื่อป้องกัน Database พีค
    return this.bookingQueueService.enqueue(userId, dto);
  }

  // 2. Endpoint สำหรับดูประวัติการจองของตัวเอง (เดี๋ยวเราไปทำ Service ต่อ)
  @UseGuards(AccessTokenGuard)
  @Get('myBookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId);
  }

  @UseGuards(AccessTokenGuard) // ในอนาคตพู่กันอาจจะเพิ่ม RolesGuard เพื่อเช็คว่าเป็น Admin ไหม
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Get('status/:trackingId')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Param('trackingId') trackingId: string) {
    return this.bookingQueueService.getStatus(trackingId);
  }
}
