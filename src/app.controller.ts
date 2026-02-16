// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  // 🎯 ลบ Constructor ที่มี AppService ออก เพราะเราไม่ได้ใช้แล้ว
  constructor() {}

  @Get('health')
  @ApiOperation({ summary: 'เช็คสถานะการทำงานของเซิร์ฟเวอร์' })
  @ApiResponse({ status: 200, description: 'Server is running normally.' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
