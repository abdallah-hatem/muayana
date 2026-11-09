import {
  WORKER_ISSUES_CHOICES,
  type WorkerIssuesChoice,
} from '@muayana/shared';
import { IsIn, IsOptional } from 'class-validator';

/** Mirrors DeleteWorkerQuerySchema: what happens to his issues (business §3). */
export class DeleteWorkerQueryDto {
  @IsOptional()
  @IsIn(WORKER_ISSUES_CHOICES)
  issues?: WorkerIssuesChoice;
}
