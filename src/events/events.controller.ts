// src/events/events.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Post('upload')
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('eventId') eventId?: string,
  ) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');

    // ถ้ามีการส่ง eventId มาพร้อมการอัพโหลด (เช่น หน้าแก้ไข) ให้ลบรูปเก่าทิ้งก่อน
    if (eventId) {
      await this.handleOldImageCleanup(eventId);
    }

    const baseUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    return { url: `${baseUrl}/uploads/${file.filename}` };
  }

  @Post()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateEventDto>) {
    // 🎯 แก้ไขให้รูปทับของเก่า: ถ้ามีการอัปเดต URL รูปภาพใหม่ ให้ลบไฟล์รูปเก่าในเครื่องทิ้ง
    if (dto.imageUrl) {
      await this.handleOldImageCleanup(id);
    }
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    // 🎯 ตอนลบข้อมูลให้ลบรูปไปด้วย: ลบไฟล์ในเครื่องก่อนลบข้อมูลใน DB
    await this.handleOldImageCleanup(id);
    return this.eventsService.remove(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  /**
   * Helper สำหรับลบไฟล์รูปภาพออกจากโฟลเดอร์ uploads
   */
  private async handleOldImageCleanup(eventId: string) {
    try {
      const event = await this.eventsService.findOne(eventId);
      if (event?.imageUrl) {
        const fileName = event.imageUrl.split('/').pop();
        if (fileName) {
          const filePath = join(process.cwd(), 'uploads', fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ ลบไฟล์รูปภาพเก่าเรียบร้อย: ${fileName}`);
          }
        }
      }
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
  }
}
