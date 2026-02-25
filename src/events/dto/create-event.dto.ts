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
  Max,
  ArrayMinSize,
  Length,
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
  @Min(100, { message: 'price must be at least 100' })
  @Max(900000, { message: 'price must be less than or equal to 900,000' })
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
  @Max(26, { message: 'rows must be less than or equal to 26' })
  rows?: number;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Max(100, { message: 'seatsPerRow must be less than or equal to 100' })
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
  @Length(0, 1500, { message: 'description must be at most 1500 characters' })
  description?: string;

  @ApiProperty({ example: '2023-12-31T18:00:00Z' })
  @IsNotEmpty()
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
  @IsNotEmpty()
  @ArrayMinSize(1, { message: 'At least one zone must be provided' })
  @Type(() => ZoneDto)
  zones: ZoneDto[];
}
