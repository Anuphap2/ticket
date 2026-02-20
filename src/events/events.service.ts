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
  async update(id: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const oldEvent = await this.eventModel.findById(id).exec();
    if (!oldEvent) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการแก้ไข');

    console.log(id);
    if (dto.zones) {
      for (const newZone of dto.zones) {
        // 1. ตรวจสอบว่าเป็นโซนที่มีอยู่เดิม หรือเป็นโซนใหม่
        const oldZone = oldEvent.zones.find(
          (z) => z._id.toString() === (newZone as any)._id?.toString(),
        );

        if (oldZone) {
          // 🎯 กรณีที่ 1: โซนเดิม (เช็คเปลี่ยนชื่อ)
          if (oldZone.name !== newZone.name) {
            console.log(
              `กำลังเปลี่ยนชื่อโซนจาก ${oldZone.name} เป็น ${newZone.name}`,
            );
            await this.ticketsService.updateZoneName(
              id,
              oldZone.name,
              newZone.name,
            );
          }

          if (oldZone.totalSeats !== newZone.totalSeats) {
            console.log(
              `กำลังอัปเดตจำนวนที่นั่งในโซน ${newZone.name} จาก ${oldZone.totalSeats} เป็น ${newZone.totalSeats}`,
            );
            await this.ticketsService.updateZoneSeats(
              id,
              newZone,
              oldZone.totalSeats,
              newZone.totalSeats - oldZone.totalSeats,
            );
          }
        } else {
          // 🎯 กรณีที่ 2: โซนใหม่ (ยังไม่มีใน DB)
          // ต้องสั่งสร้างตั๋วรายใบสำหรับโซนใหม่นี้ทันที
          console.log(`พบโซนใหม่: ${newZone.name} กำลังสร้างตั๋วเพิ่ม...`);

          // เราส่งเป็น Array ของโซนเดียวเข้าไปให้ createMany จัดการ
          await this.ticketsService.createMany(id, [newZone]);
        }
      }
    }

    // 3. เตรียมข้อมูลสำหรับอัปเดต Event
    const updateData = { ...dto };
    if (updateData.zones) {
      updateData.zones = updateData.zones.map((zone) => ({
        ...zone,
        // ถ้าเป็นโซนใหม่ให้ค่า availableSeats เท่ากับ totalSeats
        availableSeats: zone.availableSeats ?? zone.totalSeats,
      }));
    }

    const updatedEvent = await this.eventModel
      .findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' })
      .exec();

    return updatedEvent!;
  }
  // 5. ลบกิจกรรม
  async remove(id: string) {
    const result = await this.eventModel.findByIdAndDelete(id).exec();
    const deleteTicketsResult = await this.ticketsService.deleteByEventMany(id);
    if (!result) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการลบ');
    return { message: 'ลบกิจกรรมสำเร็จ' };
  }
}
