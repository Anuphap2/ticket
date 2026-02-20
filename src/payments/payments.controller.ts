// src/payments/payments.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Payments') // จัดกลุ่ม API ในหน้า Swagger
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth() // 🎯 ระบุว่าต้องใส่ Token ในหน้า Swagger เพื่อทดสอบ
  @ApiOperation({ summary: 'สร้างรายการชำระเงิน (Payment Intent)' })
  @ApiResponse({
    status: 201,
    description:
      'สร้าง Payment Intent สำเร็จ คืนค่า clientSecret สำหรับ Stripe',
  })
  @ApiResponse({
    status: 400,
    description: 'ข้อมูลไม่ถูกต้อง เช่น ยอดเงินน้อยกว่าหรือเท่ากับ 0',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token ไม่ถูกต้องหรือหมดอายุ',
  })
  @ApiBody({
    description: 'ข้อมูลสำหรับการสร้างยอดชำระเงิน',
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          example: 1000,
          description:
            'ยอดเงินที่ต้องการชำระ (หน่วยเป็นสตางค์ หรือตามที่ Stripe กำหนด)',
        },
      },
      required: ['amount'],
    },
  })
  @UseGuards(AccessTokenGuard) // 🎯 ล็อกไว้ให้เฉพาะผู้ที่ Login แล้วเท่านั้น
  @Post('create-intent')
  async create(@Body() body: { amount: number }) {
    // 1. ตรวจสอบความถูกต้องเบื้องต้น
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('ยอดเงินต้องมากกว่า 0');
    }

    // 2. เรียกใช้ Service เพื่อสร้าง Intent กับ Stripe
    // ระบบจะดึง API Key จาก ConfigService ให้อัตโนมัติใน Service
    return this.paymentsService.createPaymentIntent(body.amount);
  }
}
