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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // 1. ดูรายการกิจกรรมทั้งหมด (Public)
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  // 2. อัปโหลดรูปภาพ (Admin Only)
  // หน้าบ้านต้องส่งไฟล์มาใน Key ชื่อ 'file'
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
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');
    }
    // ส่ง URL กลับไปเพื่อให้หน้าบ้านนำไปใช้ใน Create/Update Event
    return {
      url: `http://localhost:3000/uploads/${file.filename}`,
    };
  }

  // 3. สร้างกิจกรรม (Admin Only)
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  // 4. ดูรายละเอียดกิจกรรมรายตัว (Public)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  // 5. แก้ไขกิจกรรม (Admin Only)
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.eventsService.update(id, dto);
  }

  // 6. ลบกิจกรรม (Admin Only)
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
