// src/events/events.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { TicketsService } from 'src/tickets/tickets.service';
import { BookingsService } from 'src/bookings/bookings.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private ticketsService: TicketsService,
    private bookingsService: BookingsService,
  ) { }

  // 1. สร้างกิจกรรมใหม่
  async create(dto: CreateEventDto): Promise<Event> {
    const eventData = {
      ...dto,
      zones: dto.zones.map((zone) => ({
        ...zone,
        availableSeats: zone.totalSeats,
      })),
    };

    // 🎯 2. เซฟ Event ลง DB ก่อนเพื่อเอา _id
    const savedEvent = await new this.eventModel(eventData).save();

    // 🎯 3. สั่งสร้างตั๋วรายใบ (Tickets) ทันทีโดยใช้ ID ที่เพิ่งได้มา
    // ส่ง savedEvent.id และข้อมูล zones ไปให้ TicketsService จัดการ
    await this.ticketsService.createMany(savedEvent.id, dto.zones);

    return savedEvent;
  }

  // 2. ดึงข้อมูลกิจกรรมทั้งหมด (เฉพาะที่ Active)
  async findAll(): Promise<Event[]> {
    return this.eventModel
      .find({ status: { $in: ['active', 'inactive'] } })
      .sort({ date: 1 })
      .exec();
  }

  // 3. ดึงข้อมูลกิจกรรมเดียว
  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมนี้');
    return event;
  }

  // 4. แก้ไขข้อมูลกิจกรรม (กำจัด any)
  // src/events/events.service.ts

  async update(id: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const oldEvent = await this.eventModel.findById(id).exec();
    if (!oldEvent) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการแก้ไข');

    // 1. จัดการเรื่องตั๋ว (Tickets) และชื่อโซน
    if (dto.zones) {
      for (const newZone of dto.zones) {
        const oldZone = oldEvent.zones.find(
          (z) => z._id.toString() === (newZone as any)._id?.toString(),
        );

        if (oldZone) {
          // กรณีโซนเดิม: เช็คเปลี่ยนชื่อ
          if (oldZone.name !== newZone.name) {
            await this.ticketsService.updateZoneName(id, oldZone.name, newZone.name);
          }

          // กรณีเปลี่ยนจำนวนที่นั่ง
          if (oldZone.totalSeats !== newZone.totalSeats) {
            const diff = newZone.totalSeats - oldZone.totalSeats;
            if (diff > 0) {
              await this.ticketsService.updateZoneSeats(id, newZone, oldZone.totalSeats, diff);
            } else {
              // กรณีลดที่นั่ง (ส่งค่าบวกของส่วนต่างไปลบออก)
              await this.ticketsService.removeAvailableTickets(id, newZone.name, Math.abs(diff));
            }
          }
        } else {
          // กรณีโซนใหม่
          await this.ticketsService.createMany(id, [newZone]);
        }
      }
    }

    // 2. เตรียมข้อมูลสำหรับอัปเดต Event (availableSeats)
    const updateData = { ...dto };
    if (updateData.zones) {
      updateData.zones = updateData.zones.map((zone) => {
        const oldZone = oldEvent.zones.find(
          (z) => z._id.toString() === (zone as any)._id?.toString(),
        );
        if (oldZone) {
          const diff = zone.totalSeats - oldZone.totalSeats;
          return { ...zone, availableSeats: oldZone.availableSeats + diff };
        }
        return { ...zone, availableSeats: zone.totalSeats };
      });
    }

    // 🎯 3. บันทึกและ Return (วางไว้ท้ายสุดเพื่อให้ TypeScript มั่นใจว่ามีการคืนค่าแน่นอน)
    const updatedEvent = await this.eventModel
      .findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' })
      .exec();

    if (!updatedEvent) throw new NotFoundException('อัปเดตข้อมูลล้มเหลว');

    return updatedEvent;
  }
  // 5. ลบกิจกรรม
  async remove(id: string) {
    const event = await this.eventModel.findById(id).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการลบ');

    // 🗑️ 1. ลบ Event หลัก
    await this.eventModel.findByIdAndDelete(id).exec();

    // 🗑️ 2. ลบ Tickets ทั้งหมดที่ผูกกับ Event นี้
    await this.ticketsService.deleteByEventMany(id);

    // 🗑️ 3. ลบ Bookings ทั้งหมดที่ผูกกับ Event นี้
    // แนะนำให้ไปสร้าง method deleteByEvent ใน BookingsService
    await this.bookingsService.deleteByEvent(id);

    return { message: 'ลบกิจกรรมและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ' };
  }
}
