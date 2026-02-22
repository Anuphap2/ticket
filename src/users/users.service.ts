import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDoc } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private user: Model<UserDoc>) { }
  findByEmail(email: string) {
    return this.user.findOne({ email }).exec();
  }

  findAll() {
    return this.user.find().exec();
  }
  // ใช้ตอน login: ต้องดึง passwordHash และ refreshTokenHash
  findByEmailWithSecrets(email: string) {
    return this.user
      .findOne({ email })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  findByIdWithRefresh(userId: string) {
    return this.user.findById(userId).select('+refreshTokenHash').exec();
  }

  create(data: Partial<User>) {
    return this.user.create({
      ...data,
      role: data.role || 'user',
    });
  }

  update(userId: string, data: Partial<User>) {
    const usersUpdate = this.user
      .findByIdAndUpdate(userId, { $set: data })
      .exec();

    if (!usersUpdate) {
      throw new Error('User not found');
    }
    return usersUpdate;
  }

  delete(userId: string) {
    return this.user.findByIdAndDelete(userId).exec();
  }

  setRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.user.updateOne({ _id: userId }, { refreshTokenHash }).exec();
  }

  async findProfileById(userId: string) {
    return this.user
      .findById(userId)
      .select('-passwordHash -refreshTokenHash -nationalIdHash')
      .lean();
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.user
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .select('-passwordHash -refreshTokenHash -nationalIdHash');
  }
}
