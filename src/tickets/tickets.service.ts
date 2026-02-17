import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument } from './schema/ticket.schema';
import { CreateTicketDto } from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
  ) {}

  // สร้างตั๋วทีละใบ
  async create(createTicketDto: CreateTicketDto) {
    return new this.ticketModel(createTicketDto).save();
  }

  // ดึงตั๋วทั้งหมดของ Event นั้นๆ (เอาไว้โชว์ผังที่นั่ง)
  async findByEvent(eventId: string) {
    return this.ticketModel.find({ eventId }).exec();
  }

  async createMany(eventId: string, zones: any[]) {
    const tickets: Partial<Ticket>[] = [];
    // แกะข้อมูลจากแต่ละโซนมาสร้างที่นั่งรายใบ
    zones.forEach((zone) => {
      for (let i = 1; i <= zone.totalSeats; i++) {
        tickets.push({
          eventId,
          zoneName: zone.name,
          seatNumber: `${zone.name}${i}`,
          status: 'available',
        });
      }
    });

    return this.ticketModel.insertMany(tickets); // ใช้ insertMany จะเร็วกว่าเซฟทีละใบ
  }
  async updateZoneName(
    eventId: string,
    oldZoneName: string,
    newZoneName: string,
  ) {
    // 🎯 ท่าแก้ขัด: ถ้าหาตามชื่อโซนไม่เจอ ให้ลองอัปเดตตั๋ว "ทุกใบ" ของงานนี้เลย
    const result = await this.ticketModel
      .updateMany(
        { eventId: new Types.ObjectId(eventId) as any }, // หาแค่ ID งานพอ
        { $set: { zoneName: newZoneName } },
      )
      .exec();

    return result;
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
