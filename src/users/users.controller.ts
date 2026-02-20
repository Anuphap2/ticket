import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// 🎯 นำเข้า Swagger Decorators
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Users') // จัดกลุ่ม API ในหน้า Swagger
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth() // 🎯 ระบุว่าต้องใช้ Token ในหน้า Swagger
  @ApiOperation({ summary: 'ดึงข้อมูลผู้ใช้ทั้งหมด (Admin Only)' })
  @ApiResponse({
    status: 200,
    description: 'คืนค่ารายการผู้ใช้ทั้งหมดสำเร็จ',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token ไม่ถูกต้องหรือหมดอายุ',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ไม่มีสิทธิ์เข้าถึง (ต้องเป็น Admin เท่านั้น)',
  })
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }
}
