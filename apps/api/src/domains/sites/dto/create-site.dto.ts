import { SITE_ADDRESS_MAX, SITE_NAME_MAX, SITE_NOTES_MAX } from '@muayana/shared';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

/** Mirrors CreateSiteRequestSchema (@muayana/shared). Blank address/notes clear the field. */
export class CreateSiteDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(SITE_NAME_MAX)
  name: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(SITE_ADDRESS_MAX)
  address?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(SITE_NOTES_MAX)
  notes?: string;
}
