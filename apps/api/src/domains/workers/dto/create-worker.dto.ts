import {
  PHONE_INPUT_MAX,
  WORKER_NAME_MAX,
  WORKER_NOTES_MAX,
} from '@muayana/shared';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';

/**
 * Mirrors CreateWorkerRequestSchema (@muayana/shared). The phone is checked and converted to
 * +20… by the service (normalizeEgyptPhone); at least one category (business §3).
 */
export class CreateWorkerDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(WORKER_NAME_MAX)
  name: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(PHONE_INPUT_MAX)
  phone: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'categoryIds must have at least one category' })
  @IsUUID('all', { each: true })
  categoryIds: string[];

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(WORKER_NOTES_MAX)
  notes?: string;
}
