import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  // Mock ข้อมูลและฟังก์ชันต่างๆ
  const mockUsersService = {
    findByEmail: jest.fn(),
    findByEmailWithSecrets: jest.fn(),
    create: jest.fn(),
    setRefreshTokenHash: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_TOKEN_EXPIRATION') return '900';
      if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '604800';
      return 'test_secret';
    }),
    getOrThrow: jest.fn(() => 'test_secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('ควรจะ throw BadRequestException ถ้า email ถูกใช้ไปแล้ว', async () => {
      const dto = { email: 'test@test.com', password: 'password123' };
      mockUsersService.findByEmail.mockResolvedValue({ email: dto.email });

      await expect(service.signUp(dto)).rejects.toThrow(BadRequestException);
    });

    it('ควรจะสร้าง user และคืนค่า tokens ถ้าข้อมูลถูกต้อง', async () => {
      const dto = { email: 'new@test.com', password: 'password123' };
      const newUser = { _id: 'mockId', email: dto.email, role: 'user' };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(newUser);
      mockJwtService.signAsync.mockResolvedValue('mockToken');

      const result = await service.signUp(dto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUsersService.create).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('ควรจะ throw UnauthorizedException ถ้าไม่พบ user', async () => {
      const dto = { email: 'wrong@test.com', password: 'password123' };
      mockUsersService.findByEmailWithSecrets.mockResolvedValue(null);

      await expect(service.signIn(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('ควรจะคืนค่า tokens ถ้า email และ password ถูกต้อง', async () => {
      const dto = { email: 'user@test.com', password: 'correctPassword' };
      const hashedPassword = await argon2.hash(dto.password);
      const user = { _id: 'mockId', email: dto.email, role: 'user', passwordHash: hashedPassword };

      mockUsersService.findByEmailWithSecrets.mockResolvedValue(user);
      mockJwtService.signAsync.mockResolvedValue('mockToken');

      const result = await service.signIn(dto);

      expect(result).toHaveProperty('access_token');
      expect(mockUsersService.setRefreshTokenHash).toHaveBeenCalled();
    });
  });
});