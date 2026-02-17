import { Controller, Body, Post, UseGuards, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
// import { AuthGuard } from '@nestjs/passport';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserDto } from 'src/users/dto/user.dto';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiBody({ type: UserDto })
  @Post('signup')
  signUp(@Body() dto: UserDto) {
    return this.authService.signUp(dto);
  }

  // จำกัดการยิง signin เพื่อลด brute force
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBody({ type: AuthDto })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signin')
  signIn(@Body() dto: AuthDto) {
    return this.authService.signIn(dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Return user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(AccessTokenGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return req.user;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Return new tokens.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  refresh(@Req() req: any) {
    const { sub: userId, email, role, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, role, refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User successfully logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(AccessTokenGuard)
  @Get('logout')
  logout(@Req() req: any) {
    const userId = req.user.sub || req.user.userId;
    return this.authService.logout(userId);
  }
}
