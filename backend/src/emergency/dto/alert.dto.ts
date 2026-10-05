import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class DispatchAlertDto {
  @IsString()
  userId: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  address: string;

  @IsNumber()
  gForce: number;

  @IsOptional()
  @IsNumber()
  speedKmh?: number;
}
