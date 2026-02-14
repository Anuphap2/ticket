import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class AuthDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsNotEmpty()
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
