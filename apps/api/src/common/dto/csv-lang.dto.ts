import { LOCALES, type Locale } from '@muayana/shared';
import { IsIn, IsOptional } from 'class-validator';

/** `lang` of every CSV export: the header and label language (business §7), Arabic by default. */
export class CsvLangDto {
  @IsOptional()
  @IsIn(LOCALES)
  lang: Locale = 'ar';
}
