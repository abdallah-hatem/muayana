import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSiteDto } from './create-site.dto';

/** Mirrors UpdateSiteRequestSchema: any create field, plus archiving. */
export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
