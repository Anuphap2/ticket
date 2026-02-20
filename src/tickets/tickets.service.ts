/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    return this.ticketModel
      .deleteMany({ eventId: new Types.ObjectId(eventId) as any })
      .exec();
  }

  // ดึงตั๋วทั้งหมดของ Event นั้นๆ (เอาไว้โชว์ผังที่นั่ง)
  async findByEvent(eventId: string) {
    return this.ticketModel
      .find({ eventId: new Types.ObjectId(eventId) as any })
      .exec();
  }

  async createMany(eventId: string, zones: any[]) {
    const tickets: any[] = [];
    zones.forEach((zone) => {
      const zoneId = zone._id;
      for (let i = 1; i <= zone.totalSeats; i++) {
        tickets.push({
          eventId: new Types.ObjectId(eventId),
          zoneId: new Types.ObjectId(zoneId),
          zoneName: zone.name,
          seatNumber: `${zone.name}${i}`,
          status: 'available',
        });
      }
    });
    return this.ticketModel.insertMany(tickets);
  }

  async updateZoneName(
    eventId: string,
    oldZoneName: string,
    newZoneName: string,
  ) {
    const tickets = await this.ticketModel
      .find({
        eventId: new Types.ObjectId(eventId) as any,
        zoneName: oldZoneName,
      })
      .exec();

    const updatePromises = tickets.map((ticket) => {
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

  async updateStatus(id: string, status: string, userId: string | null = null) {
    const updateData: any = { status, userId };
    if (status === 'reserved') updateData.reservedAt = new Date();

    const ticket = await this.ticketModel.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
    });
    if (!ticket) throw new NotFoundException('ไม่พบตั๋วใบนี้');
    return ticket;
  }

  async updateZoneSeats(
    eventId: string,
    zone: any,
    startOffset: number,
    count: number,
  ) {
    // ระบุ Type เป็น any[] หรือสร้าง Interface รองรับเพื่อแก้ปัญหา 'never'
    const newTickets: any[] = [];
    const zoneId = zone._id.toString();

    for (let i = 1; i <= count; i++) {
      const seatIndex = startOffset + i;
      newTickets.push({
        eventId: eventId,
        zoneName: zone.name,
        zoneId: zoneId,
        seatNumber: zone.type === 'seated' ? `${zone.name}${seatIndex}` : null,
        status: 'available',
      });
    }

    // ใช้ insertMany เพื่อความรวดเร็ว
    return this.ticketModel.insertMany(newTickets);
  }

  // 1. หาตั๋วที่ระบุเลขที่นั่ง (Seated)
  async findSpecificTickets(
    eventId: string,
    zoneName: string,
    seatNumbers: string[],
  ) {
    return this.ticketModel
      .find({
        eventId: new Types.ObjectId(eventId) as any, // 🎯 แก้ปัญหาหาไม่เจอ
        zoneName: zoneName,
        seatNumber: { $in: seatNumbers },
        status: { $in: ['available', 'reserved'] },
      })
      .exec();
  }

  // 2. หาตั๋วที่ว่างตามจำนวน (Standing)
  async findAvailableTickets(
    eventId: string,
    zoneName: string,
    quantity: number,
  ) {
    return this.ticketModel
      .find({
        eventId: new Types.ObjectId(eventId) as any, // 🎯 แก้ปัญหาหาไม่เจอ
        zoneName: zoneName,
        status: 'available',
      })
      .limit(quantity)
      .exec();
  }

  // 3. เปลี่ยนสถานะตั๋วเป็นจองแล้ว (Reserved)
  async reserveTickets(
    ticketIdsOrNumbers: string[], // รับมาได้ทั้ง ID (โซนยืน) หรือ เลขที่นั่ง (โซนนั่ง)
    userId: string | null,
    eventId: string,
  ) {
    const updateData: any = {
      status: userId ? 'reserved' : 'available',
      userId: userId,
      reservedAt: userId ? new Date() : null,
    };

    return this.ticketModel
      .updateMany(
        {
          eventId: new Types.ObjectId(eventId) as any,
          $or: [
            {
              _id: {
                $in: ticketIdsOrNumbers
                  .filter((id) => /^[0-9a-fA-F]{24}$/.test(id))
                  .map((id) => new Types.ObjectId(id)),
              },
            },
            { seatNumber: { $in: ticketIdsOrNumbers } },
          ],
        },
        { $set: updateData },
      )
      .exec();
  }

  // 🎯 4. เปลี่ยนสถานะตั๋วเป็นขายแล้ว (Sold) - ใช้ตอนจ่ายเงินสำเร็จ
  async markAsSold(seatNumbers: string[], eventId: string) {
    return this.ticketModel
      .updateMany(
        {
          seatNumber: { $in: seatNumbers },
          eventId: new Types.ObjectId(eventId) as any,
        },
        { $set: { status: 'sold' } },
      )
      .exec();
  }
  async cancelReserve(ticketIds: string[], eventId: string) {
    return this.ticketModel.updateMany(
      {
        _id: { $in: ticketIds },
        eventId,
        status: 'reserved',
      },
      {
        status: 'available',
        userId: null,
        reservedAt: null,
      },
    );
  }
}
