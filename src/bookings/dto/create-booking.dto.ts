/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'event-123', description: 'ID of the event' })
  @IsNotEmpty()
  @IsString()
  eventId: string;

  @ApiProperty({ example: 'Zone A', description: 'Name of the zone' })
  @IsNotEmpty()
  @IsString()
  zoneName: string;

  @ApiProperty({ example: 2, description: 'Number of tickets to book' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}
