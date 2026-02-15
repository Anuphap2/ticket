/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ZoneDto {
  @ApiProperty({ example: 'Zone A', description: 'Name of the zone' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1000, description: 'Price per seat' })
  @IsNotEmpty()
  price: number;

  @ApiProperty({ example: 50, description: 'Total seats in the zone' })
  @IsNotEmpty()
  totalSeats: number;
}

export class CreateEventDto {
  @ApiProperty({ example: 'Concert XYZ', description: 'Title of the event' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Best concert ever', description: 'Description of the event' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2023-12-31T18:00:00Z', description: 'Date of the event' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Bangkok Arena', description: 'Location of the event' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 'http://example.com/image.jpg', description: 'Image URL of the event' })
  @IsString()
  imageUrl: string;

  @ApiProperty({ type: [ZoneDto], description: 'Zones available in the event' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZoneDto)
  zones: ZoneDto[];
}
