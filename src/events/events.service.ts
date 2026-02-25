// src/events/events.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
  // src/events/events.service.ts

  async update(id: string, dto: Partial<CreateEventDto>): Promise<Event> {
    const oldEvent = await this.eventModel.findById(id).exec();
    if (!oldEvent) throw new NotFoundException('ไม่พบกิจกรรมที่ต้องการแก้ไข');

    const updateData = { ...dto };

    if (dto.zones) {
      // ใช้ Promise.all เพื่อให้ทำงานเร็วขึ้นและจัดการ async ภายใน map
      updateData.zones = await Promise.all(
        dto.zones.map(async (newZone) => {
          const oldZone = oldEvent.zones.find(
            (z) => z._id.toString() === (newZone as any)._id?.toString(),
          );

          if (oldZone) {
            // 🎯 1. ดึงจำนวนตั๋วที่ไม่ว่าง (reserved + sold) ของโซนนี้
            const bookedCount = await this.ticketsService.countBookedTickets(
              id,
              oldZone.name,
            );

            // 🎯 2. เช็คว่าชื่อโซนเปลี่ยนไหม ถ้าเปลี่ยนต้องย้ายชื่อใน Tickets ด้วย
            if (oldZone.name !== newZone.name) {
              await this.ticketsService.updateZoneName(
                id,
                oldZone.name,
                newZone.name,
              );
            }

            // 🎯 3. จัดการเรื่องจำนวนที่นั่ง
            if (oldZone.totalSeats !== newZone.totalSeats) {
              const diff = newZone.totalSeats - oldZone.totalSeats;

              if (diff > 0) {
                // เพิ่มที่นั่ง: สร้างตั๋วเพิ่มตามส่วนต่าง
                await this.ticketsService.updateZoneSeats(
                  id,
                  newZone,
                  oldZone.totalSeats,
                  diff,
                );
              } else {
                // ลดที่นั่ง:
                // เช็คก่อนว่าจำนวนใหม่ (newTotalSeats) ต้องไม่น้อยกว่าจำนวนที่จองไปแล้ว (bookedCount)
                if (newZone.totalSeats < bookedCount) {
                  throw new BadRequestException(
                    `โซน ${oldZone.name} ไม่สามารถลดที่นั่งให้เหลือ ${newZone.totalSeats} ได้ เพราะมีการจองไปแล้ว ${bookedCount} ที่นั่ง`,
                  );
                }
                // ลบตั๋วที่ยังว่าง (available) ออกตามส่วนต่าง
                await this.ticketsService.removeAvailableTickets(
                  id,
                  newZone.name,
                  Math.abs(diff),
                );
              }
            }

            // 🎯 4. คำนวณ availableSeats ใหม่ให้แม่นยำ
            // สูตร: ที่นั่งที่เหลือ = ทั้งหมดใหม่ - ที่จองไปแล้ว
            return {
              ...newZone,
              availableSeats: newZone.totalSeats - bookedCount,
            };
          } else {
            // กรณีเพิ่มโซนใหม่เอี่ยม
            await this.ticketsService.createMany(id, [newZone]);
            return { ...newZone, availableSeats: newZone.totalSeats };
          }
        }),
      );
    }

    try {
  const updatedEvent = await this.eventModel
    .findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        returnDocument: 'after',
        runValidators: true,
        context: 'query',
      },
    )
    .exec();
    if (!updatedEvent) throw new NotFoundException('อัปเดตข้อมูลล้มเหลว');
    return updatedEvent;
    } catch (error) {
    // ⭐ ดัก ValidationError จาก mongoose
    if (error.name === 'ValidationError') {
      throw new BadRequestException(
        'price must be at least 100',
      );
    }

    throw error;
  }
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
