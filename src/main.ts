import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
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
      forbidNonWhitelisted: false, // เพิ่มตัวนี้เข้าไปเพื่อความปลอดภัย
      transform: true,
    }),
  );
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // เข้าดูได้ที่ http://localhost:3000/api/docs
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
