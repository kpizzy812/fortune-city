import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxGlobalTier?: number;
}
