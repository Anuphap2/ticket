/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import Stripe from 'stripe';
import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  onModuleInit() {
    console.log('✅ Stripe initialized successfully');
  }

  async createPaymentIntent(amount: number) {
    // 🎯 เพิ่มดัก Error ตรงนี้
    if (amount <= 0) {
      throw new BadRequestException('ยอดเงินต้องมากกว่า 0');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'thb',
        payment_method_types: ['card', 'promptpay'],
      });
      return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
      console.error('Stripe Error:', error.message);
      throw error;
    }
  }
}
