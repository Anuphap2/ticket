import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { AuthDto } from './dto/auth.dto';

import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
  private async signTokens(user: { id: string; email: string; role: string }) {
    const accessSecret = this.config.getOrThrow<string>(
      'JWT_ACCESS_TOKEN_SECRET',
    );
    const refreshSecret = this.config.getOrThrow<string>(
      'JWT_REFRESH_TOKEN_SECRET',
    );

    const accessExp = parseInt(
      this.config.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') ?? '900',
      10,
    );
    const refreshExp = parseInt(
      this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '604800',
      10,
    );

    const payload = { sub: user.id, email: user.email, role: user.role };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExp,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExp,
      }),
    ]);

    return { access_token, refresh_token };
  }

  private async storeRefreshHash(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken);
    await this.userService.setRefreshTokenHash(userId, hash);
  }

  async signToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const token = await this.jwtService.signAsync(payload);

    return { access_token: token };
  }

  async signUp(dto: AuthDto) {
    const email = this.normalizeEmail(dto.email);
    const userExists = await this.userService.findByEmail(email);

    if (userExists) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    const newUser = await this.userService.create({
      email,
      passwordHash,
    });

    const tokens = await this.signTokens({
      id: String(newUser._id),
      email: newUser.email,
      role: newUser.role,
    });

    await this.storeRefreshHash(newUser._id.toString(), tokens.refresh_token);

    return tokens;
  }

  async signIn(dto: AuthDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userService.findByEmailWithSecrets(email);

    if (!user)
      throw new UnauthorizedException('Email or password is incorrect');

    const passwordMatch = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const tokens = await this.signTokens({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });

    await this.storeRefreshHash(user._id.toString(), tokens.refresh_token);
    return tokens;
  }

  async refreshTokens(
    userId: string,
    email: string,
    role: string,
    refreshToken: string,
  ) {
    if (!refreshToken) throw new ForbiddenException('Access denied');

    const user = await this.userService.findByIdWithRefresh(userId);
    if (!user?.refreshTokenHash) throw new ForbiddenException('Access denied');

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) throw new ForbiddenException('Access denied');

    const tokens = await this.signTokens({ id: userId, email, role });

    // Rotation: refresh token ใหม่ต้องถูกเก็บ hash ใหม่ทับตัวเก่า
    await this.storeRefreshHash(userId, tokens.refresh_token);

    return tokens;
  }

  async logout(userId: string) {
    await this.userService.setRefreshTokenHash(userId, null);
    return { success: true };
  }
}
