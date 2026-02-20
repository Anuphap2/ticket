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
import { ConfigService } from '@nestjs/config';

// 🎯 นำเข้า Swagger Decorators ทั้งหมดที่จำเป็น
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Events') // จัดกลุ่ม API ในหน้า Swagger
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'ดึงข้อมูลกิจกรรมทั้งหมด' })
  @ApiResponse({ status: 200, description: 'คืนค่ารายการกิจกรรมทั้งหมดสำเร็จ' })
  findAll() {
    return this.eventsService.findAll();
  }

  @Post('upload')
  @ApiBearerAuth() // ระบุว่าต้องใช้ Token
  @Roles('admin') // จำกัดสิทธิ์เฉพาะ Admin
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'อัปโหลดรูปภาพกิจกรรม (Admin Only)' })
  @ApiConsumes('multipart/form-data') // 🎯 สำคัญ: ทำให้ Swagger แสดงปุ่ม Browse ไฟล์
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary', // กำหนดเป็นไฟล์ Binary
        },
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
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('eventId') eventId?: string,
  ) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');

    if (eventId) {
      await this.handleOldImageCleanup(eventId);
    }

    const baseUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    return { url: `${baseUrl}/uploads/${file.filename}` };
  }

  @Post()
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'สร้างกิจกรรมใหม่ (Admin Only)' })
  @ApiResponse({ status: 201, description: 'สร้างกิจกรรมสำเร็จ' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'แก้ไขข้อมูลกิจกรรม (Admin Only)' })
  @ApiResponse({ status: 200, description: 'อัปเดตข้อมูลสำเร็จ' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateEventDto>) {
    if (dto.imageUrl) {
      await this.handleOldImageCleanup(id);
    }
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @ApiOperation({ summary: 'ลบกิจกรรม (Admin Only)' })
  @ApiResponse({ status: 200, description: 'ลบข้อมูลและไฟล์รูปภาพสำเร็จ' })
  async remove(@Param('id') id: string) {
    await this.handleOldImageCleanup(id);
    return this.eventsService.remove(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดึงข้อมูลกิจกรรมรายรายการ' })
  @ApiResponse({ status: 200, description: 'คืนค่าข้อมูลกิจกรรม' })
  @ApiResponse({ status: 404, description: 'ไม่พบกิจกรรมที่ระบุ' })
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
