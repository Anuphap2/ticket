/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import Stripe from 'stripe';
import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    // 🎯 ใช้ ConfigService ดึง Secret Key เพื่อความปลอดภัยและทดสอบง่าย
    const stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      throw new InternalServerErrorException(
        'STRIPE_SECRET_KEY not found in environment',
      );
    }
    // สร้าง Instance ของ Stripe ด้วย Secret Key
    this.stripe = new Stripe(stripeSecret);
  }

  onModuleInit() {
    console.log('✅ Stripe Payment Service initialized');
  }

  /**
   * สร้างรายการชำระเงินและส่งกลับ Client Secret ให้หน้าบ้านใช้ในการชำระเงิน
   */
  async createPaymentIntent(amount: number) {
    // 1. Validation
    if (amount <= 0) {
      throw new BadRequestException('ยอดเงินต้องมากกว่า 0');
    }

    try {
      // 2. ดำเนินการสร้าง Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // แปลงเป็นหน่วยสตางค์
        currency: 'thb',
        payment_method_types: ['card', 'promptpay'],
        metadata: {
          integration_check: 'accept_a_payment', // ใส่ metadata เผื่อใช้ตรวจสอบใน Stripe Dashboard
        },
      });

      // 3. ส่งคืนผลลัพธ์ในรูปแบบเดิมที่หน้าบ้านต้องการ
      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      // 🎯 จัดการ Error ให้ละเอียดขึ้นเพื่อให้ไล่ Bug ง่าย
      console.error('❌ Stripe Integration Error:', error.message);

      if (error.type === 'StripeCardError') {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('การเชื่อมต่อระบบชำระเงินขัดข้อง');
    }
  }
}
