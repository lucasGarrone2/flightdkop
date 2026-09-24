import { IsArray, IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchMultiFlightsDto {
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  origins: string[];

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  destinations: string[];

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  passengers?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  maxStops?: number;
}
