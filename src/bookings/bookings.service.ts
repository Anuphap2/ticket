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
import { TicketsService } from 'src/tickets/tickets.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private ticketsService: TicketsService,
  ) {}

  /**
   * สร้างรายการจองใหม่ (Logic เชื่อมกับ Tickets Collection)
   */
  async create(userId: string, dto: CreateBookingDto) {
    // 1. ตรวจสอบความถูกต้องพื้นฐาน (เช่น Event มีจริงไหม, วันที่ยังไม่เลยกำหนด)
    const { zone } = await this.validateBookingRequest(dto);

    let reservedTicketIds: string[] = [];

    // ตรวจสอบว่าเป็นโซนระบุที่นั่ง (Seated) หรือโซนยืน (Standing)
    // โดยเช็คว่ามีการส่ง seatNumbers มาไหม
    const isSpecificSeats = dto.seatNumbers && dto.seatNumbers.length > 0;

    // 2. จัดการเลือกตั๋วจาก Tickets Collection
    if (isSpecificSeats) {
      // 💺 กรณีโซนระบุที่นั่ง: หาตั๋วตามเลขที่ User จิ้มมา
      const tickets = await this.ticketsService.findSpecificTickets(
        dto.eventId,
        dto.zoneName,
        dto.seatNumbers!,
      );

      if (tickets.length !== dto.seatNumbers!.length) {
        throw new BadRequestException(
          'ที่นั่งบางส่วนถูกจองไปแล้ว หรือไม่มีอยู่ในระบบ',
        );
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
    } else {
      // 💃 กรณีโซนยืน: ระบบ "สุ่มหยิบ" ตั๋วที่ว่าง (available) มาให้ตามจำนวน (quantity)
      const tickets = await this.ticketsService.findAvailableTickets(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );

      if (tickets.length < dto.quantity) {
        throw new BadRequestException('ขออภัย จำนวนตั๋วว่างในโซนนี้ไม่เพียงพอ');
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
    }

    // 🎯 3. ล็อคตั๋วรายใบ (Atomic Update)
    // ขั้นตอนนี้สำคัญมาก เพื่อป้องกันคนสองคนกดจองตั๋วใบเดียวกันพร้อมกัน
    await this.ticketsService.reserveTickets(
      reservedTicketIds,
      userId,
      dto.eventId,
    );

    try {
      // 🎯 4. หักสต็อกยอดรวมใน Event แบบ Atomic
      await this.decreaseAvailableSeatsAtomic(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );
    } catch (error) {
      // 🛡️ Rollback: ถ้าหักสต็อกที่ Event ไม่สำเร็จ ต้องคืนสถานะตั๋วรายใบเป็น available
      await this.ticketsService.reserveTickets(
        reservedTicketIds,
        null,
        dto.eventId,
      ); // หรือฟังก์ชัน cancelReserve
      throw error;
    }

    // 5. บันทึกการจองลง Database และคำนวณราคาสุทธิ
    const totalPrice = zone.price * dto.quantity;
    return this.saveBookingRecord(userId, dto, totalPrice, reservedTicketIds);
  }

  // ⏱️ ยกเลิกการจองอัตโนมัติ
private scheduleAutoCancel(bookingId: string) {
  setTimeout(async () => {
    const booking = await this.bookingModel
      .findById(bookingId)
      .populate('tickets')
      .exec();

    // ถ้าไม่เจอ หรือสถานะไม่ใช่ pending = ไม่ต้องทำอะไร
    if (!booking || booking.status !== 'pending') return;

    console.log(`⛔ Auto-cancel booking ${bookingId}`);

    // 1️⃣ คืนตั๋วรายใบให้กลับเป็น available
    const ticketIds = (booking.tickets as any[]).map((t) =>
      t._id.toString(),
    );

    await this.ticketsService.cancelReserve(
      ticketIds,
      booking.eventId.toString(),
    );

    // 2️⃣ คืนจำนวนที่นั่งให้ Event
    await this.eventModel.updateOne(
      {
        _id: booking.eventId,
        'zones.name': booking.zoneName,
      },
      {
        $inc: { 'zones.$.availableSeats': booking.quantity },
      },
    );

    // 3️⃣ เปลี่ยนสถานะ booking เป็น cancelled
    booking.status = 'cancelled';
    await booking.save();

    console.log(`♻️ Seats returned for booking ${bookingId}`);
  },1 * 60 * 1000); // 1 นาที
}


  // --- Helper Methods ---

  private async validateBookingRequest(dto: CreateBookingDto) {
    const event = await this.eventModel.findById(dto.eventId).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมที่ระบุ');
    if (new Date(event.date) < new Date())
      throw new BadRequestException('กิจกรรมนี้สิ้นสุดแล้ว');

    const zone = event.zones.find((z) => z.name === dto.zoneName);
    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือก');
    if (zone.availableSeats < dto.quantity)
      throw new BadRequestException('ที่นั่งไม่เพียงพอ');

    return { event, zone };
  }

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
          'zones.availableSeats': { $gte: quantity },
        },
        { $inc: { 'zones.$.availableSeats': -quantity } },
      )
      .exec();

    if (result.modifiedCount === 0)
      throw new BadRequestException('การหักสต็อกล้มเหลว');
  }

  private async saveBookingRecord(
  userId: string,
  dto: CreateBookingDto,
  totalPrice: number,
  ticketIds: string[],
) {
  const expiresAt = new Date(Date.now() + 60 * 1000); // ⏱️ 1 นาที

  const newBooking = new this.bookingModel({
    userId,
    eventId: dto.eventId,
    zoneName: dto.zoneName,
    quantity: dto.quantity,
    totalPrice,
    status: 'pending',
    tickets: ticketIds,
    expiresAt,
  });

  const savedBooking = await newBooking.save();

  // ⏱️ ตั้งเวลา cancel อัตโนมัติ
  this.scheduleAutoCancel(savedBooking._id.toString());

  return savedBooking;
}

  // --- Queries ---

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bookingModel
        .find({ userId })
        .populate('eventId')
        .populate('tickets')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bookingModel.countDocuments({ userId }),
    ]);
    return { data, total, page, last_page: Math.ceil(total / limit) };
  }

  async findAllForAdmin(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.bookingModel
        .find()
        .populate('eventId', 'title date location')
        .populate('userId', 'name email')
        .populate('tickets')
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

  async updateStatus(bookingId: string, status: string) {
    // 1. อัปเดตสถานะการจองก่อน
    const updatedBooking = await this.bookingModel
      .findByIdAndUpdate(bookingId, { status }, { new: true })
      .populate('tickets') // 🎯 ดึงข้อมูลตั๋วมาด้วยเพื่อเอาเลขที่นั่ง
      .exec();

    if (!updatedBooking) throw new NotFoundException('ไม่พบรายการจอง');

    // 🎯 2. เช็คว่าถ้าสถานะที่เปลี่ยนคือ 'paid' หรือ 'confirmed' (หรือคำที่พู่กันใช้)
    if (status === 'confirmed') {
      // ดึงเลขที่นั่งออกมา
      const seatNumbers = (updatedBooking.tickets as any[]).map(
        (t) => t.seatNumber,
      );

      // 🚀 สั่งเปลี่ยนตั๋วเป็น SOLD ทันที
      await this.ticketsService.markAsSold(
        seatNumbers,
        updatedBooking.eventId.toString(),
      );

      console.log(`✅ Tickets for Booking ${bookingId} are now SOLD`);
    }

    return updatedBooking;
  }
}
