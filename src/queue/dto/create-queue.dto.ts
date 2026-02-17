import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQueueDto {
  @IsNotEmpty()
  @IsString()
  eventId: string;
}
