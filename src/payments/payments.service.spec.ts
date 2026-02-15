import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'test_secret' }),
    },
  }));
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('sk_test_key') },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('ควรสร้าง Client Secret สำเร็จเมื่อส่งยอดเงินมาถูกต้อง', async () => {
    const result = await service.createPaymentIntent(5000); // 5000 THB
    expect(result).toEqual({ clientSecret: 'test_secret' });
  });

  it('ควร Error ถ้ามียอดเงินน้อยกว่าหรือเท่ากับ 0', async () => {
    await expect(service.createPaymentIntent(0)).rejects.toThrow();
  });
});