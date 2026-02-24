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
import { ConfigService } from '@nestjs/config';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'ดึงข้อมูลกิจกรรมทั้งหมด' })
  @ApiResponse({ status: 200, description: 'คืนค่ารายการกิจกรรมทั้งหมดสำเร็จ'})
  findAll() {
    return this.eventsService.findAll();
  }

  // ---------------- UPLOAD IMAGE ----------------
  @Post('upload')
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'อัปโหลดรูปภาพกิจกรรม (Admin Only)' })
  @ApiConsumes('multipart/form-data')// 🎯 สำคัญ: ทำให้ Swagger แสดงปุ่ม Browse ไฟล์
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
   @ApiQuery({
    name: 'eventId',
    required: false,
    description: 'ID ของกิจกรรมที่ต้องการลบรูปภาพเก่าทิ้ง',
  })
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
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');

    const baseUrl =
      this.configService.get<string>('BACKEND_URL') ||
      'http://localhost:3000';

    return { url: `${baseUrl}/uploads/${file.filename}` };
  }

  // ---------------- CREATE EVENT ----------------
  @Post()
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'สร้างกิจกรรมใหม่ (Admin Only)' })
  @ApiResponse({ status: 201, description: 'สร้างกิจกรรมสำเร็จ' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  // ---------------- UPDATE EVENT ----------------
  @Patch(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'แก้ไขข้อมูลกิจกรรม (Admin Only)' })
  @ApiResponse({ status: 200, description: 'อัปเดตข้อมูลสำเร็จ' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEventDto>,
  ) {
    const event = await this.eventsService.findOne(id);

    // ✅ ลบรูปเก่า "เฉพาะตอนเปลี่ยนรูปจริงๆ"
  if (
  typeof dto.imageUrl === 'string' &&
  dto.imageUrl.length > 0 &&
  event.imageUrl &&
  dto.imageUrl !== event.imageUrl) {
  this.removeImageByUrl(event.imageUrl);
}

    return this.eventsService.update(id, dto);
  }

  // ---------------- DELETE EVENT ----------------
  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'ลบกิจกรรม (Admin Only)' })
  @ApiResponse({ status: 200, description: 'ลบกิจกรรมสำเร็จ' })
  async remove(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);

    if (event?.imageUrl) {
      this.removeImageByUrl(event.imageUrl);
    }

    return this.eventsService.remove(id);
  }

  // ---------------- FIND ONE ----------------
  @Get(':id')
  @ApiOperation({ summary: 'ดึงข้อมูลกิจกรรมรายรายการ' })
  @ApiResponse({ status: 200, description: 'คืนค่าข้อมูลกิจกรรม' })
  @ApiResponse({ status: 404, description: 'ไม่พบกิจกรรมที่ระบุ' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  // ---------------- HELPER ----------------
  private removeImageByUrl(imageUrl?: string) {
    if (!imageUrl) return;

    const fileName = imageUrl.split('/').pop();
    if (!fileName) return;

    const filePath = join(process.cwd(), 'uploads', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ ลบไฟล์รูปภาพเก่าเรียบร้อย: ${fileName}`);
    }
  }
}