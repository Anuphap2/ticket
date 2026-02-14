import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // 1. Endpoint สำหรับการจองตั๋ว
  @UseGuards(AccessTokenGuard) // ต้อง Login ก่อนถึงจะจองได้
  @Post()
  async create(@Req() req: any, @Body() createBookingDto: CreateBookingDto) {
    // ดึง userId จาก request (ที่ได้มาจาก AccessTokenGuard)
    const userId = req.user['sub']; 
    return this.bookingsService.create(userId, createBookingDto);
  }

  // 2. Endpoint สำหรับดูประวัติการจองของตัวเอง (เดี๋ยวเราไปทำ Service ต่อ)
  @UseGuards(AccessTokenGuard)
  @Get('my-bookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId);
  }
}