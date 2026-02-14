/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  Query, // เพิ่ม Query สำหรับรับ eventId
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs'; // เพิ่ม fs สำหรับลบไฟล์
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  // 2. อัปโหลดรูปภาพ (Admin Only) + ลบรูปเก่าถ้าเป็นการแก้ไข
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post('upload')
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
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
          return cb(
            new BadRequestException('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('eventId') eventId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');
    }

    if (eventId) {
      try {
        const event = await this.eventsService.findOne(eventId);

        if (event && event.imageUrl) {
          // 1. แกะชื่อไฟล์ออกมา (รองรับทั้ง URL เต็ม หรือแค่ชื่อไฟล์)
          const fileName = event.imageUrl.split('/').pop();

          // 2. สร้าง Path แบบ Absolute เพื่อความแม่นยำ
          // ใช้ __dirname หรือ process.cwd() ให้ถูกจุด
          const filePath = join(process.cwd(), 'uploads', fileName);

          console.log('🔍 กำลังตรวจสอบการลบไฟล์:');
          console.log('- Event ID:', eventId);
          console.log('- Old URL:', event.imageUrl);
          console.log('- Full Path:', filePath);

          // 3. ตรวจสอบก่อนลบ
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('✅ ลบรูปภาพเก่าเรียบร้อย!');
          } else {
            console.warn('⚠️ ตรวจพบ Path แต่ไม่พบไฟล์จริงในโฟลเดอร์ uploads');
          }
        } else {
          console.log('ℹ️ ไม่พบรูปภาพเดิมในระบบ (อาจเป็นการลงรูปครั้งแรก)');
        }
      } catch (error) {
        console.error('❌ Error ระหว่างลบไฟล์:', error.message);
      }
    }

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    return {
      url: `${baseUrl}/uploads/${file.filename}`,
    };
  }

  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.eventsService.update(id, dto);
  }

  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    // แถม: ตอนลบ Event ก็ควรลบรูปทิ้งด้วยนะพู่กัน!
    const event = await this.eventsService.findOne(id);
    if (event && event.imageUrl) {
      const fileName = event.imageUrl.split('/').pop();
      const filePath = join(process.cwd(), 'uploads', fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    return this.eventsService.remove(id);
  }
}
