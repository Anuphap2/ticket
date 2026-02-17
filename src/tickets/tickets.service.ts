import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
      .limit(quantity) // ดึงมาแค่เท่าที่ต้องการ
      .exec();
  }

  async reserveTickets(ticketIds: string[], userId: string) {
    return this.ticketModel.updateMany(
      { _id: { $in: ticketIds }, status: 'available' },
      {
        status: 'reserved',
        userId,
        reservedAt: new Date(),
      },
    );
  }
}
