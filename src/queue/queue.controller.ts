import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { QueueService } from './queue.service'; // เช็คชื่อไฟล์ดีๆ นะครับว่า queue หรือ queues
import { CreateQueueDto } from './dto/create-queue.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // 1. กดเพื่อเข้าคิว
  @UseGuards(AccessTokenGuard)
  @Post('join')
  create(@Req() req: any, @Body() createQueueDto: CreateQueueDto) {
    const userId = req.user.sub; // ดึง ID จาก token
    return this.queueService.create(userId, createQueueDto.eventId);
  }

  // 2. เช็คสถานะคิวของตัวเอง
  @UseGuards(AccessTokenGuard)
  @Get('status/:eventId')
  findOne(@Req() req: any, @Param('eventId') eventId: string) {
    const userId = req.user.sub;
    return this.queueService.findOneByUser(userId, eventId);
  }

  // หมายเหตุ: ฟังก์ชัน findAll, update, remove ลบทิ้งไปก่อนได้ครับ
  // เพราะระบบคิวเราเน้นแค่ "เข้าคิว" กับ "เช็คอันดับ"
}
