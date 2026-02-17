// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { BookingsModule } from './bookings/bookings.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsModule } from './payments/payments.module';
import { TicketsModule } from './tickets/tickets.module';
@Module({
  imports: [
    // 1. ตั้งค่า Config แบบ Global
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. เชื่อมต่อฐานข้อมูลโดยดึงค่าจาก Environment
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DB'),
      }),
      inject: [ConfigService],
    }),

    // 3. รวม Modules ทั้งหมด
    AuthModule,
    UsersModule,
    EventsModule,
    BookingsModule,
    PaymentsModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
