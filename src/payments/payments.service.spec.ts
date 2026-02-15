
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { BadRequestException } from '@nestjs/common';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'secret_123' }),
    },
  }));
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent', async () => {
      const result = await service.createPaymentIntent(100);
      expect(result).toEqual({ clientSecret: 'secret_123' });
    });

    it('should throw BadRequestException if amount is <= 0', async () => {
      await expect(service.createPaymentIntent(0)).rejects.toThrow(BadRequestException);
      await expect(service.createPaymentIntent(-100)).rejects.toThrow(BadRequestException);
    });
  });
});