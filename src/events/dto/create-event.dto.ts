import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ZoneDto {
  @ApiProperty({ example: 'Zone A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsNotEmpty()
  totalSeats: number;

  @ApiProperty({ example: 'seated', enum: ['seated', 'standing'] })
  @IsEnum(['seated', 'standing'])
  type: string;

  // ถ้าเป็นโซนนั่ง ค่อยส่งค่าพวกนี้มา (Optional)
  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  rows?: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  seatsPerRow?: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Concert XYZ' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Best concert ever' })
  @IsString()
  @IsOptional() // ใส่เป็น Optional ไว้เผื่อบางงานไม่ต้องระบุละเอียด
  description?: string;

  @ApiProperty({ example: '2023-12-31T18:00:00Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Bangkok Arena' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 'http://example.com/image.jpg', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  seats?: any[];

  @ApiProperty({ type: [ZoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZoneDto)
  zones: ZoneDto[];
}
