/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-base-to-string */
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
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class BookingsService {
  // 🎯 ปรับเวลาที่นี่ที่เดียว (หน่วยเป็นมิลลิวินาที)
  // 30 * 1000 = 30 วินาที
  private readonly EXPIRE_TIME_MS = 60 * 1000;

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private ticketsService: TicketsService,
    private queueService: QueueService,
  ) {}

  /**
   * สร้างรายการจองใหม่ (Logic เชื่อมกับ Tickets Collection)
   */
  async create(userId: string, dto: CreateBookingDto) {
    const myQueue = await this.queueService.findOneByUser(userId, dto.eventId);
    const { zone } = await this.validateBookingRequest(dto);

    if (!myQueue || myQueue.status !== 'active') {
      throw new BadRequestException('ยังไม่ถึงคิวของคุณ หรือคิวหมดอายุแล้ว');
    }

    const zoneId = zone._id.toString();
    const zoneType = zone.type;

    let reservedTicketIds: string[] = [];
    let actualSeatNumbers: string[] = []; // 🎯 สร้างตัวแปรไว้รอเก็บเลขที่นั่ง
    const isSeated = zoneType === 'seated';

    if (isSeated) {
      if (!dto.seatNumbers || dto.seatNumbers.length === 0) {
        throw new BadRequestException(
          'กรุณาระบุเลขที่นั่งสำหรับโซนระบุที่นั่ง',
        );
      }

      const tickets = await this.ticketsService.findSpecificTickets(
        dto.eventId,
        dto.zoneName,
        dto.seatNumbers,
      );

      if (tickets.length !== dto.seatNumbers.length) {
        throw new BadRequestException('ที่นั่งบางส่วนถูกจองไปแล้ว');
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
      actualSeatNumbers = tickets.map((t) => (t as any).seatNumber); // 🎯 เก็บเลขที่นั่ง
    } else {
      const tickets = await this.ticketsService.findAvailableTickets(
        dto.eventId,
        dto.zoneName,
        dto.quantity,
      );

      if (tickets.length < dto.quantity) {
        throw new BadRequestException('จำนวนตั๋วในโซนยืนไม่เพียงพอ');
      }
      reservedTicketIds = tickets.map((t) => (t as any)._id.toString());
      actualSeatNumbers = tickets.map((t) => (t as any).seatNumber); // 🎯 เก็บเลขที่นั่ง
    }

    // ... (ขั้นตอนที่ 3 และ 4 เรื่องการ reserve และหักสต็อกคงเดิม) ...
    await this.ticketsService.reserveTickets(
      reservedTicketIds,
      userId,
      dto.eventId,
    );
    try {
      await this.decreaseAvailableSeatsAtomic(
        dto.eventId,
        zoneId,
        dto.quantity,
      );
    } catch (error) {
      await this.ticketsService.cancelReserve(reservedTicketIds, dto.eventId);
      throw error;
    }

    const totalPrice = zone.price * dto.quantity;

    // 🎯 5. ส่ง actualSeatNumbers ไปด้วย
    return this.saveBookingRecord(
      userId,
      dto,
      totalPrice,
      reservedTicketIds,
      zoneId,
      actualSeatNumbers,
    );
  }

  // ⏱️ ยกเลิกการจองอัตโนมัติ
  private scheduleAutoCancel(bookingId: string) {
    setTimeout(async () => {
      const booking = await this.bookingModel.findById(bookingId).exec();
      if (!booking || booking.status !== 'pending') return;

      // 🎯 ดึง Event เพื่อมาเช็คประเภทโซน (Standing/Seated) จากต้นฉบับ
      const event = await this.eventModel.findById(booking.eventId).exec();
      if (!event) return;

      const targetZone = event.zones.find(
        (z) => z._id.toString() === booking.zoneId,
      );
      if (!targetZone) return;

      try {
        // 1️⃣ คืนสถานะตั๋วรายใบ (Tickets Collection)
        const ticketIds = booking.tickets.map((t) => t.toString());
        await this.ticketsService.cancelReserve(
          ticketIds,
          booking.eventId.toString(),
        );

        // 2️⃣ 🎯 คืนสต็อกโดยใช้ arrayFilters เพื่อความแม่นยำ (ขาคืน)
        const updateResult = await this.eventModel
          .updateOne(
            { _id: booking.eventId }, // Filter แค่ Event ID
            {
              // สั่งบวกคืนในโซนที่กำหนดผ่านตัวแปร targetZone
              $inc: { 'zones.$[targetZone].availableSeats': booking.quantity },
            },
            {
              // นิยามว่า targetZone คือโซนที่มี _id ตรงกับที่เซฟไว้ใน Booking
              arrayFilters: [{ 'targetZone._id': booking.zoneId }],
            },
          )
          .exec();

        if (updateResult.modifiedCount > 0) {
          console.log(
            `♻️ Stock (+${booking.quantity}) returned successfully to ${booking.zoneName}`,
          );
        } else {
          console.warn(
            `⚠️ Could not return stock. Zone ID ${booking.zoneId} might not match.`,
          );
        }

        // 3️⃣ เปลี่ยนสถานะรายการจองเป็น cancelled
        await this.bookingModel.updateOne(
          { _id: bookingId },
          { $set: { status: 'cancelled' } },
        );
      } catch (err) {
        console.error(`🔥 Error during auto-cancel for ${bookingId}:`, err);
      }
    }, this.EXPIRE_TIME_MS);
  }

  // ⏱️ ยกเลิกการจองอัตโนมัติ
  // --- Helper Methods ---

  private async validateBookingRequest(dto: CreateBookingDto) {
    const event = await this.eventModel.findById(dto.eventId).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมที่ระบุ');
    console.log(`🔍 Event found: ${event.title}`);

    // 🎯 หาโซนด้วยชื่อ แต่ต้องมั่นใจว่าเป็นโซนใน Event นี้เท่านั้น
    const zone = event.zones.find((z) => z.name === dto.zoneName);
    console.log(`🔍 Zone found: ${zone.name}`);

    if (!zone) throw new BadRequestException('ไม่พบโซนที่เลือก');
    if (zone.availableSeats < dto.quantity)
      throw new BadRequestException('ที่นั่งไม่เพียงพอ');

    return { event, zone };
  }

  private async decreaseAvailableSeatsAtomic(
    eventId: string,
    ZoneId: string,
    quantity: number,
  ) {
    console.log(`🚀 Attempting to decrease stock for Zone ID: ${ZoneId}`);
    const result = await this.eventModel
      .updateOne(
        {
          _id: eventId,
          'zones._id': ZoneId,
          'zones.availableSeats': { $gte: quantity },
        }, // หา Event ให้เจอ
        {
          // 🎯 บอกว่า "ให้ลบค่าในโซนที่ชื่อว่า 'targetZone'"
          $inc: { 'zones.$[targetZone].availableSeats': -quantity },
        },
        {
          // 🎯 นิยามว่า 'targetZone' คือตัวที่มี _id ตรงกับ ZoneId ที่ส่งมา
          arrayFilters: [{ 'targetZone._id': ZoneId }],
        },
      )
      .exec();

    if (result.modifiedCount === 0) {
      // ถ้ามันไม่ลด แสดงว่าหา ID ไม่เจอ หรือสต็อกไม่พอจริงๆ
      throw new BadRequestException(
        'หักสต็อกล้มเหลว: ไม่พบโซนที่ระบุหรือที่นั่งเต็ม',
      );
    }
  }

  private async saveBookingRecord(
    userId: string,
    dto: CreateBookingDto,
    totalPrice: number,
    ticketIds: string[],
    ZoneId: string,
    seatNumbers: string[],
  ) {
    // 🎯 คำนวณเวลาหมดอายุโดยใช้ค่าจากตัวแปรด้านบน
    const expiresAt = new Date(Date.now() + this.EXPIRE_TIME_MS);

    const newBooking = new this.bookingModel({
      userId,
      eventId: dto.eventId,
      zoneId: ZoneId,
      zoneName: dto.zoneName,
      quantity: dto.quantity,
      totalPrice,
      status: 'pending',
      tickets: ticketIds,
      seatNumbers,
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
    const updatedBooking = await this.bookingModel
      .findByIdAndUpdate(bookingId, { status }, { returnDocument: 'after' })
      .exec();

    if (!updatedBooking) throw new NotFoundException('ไม่พบรายการจอง');

    if (status === 'confirmed') {
      const ticketIds = updatedBooking.tickets.map((t) => t.toString());

      const result = await this.ticketsService.markAsSoldById(ticketIds);

      if (result.modifiedCount !== ticketIds.length) {
        throw new BadRequestException('มีตั๋วบางใบถูกขายไปแล้ว');
      }

      console.log(`✅ Tickets for Booking ${bookingId} are now SOLD`);
    }

    return updatedBooking;
  }

  async deleteBooking(id: string) {
    const result = await this.bookingModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('ไม่พบรายการจองที่ต้องการลบ');
    return { message: 'ลบรายการจองสำเร็จ', id };
  }

  async deleteByEvent(eventId: string) {
    // ลบการจองทั้งหมดที่เกี่ยวข้องกับกิจกรรมนี้
    return this.bookingModel.deleteMany({ eventId: eventId }).exec();
  }
}
