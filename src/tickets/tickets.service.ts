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

  async updateZoneSeats(eventId: string, zone: any, startOffset: number, count: number) {
    const newTickets: any[] = [];
    const zoneId = zone._id.toString();

    for (let i = 1; i <= count; i++) {
      const seatIndex = startOffset + i;

      // 🎯 แก้ไข: ตรวจสอบ zone.type ให้รัดกุม (แนะนำให้แปลงเป็น lowercase ก่อนเช็ค)
      const isSeated = zone.type?.toLowerCase() === 'seated';

      // หากเป็นโซนยืน (standing) ให้สร้างรหัสที่นั่งจำลองขึ้นมาแทน null 
      // เพื่อให้ผ่าน validation 'required' ใน Schema
      const seatNumberValue = isSeated
        ? `${zone.name}${seatIndex}`
        : `${zone.name}${seatIndex}`;

      newTickets.push({
        eventId: eventId,
        zoneId: zoneId,
        zoneName: zone.name,
        seatNumber: seatNumberValue,
        status: 'available',
      });
    }

    // ใช้ insertMany เพื่อเพิ่มตั๋วปริมาณมาก (เช่น จาก 1 เป็น 100 ใบ) อย่างมีประสิทธิภาพ
    return this.ticketModel.insertMany(newTickets);
  }

  async countBookedTickets(eventId: string, zoneName: string): Promise<number> {
    return this.ticketModel.countDocuments({
      eventId,
      zoneName,
      status: { $in: ['reserved', 'sold'] } // นับทั้งคนที่กำลังจองและคนที่จ่ายเงินแล้ว
    }).exec();
  }

  // 1. หาตั๋วที่ระบุเลขที่นั่ง (Seated)
  async findSpecificTickets(
    eventId: string,
    zoneName: string,
    seatNumbers: string[],) {
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

  async removeAvailableTickets(eventId: string, zoneName: string, count: number) {
    // หาตั๋วที่ว่าง (available) ในโซนนั้นๆ และลบออกตามจำนวนที่กำหนด
    // โดยเรียงจากเลขที่นั่งท้ายสุดลงมา (Sort -1)
    const ticketsToDelete = await this.ticketModel
      .find({ eventId, zoneName, status: 'available' })
      .sort({ seatNumber: -1 })
      .limit(count)
      .exec();

    const idsToDelete = ticketsToDelete.map(t => t._id);
    return this.ticketModel.deleteMany({ _id: { $in: idsToDelete } });
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
  async markAsSoldById(ticketIds: string[]) {
    const result = await this.ticketModel.updateMany(
      {
        _id: { $in: ticketIds },
        status: { $ne: 'sold' }, // กัน sold ซ้ำ
      },
      {
        $set: { status: 'sold' },
      },
    );

    return result;
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
