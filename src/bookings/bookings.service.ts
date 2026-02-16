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

  // src/bookings/bookings.service.ts

  async create(userId: string, dto: CreateBookingDto) {
    // 1. ตรวจสอบเงื่อนไขเบื้องต้น (Event มีจริงไหม, วันที่ผ่านไปหรือยัง)
    const { zone } = await this.validateBookingRequest(dto);

    // 2. ตัดสต็อกแบบ Atomic
    if (dto.seatNumbers && dto.seatNumbers.length > 0) {
      // 2.1 กรณีระบุที่นั่ง (Seated)
      if (dto.seatNumbers.length !== dto.quantity) {
        throw new BadRequestException('จำนวนที่นั่งที่เลือกไม่ตรงกับจำนวนตั๋ว');
      }
      await this.reserveSeats(dto.eventId, dto.seatNumbers);
      // ตัด Available Seats ของโซนด้วย (เพื่อให้ยอดรวมตรงกัน)
      await this.decreaseAvailableSeats(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );
    } else {
      // 2.2 กรณีไม่ระบุที่นั่ง (Standing / General)
      await this.decreaseAvailableSeats(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );
    }

    // 3. คำนวณราคาและบันทึกข้อมูลการจอง
    const totalPrice = zone.price * dto.quantity;
    const newBooking = new this.bookingModel({
      userId,
      eventId: dto.eventId,
      zoneName: dto.zoneName,
      quantity: dto.quantity,
      totalPrice,
      status: 'pending',
      seatNumbers: dto.seatNumbers || [],
    });

    return await newBooking.save();
  }

  private async reserveSeats(eventId: string, seatNumbers: string[]) {
    // ใช้ updateOne + arrayFilters เพื่อ update หลาย element ใน array เดียวกัน (MongoDB feature)
    // แต่เพื่อความง่ายและ Atomic:
    // เราจะเช็คว่าที่นั่งทั้งหมดว่างอยู่ไหม และ update ทีเดียว

    // 1. เช็คและ Lock ที่นั่ง (Optimistic Concurrency Control)
    const result = await this.eventModel.updateOne(
      {
        _id: eventId,
        seats: {
          $all: seatNumbers.map((no) => ({
            $elemMatch: { seatNo: no, isAvailable: true },
          })),
        },
      },
      {
        $set: { 'seats.$[elem].isAvailable': false },
      },
      {
        arrayFilters: [{ 'elem.seatNo': { $in: seatNumbers } }],
      },
    );

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'ขออภัย ที่นั่งที่คุณเลือกถูกจองไปแล้ว หรือข้อมูลไม่ถูกต้อง',
      );
    }
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
    const result = await this.eventModel.updateOne(
      {
        _id: eventId,
        'zones.name': zoneName,
        'zones.availableSeats': { $gte: quantity }, // เพิ่มเงื่อนไข: ต้องมีที่นั่งว่าง >= จำนวนที่จอง
      },
      {
        $inc: { 'zones.$.availableSeats': -quantity },
      },
    );

    // ถ้า nModified เป็น 0 แสดงว่าเงื่อนไขไม่ตรง (ที่นั่งอาจจะเพิ่งเต็มไปตอนที่เรากำลังจะหัก)
    if (result.modifiedCount === 0) {
      throw new BadRequestException('ขออภัย ที่นั่งว่างไม่เพียงพอในขณะนี้');
    }

    return result;
  }

  // --- Public Queries ---

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.bookingModel
        .find({ userId })
        .populate('eventId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments({ userId }),
    ]);

    return {
      data,
      total,
      page,
      last_page: Math.ceil(total / limit),
    };
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
