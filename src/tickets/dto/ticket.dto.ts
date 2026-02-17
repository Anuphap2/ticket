import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsMongoId,
} from 'class-validator';

export class CreateTicketDto {
  @IsMongoId()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  seatNumber: string;

  @IsString()
  @IsNotEmpty()
  zoneName: string;
}

export class UpdateTicketStatusDto {
  //สถานะของตั๋ว: ว่าง, จองแล้ว, ขายแล้ว
  @IsEnum(['available', 'reserved', 'sold'])
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;
}
