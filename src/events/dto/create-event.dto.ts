import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  IsOptional,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ZoneDto {
  @ApiProperty({ example: 'Zone A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsNotEmpty()
  @Min(100)
  price: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsNotEmpty()
  @Min(1, { message: 'totalSeats must be at least 1' })
  totalSeats: number;

  // 🎯 เพิ่ม availableSeats เพื่อรองรับการ Refactor ใน Service
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  availableSeats?: number;

  @ApiProperty({ example: 'seated', enum: ['seated', 'standing'] })
  @IsEnum(['seated', 'standing'])
  type: string;

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
  @IsOptional()
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
