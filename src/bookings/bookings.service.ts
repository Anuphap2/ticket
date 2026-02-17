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

  /**
   * สร้างรายการจองใหม่ (Refactored Version)
   */
  async create(userId: string, dto: CreateBookingDto) {
    // 1. ตรวจสอบเงื่อนไขความถูกต้อง (Validation)
    const { zone } = await this.validateBookingRequest(dto);

    // 2. จัดการที่นั่งและสต็อกแบบ Atomic (Execution)
    await this.handleSeatAllocation(dto);

    // 3. บันทึกข้อมูลการจอง (Persistence)
    const totalPrice = zone.price * dto.quantity;
    return this.saveBookingRecord(userId, dto, totalPrice);
  }

  /**
   * ตรวจสอบความพร้อมของกิจกรรมและโซนที่เลือก
   */
  private async validateBookingRequest(dto: CreateBookingDto) {
    const event = await this.eventModel.findById(dto.eventId).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมที่ระบุ');

    // ตรวจสอบวันเวลา
    if (new Date(event.date) < new Date()) {
      throw new BadRequestException('กิจกรรมนี้สิ้นสุดลงแล้ว ไม่สามารถจองได้');
    }

    // ตรวจสอบจำนวนตั๋ว
    if (dto.quantity <= 0) {
      throw new BadRequestException('จำนวนที่จองต้องมากกว่า 0');
    }

    // ตรวจสอบความถูกต้องของโซน
    const zone = event.zones.find((z) => z.name === dto.zoneName);
    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือกในกิจกรรมนี้');

    // ตรวจสอบจำนวนที่นั่งว่าง
    if (zone.availableSeats < dto.quantity) {
      throw new BadRequestException(
        `ที่นั่งว่างไม่เพียงพอ (คงเหลือ ${zone.availableSeats} ที่นั่ง)`,
      );
    }

    return { event, zone };
  }

  /**
   * แยก Logic การจัดการที่นั่งระบุเบอร์ และที่นั่งทั่วไป
   */
  private async handleSeatAllocation(dto: CreateBookingDto) {
    const isSpecificSeats = dto.seatNumbers && dto.seatNumbers.length > 0;

    if (isSpecificSeats) {
      if (dto.seatNumbers?.length !== dto.quantity) {
        throw new BadRequestException('จำนวนที่นั่งที่เลือกไม่ตรงกับจำนวนตั๋ว');
      }
      // ล็อกเลขที่นั่งและลดจำนวนสต็อกพร้อมกันแบบ Atomic
      await this.reserveSpecificSeatsAtomic(dto);
    } else {
      // ลดสต็อกที่นั่งทั่วไปแบบ Atomic
      await this.decreaseAvailableSeatsAtomic(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );
    }
  }

  /**
   * ล็อกที่นั่งและลดจำนวนสต็อกในโซนนั้นๆ พร้อมกัน (Atomic Update)
   */
  private async reserveSpecificSeatsAtomic(dto: CreateBookingDto) {
    const result = await this.eventModel
      .updateOne(
        {
          _id: dto.eventId,
          'zones.name': dto.zoneName,
          seats: {
            $all: (dto.seatNumbers ?? []).map((no) => ({
              $elemMatch: { seatNo: no, isAvailable: true },
            })),
          },
        },
        {
          // ล็อกที่นั่ง และลด availableSeats ของโซนในคำสั่งเดียว
          $set: { 'seats.$[elem].isAvailable': false },
          $inc: { 'zones.$.availableSeats': -dto.quantity },
        },
        {
          arrayFilters: [{ 'elem.seatNo': { $in: dto.seatNumbers } }],
        },
      )
      .exec();

    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'ขออภัย ที่นั่งบางส่วนถูกจองไปแล้ว หรือข้อมูลไม่ถูกต้อง',
      );
    }
  }

  /**
   * ลดจำนวนที่นั่งว่างสำหรับโซนยืน/ทั่วไป
   */
  private async decreaseAvailableSeatsAtomic(
    eventId: string,
    zoneName: string,
    quantity: number,
  ) {
    const result = await this.eventModel
      .updateOne(
        {
          _id: eventId,
          'zones.name': zoneName,
          'zones.availableSeats': { $gte: quantity }, // เช็คสต็อกอีกครั้งก่อนหัก
        },
        {
          $inc: { 'zones.$.availableSeats': -quantity },
        },
      )
      .exec();

    if (result.modifiedCount === 0) {
      throw new BadRequestException('ขออภัย ที่นั่งว่างไม่เพียงพอในขณะนี้');
    }
  }

  /**
   * บันทึกข้อมูลการจองลง MongoDB
   */
  private async saveBookingRecord(
    userId: string,
    dto: CreateBookingDto,
    totalPrice: number,
  ) {
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

  // --- Public Queries (โครงสร้าง Response เดิมสำหรับหน้าบ้าน) ---

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

    const updatedBooking = await this.bookingModel
      .findByIdAndUpdate(bookingId, { status }, { new: true })
      .exec();

    if (!updatedBooking) throw new NotFoundException('ไม่พบรายการจองที่ระบุ');

    return updatedBooking;
  }
  
  async findAllForAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;

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
