import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
async function bootstrap() {
  // 🎯 เพิ่ม <NestExpressApplication> หลัง .create
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // ตั้งค่า Limit ตรงนี้(ปรับขนาด 50mb ตามความเหมาะสม)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // ตอนนี้ TypeScript จะไม่ฟ้อง Error แล้วครับ
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Ticket Booking API')
    .setDescription('The Ticket Booking API with DSA Queue System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
