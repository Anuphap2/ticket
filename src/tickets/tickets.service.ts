import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from './schema/ticket.schema';
import { CreateTicketDto } from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) { }

  // สร้างตั๋วทีละใบ
  async create(createTicketDto: CreateTicketDto) {
    return new this.ticketModel(createTicketDto).save();
  }

  async deleteByEventMany(eventId: string) {
    return this.ticketModel.deleteMany({ eventId }).exec();
  }

  // ดึงตั๋วทั้งหมดของ Event นั้นๆ (เอาไว้โชว์ผังที่นั่ง)
  async findByEvent(eventId: string) {
    return this.ticketModel.find({ eventId }).exec();
  }

  async createMany(eventId: string, zones: any[]) {
    const tickets: any[] = [];
    zones.forEach((zone) => {
      // ใช้ _id ของโซนที่มาจาก Event (ถ้ามี) หรือใช้ index/id ที่ส่งมา
      const zoneId = zone._id;

      for (let i = 1; i <= zone.totalSeats; i++) {
        tickets.push({
          eventId: new Types.ObjectId(eventId),
          zoneId: new Types.ObjectId(zoneId), // 🎯 เก็บ ID โซนไว้ที่ตั๋ว
          zoneName: zone.name,
          seatNumber: `${zone.name}${i}`,
          status: 'available',
        });
      }
    });
    return this.ticketModel.insertMany(tickets);
  }
  // src/tickets/tickets.service.ts

  async updateZoneName(
    eventId: string,
    oldZoneName: string,
    newZoneName: string,
  ) {
    // 🎯 ท่านี้คือ: หาตั๋วงานนี้ โซนนี้ แล้วเปลี่ยนทั้งชื่อโซนและเลขที่นั่ง
    // โดยการตัดชื่อโซนเก่าออก แล้วแปะชื่อโซนใหม่เข้าไปแทนที่ข้างหน้า

    const tickets = await this.ticketModel
      .find({
        eventId: new Types.ObjectId(eventId) as any,
        zoneName: oldZoneName,
      })
      .exec();

    // วนลูปอัปเดตรายใบเพื่อให้เลขที่นั่งเปลี่ยนตามชื่อโซนใหม่เป๊ะๆ
    const updatePromises = tickets.map((ticket) => {
      // เช่น "ZoneA1" เปลี่ยนเป็น "VIP1"
      const newSeatNumber = ticket.seatNumber.replace(oldZoneName, newZoneName);

      return this.ticketModel.findByIdAndUpdate(ticket._id, {
        $set: {
          zoneName: newZoneName,
          seatNumber: newSeatNumber,
        },
      });
    });

    const results = await Promise.all(updatePromises);

    return {
      matchedCount: results.length,
      modifiedCount: results.length,
      acknowledged: true,
    };
  }

  // อัปเดตสถานะตั๋ว (ตอนจอง/จ่ายเงินสำเร็จ)
  async updateStatus(id: string, status: string, userId: string | null = null) {
    const updateData: any = { status, userId };

    if (status === 'reserved') {
      updateData.reservedAt = new Date();
    }

    const ticket = await this.ticketModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!ticket) throw new NotFoundException('ไม่พบตั๋วใบนี้');
    return ticket;
  }

  // 1. หาตั๋วที่ระบุเลขที่นั่ง (สำหรับการจองแบบระบุที่นั่ง)
  async findSpecificTickets(
    eventId: string,
    zoneName: string,
    seatNumbers: string[],
  ) {
    return this.ticketModel
      .find({
        eventId,
        zoneName,
        seatNumber: { $in: seatNumbers },
        status: 'available',
      })
      .exec();
  }

  // 2. หาตั๋วที่ว่างตามจำนวน (สำหรับบัตรยืน)
  async findAvailableTickets(
    eventId: string,
    zoneName: string,
    quantity: number,
  ) {
    return this.ticketModel
      .find({
        eventId,
        zoneName,
        status: 'available',
      })
      .limit(quantity)
      .exec();
  }

  // 3. เปลี่ยนสถานะตั๋วเป็นจองแล้ว
  async reserveTickets(ticketIds: string[], userId: string) {
    return this.ticketModel
      .updateMany(
        { _id: { $in: ticketIds } },
        { status: 'reserved', userId, reservedAt: new Date() },
      )
      .exec();
  }
}
