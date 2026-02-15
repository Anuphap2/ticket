/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from './schema/booking.shema';
import { Event, EventDocument } from '../events/schema/event.schema';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    // 1. ตรวจสอบเงื่อนไขการจองทั้งหมด (แยกไปไว้ที่ Private Method)
    const { event, zone } = await this.validateBookingRequest(dto);

    // 2. คำนวณราคา
    const totalPrice = zone.price * dto.quantity;

    // 3. ทำการจอง (ตัดสต็อกแบบ Atomic)
    await this.decreaseAvailableSeats(dto.eventId, dto.zoneName, dto.quantity);

    // 4. บันทึกข้อมูล
    const newBooking = new this.bookingModel({
      userId,
      eventId: dto.eventId,
      zoneName: dto.zoneName,
      quantity: dto.quantity,
      totalPrice,
    });

    return await newBooking.save();
  }

  // --- Helpers / Private Methods (ช่วยให้โค้ดหลักอ่านง่าย) ---

  private async validateBookingRequest(dto: CreateBookingDto) {
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมที่ระบุ');

    // เช็ควันเวลา
    if (new Date(event.date) < new Date()) {
      throw new BadRequestException('กิจกรรมนี้สิ้นสุดลงแล้ว ไม่สามารถจองได้');
    }

    // เช็คจำนวน
    if (dto.quantity <= 0) {
      throw new BadRequestException('จำนวนที่จองต้องมากกว่า 0');
    }

    // เช็คโซนและที่นั่ง
    const zone = event.zones.find((z) => z.name === dto.zoneName);
    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือกในกิจกรรมนี้');

    if (zone.availableSeats < dto.quantity) {
      throw new BadRequestException(
        `ที่นั่งว่างไม่เพียงพอ (คงเหลือ ${zone.availableSeats} ที่นั่ง)`,
      );
    }

    return { event, zone };
  }

  private async decreaseAvailableSeats(
    eventId: string,
    zoneName: string,
    quantity: number,
  ) {
    return await this.eventModel.updateOne(
      { _id: eventId, 'zones.name': zoneName },
      { $inc: { 'zones.$.availableSeats': -quantity } },
    );
  }

  // --- Public Queries ---

  async findByUser(userId: string) {
    return this.bookingModel
      .find({ userId })
      .populate('eventId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(bookingId: string, status: string) {
    const validStatuses = ['pending', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('สถานะไม่ถูกต้อง');
    }

    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true },
    );

    if (!updatedBooking) throw new NotFoundException('ไม่พบรายการจองที่ระบุ');

    return updatedBooking;
  }

  async findAllForAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

    // ใช้ Promise.all เพื่อให้รัน Query พร้อมกัน (ประสิทธิภาพดีกว่า)
    const [data, total] = await Promise.all([
      this.bookingModel
        .find()
        .populate('eventId', 'title date location')
        .populate('userId', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.bookingModel.countDocuments(),
    ]);

    return {
      data,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  }
}
