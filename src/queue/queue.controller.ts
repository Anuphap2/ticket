import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto } from './dto/create-queue.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

// 🎯 นำเข้า Swagger Decorators
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody
} from '@nestjs/swagger';

@ApiTags('Queue') // จัดกลุ่ม API ในหน้า Swagger
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) { }

  @ApiBearerAuth() // ระบุว่าต้องใช้ Token
  @ApiOperation({ summary: 'กดเพื่อเข้าคิวรอจองตั๋ว' })
  @ApiResponse({ status: 201, description: 'เข้าร่วมคิวสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Token ไม่ถูกต้อง' })
  @ApiBody({ type: CreateQueueDto })
  @UseGuards(AccessTokenGuard)
  @Post('join')
  create(@Req() req: any, @Body() createQueueDto: CreateQueueDto) {
    const userId = req.user.sub; // ดึง ID จาก token
    return this.queueService.create(userId, createQueueDto.eventId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'เช็คสถานะและลำดับคิวของตัวเอง' })
  @ApiResponse({ status: 200, description: 'คืนค่าข้อมูลสถานะคิวและลำดับที่' })
  @ApiParam({ name: 'eventId', description: 'ID ของกิจกรรมที่เข้าคิวไว้' })
  @UseGuards(AccessTokenGuard)
  @Get('status/:eventId')
  findOne(@Req() req: any, @Param('eventId') eventId: string) {
    const userId = req.user.sub; //
    return this.queueService.findOneByUser(userId, eventId);
  }
}
