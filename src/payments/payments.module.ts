// src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule], // 🎯 ต้อง Import เข้ามาเพื่อให้ใช้ BookingService ได้ (ถ้ามี Logic เกี่ยวข้องกัน)
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
