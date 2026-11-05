import { LOCALES, USER_NAME_MAX_LENGTH, type Locale } from '@muayana/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Mirrors UpdateMeRequestSchema (@muayana/shared). */
export class UpdateMeDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;
}
