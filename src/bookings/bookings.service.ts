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
    // 1. ตรวจสอบความถูกต้องพื้นฐาน
    const { zone } = await this.validateBookingRequest(dto);

    let reservedTicketIds: string[] = [];
    const isSpecificSeats = dto.seatNumbers && dto.seatNumbers.length > 0;

    // 2. จัดการเลือกตั๋วจาก Tickets Collection
    if (isSpecificSeats) {
      // 🎯 แก้บั๊ก TS18048: ใช้ ! เพื่อยืนยันว่ามีค่าแน่นอน เพราะเช็ค isSpecificSeats แล้ว
      const tickets = await this.ticketsService.findSpecificTickets(
        dto.eventId,
        dto.zoneName,
        dto.seatNumbers!,
      );

      if (tickets.length !== dto.seatNumbers!.length) {
        throw new BadRequestException(
          'ที่นั่งบางส่วนไม่ว่างหรือไม่มีอยู่ในระบบ',
        );
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
    } else {
      const tickets = await this.ticketsService.findAvailableTickets(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );

      if (tickets.length < dto.quantity) {
        throw new BadRequestException('ขออภัย ที่นั่งว่างในโซนนี้ไม่เพียงพอ');
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
    }

    // 3. เปลี่ยนสถานะตั๋วรายใบ
    await this.ticketsService.reserveTickets(reservedTicketIds, userId);

    // 4. หักสต็อกยอดรวมใน Event แบบ Atomic
    await this.decreaseAvailableSeatsAtomic(
      dto.eventId,
      dto.zoneName,
      dto.quantity,
    );

    // 5. บันทึกการจอง
    const totalPrice = zone.price * dto.quantity;
    return this.saveBookingRecord(userId, dto, totalPrice, reservedTicketIds);
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
    const newBooking = new this.bookingModel({
      userId,
      eventId: dto.eventId,
      zoneName: dto.zoneName,
      quantity: dto.quantity,
      totalPrice,
      status: 'pending',
      tickets: ticketIds,
    });
<<<<<<< HEAD
    
=======
>>>>>>> b9d5e0b7ca29dfe2614db907fc4189c047c63681
    return await newBooking.save();
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
<<<<<<< HEAD
  
=======

  /**
   * 🎯 คืนฟังก์ชันสำหรับ Admin ที่หายไป (แก้ Error TS2339)
   */
>>>>>>> b9d5e0b7ca29dfe2614db907fc4189c047c63681
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
    const updatedBooking = await this.bookingModel
      .findByIdAndUpdate(bookingId, { status }, { new: true })
      .exec();
    if (!updatedBooking) throw new NotFoundException('ไม่พบรายการจอง');
    return updatedBooking;
  }
}
