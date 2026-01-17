import {
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a new tier
 */
export class CreateTierDto {
  @IsInt()
  @Min(1)
  @Max(100)
  tier: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price: number;

  @IsInt()
  @Min(1)
  @Max(365)
  lifespanDays: number;

  @IsInt()
  @Min(100)
  @Max(1000)
  yieldPercent: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPubliclyAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * DTO for updating an existing tier
 */
export class UpdateTierDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lifespanDays?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  yieldPercent?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPubliclyAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * DTO for updating tier visibility
 */
export class UpdateVisibilityDto {
  @IsBoolean()
  isVisible: boolean;
}

/**
 * DTO for updating tier availability
 */
export class UpdateAvailabilityDto {
  @IsBoolean()
  isPubliclyAvailable: boolean;
}

/**
 * Response type for tier data
 */
export interface TierResponse {
  id: string;
  tier: number;
  name: string;
  emoji: string;
  price: number;
  lifespanDays: number;
  yieldPercent: number;
  imageUrl: string | null;
  isVisible: boolean;
  isPubliclyAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
