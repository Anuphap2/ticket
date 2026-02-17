// src/events/events.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { TicketsService } from 'src/tickets/tickets.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private ticketsService: TicketsService,
  ) {}

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
    return this.eventModel.find({ status: 'active' }).sort({ date: 1 }).exec();
  }

  // 3. ดึงข้อมูลกิจกรรมเดียว
  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมนี้');
    return event;
  }

  // 4. แก้ไขข้อมูลกิจกรรม (กำจัด any)
  async update(id: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const updateData = { ...dto };

    if (updateData.zones) {
      updateData.zones = updateData.zones.map((zone) => ({
        ...zone,
        // ถ้าเป็นโซนใหม่ให้ใช้ totalSeats ถ้ามี availableSeats เดิมอยู่แล้วให้คงไว้
        availableSeats: zone.availableSeats ?? zone.totalSeats,
      }));
    }

    const updatedEvent = await this.eventModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    if (!updatedEvent)
      throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการแก้ไข');
    return updatedEvent;
  }

  // 5. ลบกิจกรรม
  async remove(id: string) {
    const result = await this.eventModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการลบ');
    return { message: 'ลบกิจกรรมสำเร็จ' };
  }
}
