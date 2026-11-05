import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkerDto } from './create-worker.dto';

/** Mirrors UpdateWorkerRequestSchema: any create field (categoryIds still ≥ 1), plus active. */
export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
