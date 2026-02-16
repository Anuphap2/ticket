import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard'; // 🎯 นำเข้า Guard
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth() // 🎯 บอก Swagger ว่าต้องใช้ Token
  @ApiOperation({ summary: 'Create payment intent' })
  @ApiResponse({ status: 201, description: 'Payment intent created.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 1000 },
      },
      required: ['amount'],
    },
  })
  @UseGuards(AccessTokenGuard) // 🎯 ล็อกไว้ให้เฉพาะคนที่ Login แล้วเท่านั้นที่สร้างยอดจ่ายเงินได้
  @Post('create-intent')
  async create(@Body() body: { amount: number }) {
    // ตรวจสอบความถูกต้องเบื้องต้น
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('ยอดเงินต้องมากกว่า 0');
    }

    // เรียกใช้ Service ที่เรา Refactor ไว้แล้ว (ซึ่งใช้ ConfigService และจัดการ Error ไว้ดีแล้ว)
    return this.paymentsService.createPaymentIntent(body.amount);
  }
}
