import { Module } from '@nestjs/common';
import { IssuesExportService } from './issues-export.service';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { IssueRefsRepository } from './repositories/issue-refs.repository';
import { IssueRepository } from './repositories/issue.repository';

/** Issues: capture, photos, sorting, status moves, bulk, merge, CSV exports (§3–§5, §7). */
@Module({
  controllers: [IssuesController],
  providers: [
    IssuesService,
    IssuesExportService,
    IssueRepository,
    IssueRefsRepository,
  ],
  exports: [IssuesService],
})
export class IssuesModule {}
