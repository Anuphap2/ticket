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
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @ApiOperation({ summary: 'Get all events' })
  @ApiResponse({ status: 200, description: 'Return all events.' })
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload event image (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
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
          const fileName = event.imageUrl.split('/').pop();

          // 🎯 เช็คว่า fileName มีค่าจริงๆ ก่อนเอาไป join path
          if (fileName) {
            const filePath = join(process.cwd(), 'uploads', fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error ระหว่างลบไฟล์:', error.message);
      }
    }

    const baseUrl = process.env.BACKEND_URL;
    return {
      url: `${baseUrl}/uploads/${file.filename}`,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event (Admin only)' })
  @ApiResponse({ status: 201, description: 'Event created successfully.' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Return the event.' })
  @ApiResponse({ status: 404, description: 'Event not found.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event updated successfully.' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.eventsService.update(id, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event deleted successfully.' })
  @Roles('admin')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);
    if (event && event.imageUrl) {
      const fileName = event.imageUrl.split('/').pop();

      // 🎯 ใส่เช็ค fileName เหมือนกันครับ
      if (fileName) {
        const filePath = join(process.cwd(), 'uploads', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    return this.eventsService.remove(id);
  }
}
