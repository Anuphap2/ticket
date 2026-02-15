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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingQueueService: BookingQueueService,
  ) {}

  // 1. Endpoint สำหรับการจองตั๋ว
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างรายการจองใหม่ (เข้า Queue)' })
  @ApiResponse({ status: 201, description: 'ส่งคำขอเข้าคิวจองสำเร็จ' })
  @ApiResponse({
    status: 400,
    description: 'ข้อมูลไม่ถูกต้อง หรือที่นั่งไม่พอ',
  })
  @UseGuards(AccessTokenGuard)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateBookingDto) {
    const userId = req.user['sub'];
    return this.bookingQueueService.enqueue(userId, dto);
  }

  // 2. Endpoint สำหรับดูประวัติการจองของตัวเอง
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดึงรายการจองของตัวเอง' })
  @ApiResponse({ status: 200, description: 'Return my bookings.' })
  @UseGuards(AccessTokenGuard)
  @Get('myBookings')
  async getMyBookings(@Req() req: any) {
    const userId = req.user['sub'];
    return this.bookingsService.findByUser(userId);
  }

  // 3. Endpoint สำหรับ Admin อัปเดตสถานะตั๋วรายใบ
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] ดูประวัติการจองทั้งหมด พร้อมแบ่งหน้า' })
  @ApiResponse({ status: 200, description: 'Booking status updated.' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateStatus(id, status);
  }

  // 4. Endpoint สำหรับเช็คสถานะจากคิว (Polling)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check queue status' })
  @ApiResponse({ status: 200, description: 'Return queue status.' })
  @Get('status/:trackingId')
  @UseGuards(AccessTokenGuard)
  async getStatus(@Param('trackingId') trackingId: string) {
    return this.bookingQueueService.getStatus(trackingId);
  }

  // 5. Endpoint สำหรับ Admin ดูการจองทั้งหมด (รองรับ Pagination สำหรับตั๋วแสนใบ!)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Return all bookings with pagination.',
  })
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

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm booking' })
  @ApiResponse({ status: 200, description: 'Booking confirmed.' })
  @Patch(':id/confirm')
  @UseGuards(AccessTokenGuard)
  async confirmBooking(@Param('id') id: string) {
    // เปลี่ยนสถานะเป็น confirmed ใน MongoDB
    return this.bookingsService.updateStatus(id, 'confirmed');
  }
}
