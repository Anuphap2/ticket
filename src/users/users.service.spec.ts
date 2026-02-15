
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';

const mockUser = {
  _id: 'user-id',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: 'user',
  save: jest.fn(),
};

const mockUserModel = {
  new: jest.fn().mockResolvedValue(mockUser),
  constructor: jest.fn().mockResolvedValue(mockUser),
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  exec: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get(getModelToken(User.name));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      model.create.mockResolvedValue(mockUser);
      const result = await service.create({
        email: 'test@example.com',
        passwordHash: 'hashed',
      });
      expect(result).toEqual(mockUser);
    });
  });
});