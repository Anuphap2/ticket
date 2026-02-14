import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDoc, UserRole } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private user: Model<UserDoc>) { }
  findByEmail(email: string) {
    return this.user.findOne({ email }).exec();
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

  create(data: { email: string; passwordHash: string; role?: UserRole }) {
    return this.user.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || 'user',
    });
  }

  setRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.user.updateOne({ _id: userId }, { refreshTokenHash }).exec();
  }
}
