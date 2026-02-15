import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({
    example: '6990353ada7a95d505b4bf4d',
    description: 'ID ของกิจกรรม',
  })
  @IsNotEmpty()
  @IsString()
  eventId: string;

  @ApiProperty({ example: 'Zone A', description: 'ชื่อโซนที่ต้องการจอง' })
  @IsNotEmpty()
  @IsString()
  zoneName: string;

  @ApiProperty({
    example: 2,
    description: 'จำนวนตั๋วที่ต้องการจอง (ขั้นต่ำ 1)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}
