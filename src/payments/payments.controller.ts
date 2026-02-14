
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('create-intent')
    create(@Body() body: { amount: number }) {
        return this.paymentsService.createPaymentIntent(body.amount);
    }
}
