/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    // 1. โหลด ConfigModule เพื่อให้อ่าน .env ได้
    ConfigModule.forRoot({
      isGlobal: true, // ทำให้ใช้ได้ทุก Module โดยไม่ต้อง import ซ้ำ
    }),

    // 2. ใช้ forRootAsync เพื่อรอให้ ConfigService โหลดค่าเสร็จก่อน
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DB'), // ดึงค่าจากตัวแปร DB ใน .env
      }),
    }),
    AuthModule,
    EventsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
