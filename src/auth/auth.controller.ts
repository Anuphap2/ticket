import {
  Controller,
  Body,
  Post,
  UseGuards,
  Req,
  Get,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from 'src/users/users.service';
import { UserDto } from 'src/users/dto/user.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';

// 🎯 นำเข้า Swagger Decorators
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Auth') // จัดกลุ่ม API
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'ลงทะเบียนผู้ใช้ใหม่ (Signup)' })
  @ApiResponse({ status: 201, description: 'ลงทะเบียนสำเร็จ' })
  @ApiResponse({ status: 400, description: 'ข้อมูลไม่ถูกต้อง หรืออีเมลซ้ำ' })
  @ApiBody({ type: UserDto })
  @Post('signup')
  signUp(@Body() dto: UserDto) {
    return this.authService.signUp(dto);
  }

  @ApiOperation({ summary: 'เข้าสู่ระบบ (Login)' })
  @ApiResponse({
    status: 200,
    description: 'เข้าสู่ระบบสำเร็จ คืนค่า Access Token และ Refresh Token',
  })
  @ApiResponse({ status: 401, description: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
  @ApiBody({ type: AuthDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // จำกัด Brute Force
  @Post('signin')
  signIn(@Body() dto: AuthDto) {
    return this.authService.signIn(dto);
  }

  @ApiBearerAuth() // 🎯 ระบุว่าต้องใส่ Token ใน Swagger
  @ApiOperation({ summary: 'ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน' })
  @ApiResponse({ status: 200, description: 'คืนค่าข้อมูลโปรไฟล์' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Token ไม่ถูกต้องหรือหมดอายุ',
  })
  @UseGuards(AccessTokenGuard)
  @Get('profile')
  async getProfile(@Req() req) {
    const userId = req.user.sub;
    const user = await this.usersService.findProfileById(userId);
    return user;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'อัปเดตข้อมูลโปรไฟล์' })
  @ApiResponse({ status: 200, description: 'อัปเดตข้อมูลสำเร็จ' })
  @ApiBody({ type: UpdateUserDto })
  @UseGuards(AccessTokenGuard)
  @Patch('profile')
  async updateProfile(@Req() req, @Body() dto: UpdateUserDto) {
    const userId = req.user.sub;
    return this.usersService.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'ขอ Access Token ใหม่ด้วย Refresh Token' })
  @ApiResponse({ status: 200, description: 'คืนค่าชุด Token ใหม่' })
  @ApiResponse({ status: 401, description: 'Refresh Token ไม่ถูกต้อง' })
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refresh(@Req() req: any) {
    const { sub: userId, email, role, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, role, refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'ออกจากระบบ (Logout)' })
  @ApiResponse({
    status: 200,
    description: 'ออกจากระบบสำเร็จ และยกเลิก Refresh Token',
  })
  @UseGuards(AccessTokenGuard)
  @Get('logout')
  logout(@Req() req: any) {
    const userId = req.user.sub || req.user.userId;
    return this.authService.logout(userId);
  }
}
