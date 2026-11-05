import { Module } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { IssueRefsRepository } from './repositories/issue-refs.repository';
import { IssueRepository } from './repositories/issue.repository';

/** Issues: capture, photos, sorting, status moves, bulk, merge (business §3–§5). */
@Module({
  controllers: [IssuesController],
  providers: [IssuesService, IssueRepository, IssueRefsRepository],
  exports: [IssuesService],
})
export class IssuesModule {}
