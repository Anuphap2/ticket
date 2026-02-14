/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from './schema/event.schema';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    // ตั้งค่า availableSeats ให้เท่ากับ totalSeats ตอนเริ่มต้น
    const eventData = {
      ...dto,
      zones: dto.zones.map((zone) => ({
        ...zone,
        availableSeats: zone.totalSeats,
      })),
    };
    const newEvent = new this.eventModel(eventData);
    return newEvent.save();
  }

  async findAll(): Promise<Event[]> {
    return this.eventModel.find({ status: 'active' }).exec();
  }

  async findOne(id: string): Promise<any> {
    return this.eventModel.findById(id).exec();
  }

  // แก้ไขข้อมูล (เช่น เปลี่ยนวันที่ หรืออัปเดตราคา)
  async update(id: string, dto: any): Promise<any> {
    return this.eventModel.findByIdAndUpdate(id, dto, { new: true }).exec();
  }

  // ลบอีเวนต์
  async remove(id: string) {
    return this.eventModel.findByIdAndDelete(id).exec();
  }
}
