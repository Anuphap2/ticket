/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, BadRequestException } from '@nestjs/common';
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
  ) { }

  async create(userId: string, dto: CreateBookingDto) {
    // 1. หา Event ที่ต้องการจอง
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new BadRequestException('ไม่พบกิจกรรมนี้');

    // 2. เช็คโซนที่เลือก
    const zone = event.zones.find((z) => z.name === dto.zoneName);
    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือก');

    const now = new Date();
    if (new Date(event.date) < now) {
      throw new BadRequestException('ขออภัย กิจกรรมนี้สิ้นสุดลงแล้ว ไม่สามารถจองได้');
    }

    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือก');

    // --- เช็คจำนวนที่จองเทียบกับที่นั่งทั้งหมดที่มี (ป้องกัน Logic ผิดพลาด) ---
    if (dto.quantity > zone.availableSeats) {
      throw new BadRequestException(`ขออภัย ที่นั่งว่างไม่เพียงพอ (คงเหลือ ${zone.availableSeats} ที่นั่ง)`);
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('จำนวนที่จองต้องมากกว่า 0');
    }

    // 3. เช็คที่นั่งว่าง
    if (zone.availableSeats < dto.quantity) {
      throw new BadRequestException('ขออภัย ที่นั่งในโซนนี้ไม่เพียงพอ');
    }

    // 4. คำนวณราคาทั้งหมด
    const totalPrice = zone.price * dto.quantity;

    // 5. ตัดสต็อกที่นั่ง (สำคัญ!)
    // เราใช้ findOneAndUpdate เพื่อให้การลดจำนวนที่นั่งเป็นแบบ Atomic ป้องกันคนจองพร้อมกันแล้วที่นั่งติดลบ
    await this.eventModel.updateOne(
      { _id: dto.eventId, 'zones.name': dto.zoneName },
      { $inc: { 'zones.$.availableSeats': -dto.quantity } },
    );

    // 6. บันทึกข้อมูลการจอง
    const newBooking = new this.bookingModel({
      userId: userId,
      eventId: dto.eventId,
      zoneName: dto.zoneName,
      quantity: dto.quantity,
      totalPrice,
    });

    return newBooking.save();
  }

  async findByUser(userId: string) {
    return this.bookingModel
      .find({ userId: userId }) // ครอบแบบนี้ครับ
      .populate('eventId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(bookingId: string, status: string) {
    const validStatuses = ['pending', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('สถานะไม่ถูกต้อง');
    }

    const booking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true }
    );

    if (!booking) throw new BadRequestException('ไม่พบรายการจองนี้');
    return booking;
  }
}
