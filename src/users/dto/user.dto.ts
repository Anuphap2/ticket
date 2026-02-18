import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email of the user',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    example: 'สมหญิง',
    description: 'The first name of the user',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'ใจดี',
    description: 'The last name of the user',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: '0812345678',
    description: 'Thai phone number',
  })
  @Matches(/^0[0-9]{9}$/, {
    message: 'Phone number must be 10 digits and start with 0',
  })
  phone: string;

  @ApiProperty({
    example: '1234567890123',
    description: 'Thai national ID (13 digits)',
  })
  @IsString()
  @Length(13, 13, {
    message: 'National ID must be exactly 13 digits',
  })
  nationalId: string;
}
