import { Controller, Body, Post, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
// import { AuthGuard } from '@nestjs/passport';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signup')
  signUp(@Body() dto: AuthDto) {
    return this.authService.signUp(dto);
  }

  // จำกัดการยิง signin เพื่อลด brute force
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signin')
  signIn(@Body() dto: AuthDto) {
    return this.authService.signIn(dto);
  }

  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return req.user;
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refresh(@Req() req: any) {
    const { sub: userId, email, role, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, role, refreshToken);
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.userId);
  }

}
