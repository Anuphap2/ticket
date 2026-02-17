/* eslint-disable @typescript-eslint/no-var-requires */

// 🎯 แก้จุดนี้ครับ: ใช้ Relative Path ถอยหลังออกไปหา DTO จริงๆ
// เพื่อให้ Jest รู้จักตำแหน่งไฟล์ก่อนจะทำการ Mock
jest.mock('../users/dto/user.dto', () => ({
  UserDto: class {},
}));

// และหลอกเพิ่มอีกชั้นว่าถ้าใครเรียก 'src/...' ให้เอาตัวข้างบนไปใช้
jest.mock('src/users/dto/user.dto', () => require('../users/dto/user.dto'), { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signUp: jest.fn().mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
    signIn: jest.fn().mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
    refreshTokens: jest.fn().mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
    logout: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signUp', () => {
    it('ควรเรียกใช้ authService.signUp พร้อมข้อมูลที่ส่งมา', async () => {
      const dto = { email: 'test@pookan.com', password: 'password123' } as any;
      await controller.signUp(dto);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(dto);
    });
  });
});