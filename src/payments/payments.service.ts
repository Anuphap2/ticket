import Stripe from 'stripe';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class PaymentsService implements OnModuleInit {
  // 1. ใส่ ! เพื่อยืนยันว่าเราจะมีค่าแน่นอน (Non-null assertion)
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  onModuleInit() {
    // 2. console.log ต้องอยู่ในฟังก์ชัน (เช่น Hook ของ NestJS)
    // ระวัง: เวลาขึ้นงานจริงไม่ควร log key ออกมานะเพื่อน อันนี้เราไว้เช็คตอน dev
    console.log('✅ Stripe initialized successfully');
  }

  async createPaymentIntent(amount: number) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'thb',
        payment_method_types: ['card', 'promptpay'],
      });

      // ส่งกลับไปเฉพาะ clientSecret ในรูปแบบที่หน้าบ้านเรียกใช้
      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      console.error('Stripe Error:', error.message);
      throw error;
    }
  }
}
