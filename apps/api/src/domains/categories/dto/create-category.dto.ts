import { CATEGORY_NAME_MAX } from '@muayana/shared';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

/** `#RRGGBB` (shared HexColorSchema). */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Mirrors CreateCategoryRequestSchema (@muayana/shared). A blank nameEn clears it. */
export class CreateCategoryDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(CATEGORY_NAME_MAX)
  nameAr: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(CATEGORY_NAME_MAX)
  nameEn?: string;

  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be #RRGGBB' })
  color: string;
}
