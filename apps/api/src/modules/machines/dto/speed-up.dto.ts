import { IsNotEmpty, IsIn, IsInt, Min } from 'class-validator';

export class SpeedUpDto {
  @IsInt()
  @Min(1)
  days: number;

  @IsNotEmpty()
  @IsIn(['fortune', 'fame'])
  paymentMethod: 'fortune' | 'fame';
}
