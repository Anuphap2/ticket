/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  // 1. สร้างกิจกรรมใหม่
  async create(dto: CreateEventDto): Promise<Event> {
    const eventData = {
      ...dto, // 🎯 ใช้การกระจายค่า dto แบบนี้จะทำให้ field 'seats' ถูกส่งไปด้วย
      zones: dto.zones.map((zone) => ({
        ...zone,
        availableSeats: zone.totalSeats,
      })),
    };

    return new this.eventModel(eventData).save();
  }

  // 2. ดึงข้อมูลกิจกรรมทั้งหมด (เอาเฉพาะที่กำลัง Active)
  async findAll(): Promise<Event[]> {
    return this.eventModel.find({ status: 'active' }).sort({ date: 1 }).exec();
    // .sort({ date: 1 }) คือเรียงจากวันที่ใกล้สุดมาหาไกลสุด
  }

  // 3. ดึงข้อมูลกิจกรรมเดียว
  async findOne(id: string): Promise<Event> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) throw new NotFoundException('ไม่พบกิจกรรมนี้');
    return event;
  }

  // 4. แก้ไขข้อมูลกิจกรรม
  async update(id: string, dto: any): Promise<Event> {
    // 🎯 ถ้ามีการแก้ zones เราต้องคำนวณ availableSeats ใหม่ (กรณีเพิ่ม/ลด totalSeats)
    if (dto.zones) {
      dto.zones = dto.zones.map((zone) => ({
        ...zone,
        // ถ้าเป็นของใหม่ที่ยังไม่มี availableSeats ให้ตั้งค่าเริ่มต้น
        availableSeats: zone.availableSeats ?? zone.totalSeats,
      }));
    }

    const updatedEvent = await this.eventModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();

    if (!updatedEvent)
      throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการแก้ไข');
    return updatedEvent;
  }

  // 5. ลบกิจกรรม (หรือเปลี่ยนสถานะเป็น deleted แทนการลบจริง)
  async remove(id: string) {
    const result = await this.eventModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการลบ');
    return { message: 'ลบกิจกรรมสำเร็จ' };
  }
}
