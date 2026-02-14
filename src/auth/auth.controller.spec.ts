import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';


describe('AuthController', () => {
  let controller: AuthController;

  // สร้าง Mock ของ AuthService ให้ตรงกับที่ Controller เรียกใช้
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

  // ตัวอย่างการเทส SignUp เบื้องต้น
  describe('signUp', () => {
    it('ควรจะเรียกใช้ authService.signUp พร้อมข้อมูลที่ส่งมา', async () => {
      const dto = { email: 'test@pookan.com', password: 'password123' };
      await controller.signUp(dto);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(dto);
    });
  });
});