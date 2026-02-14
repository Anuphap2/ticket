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
import { UnauthorizedException } from '@nestjs/common';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // 1. Endpoint สำหรับการจองตั๋ว
  @UseGuards(AccessTokenGuard) // บังคับให้ต้อง Login ก่อนถึงจะจองได้
  @Post() // ตั้งค่าให้รับ HTTP POST สำหรับการจอง
  async create(@Req() req: any, @Body() createBookingDto: CreateBookingDto) {
    console.log('User data from Token:', req.user); // พู่กันเช็คค่านี้ใน Terminal ดูนะ

    // ลองเปลี่ยนจาก 'sub' เป็น 'id' หรือ '_id' ถ้า log ออกมาเป็นชื่ออื่น
    const userId = req.user?.sub || req.user?.id || req.user?._id;

    if (!userId) {
      throw new UnauthorizedException('หา ID ผู้ใช้ไม่เจอ');
    }

    return this.bookingsService.create(userId, createBookingDto);
  }

  // 2. Endpoint สำหรับดูประวัติการจองของตัวเอง (เดี๋ยวเราไปทำ Service ต่อ)
  @UseGuards(AccessTokenGuard)
  @Get('myBookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId);
  }

  @UseGuards(AccessTokenGuard)
  @Patch(':id/status') // ใช้ Patch สำหรับการอัปเดตบางส่วน
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }
}
