import { Inject, Injectable, type StreamableFile } from '@nestjs/common';
import {
  exportColumns,
  issueExportHeaders,
  type CsvValue,
} from '@muayana/shared';
import { CLOCK, type Clock } from '../../common/clock/clock';
import { csvStream } from '../../common/utils/csv.util';
import {
  buildIssueWhere,
  issueOrderBy,
} from '../../common/utils/issue-filter.util';
import type {
  IssueExportQueryDto,
  IssueHistoryExportQueryDto,
} from './dto/issue-export.dto';
import {
  HISTORY_HEADERS,
  historyCells,
  historyFacts,
  issueCells,
} from './issues-export.pure';
import { IssueRepository } from './repositories/issue.repository';

/** Rows read per database round trip while a CSV streams. */
export const EXPORT_BATCH = 500;

/** Reads `fetch(skip, take)` slice by slice until a short one says the rows ran out. */
async function* slices<T>(
  fetch: (skip: number, take: number) => Promise<T[]>,
): AsyncGenerator<T[]> {
  for (let skip = 0; ; skip += EXPORT_BATCH) {
    const rows = await fetch(skip, EXPORT_BATCH);
    yield rows;
    if (rows.length < EXPORT_BATCH) return;
  }
}

/**
 * The issues and status-history CSVs (business §7): exactly the issues the list filter matches
 * (§5.8, the same buildIssueWhere), every one of them — streamed in batches, never one page.
 */
@Injectable()
export class IssuesExportService {
  constructor(
    private readonly issues: IssueRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  issuesCsv(query: IssueExportQueryDto): StreamableFile {
    const now = this.clock.now();
    const where = buildIssueWhere(query, now);
    const orderBy = issueOrderBy(query.sort);
    const columns = exportColumns(query.columns);
    const { lang } = query;
    const issues = this.issues;

    async function* batches(): AsyncGenerator<CsvValue[][]> {
      for await (const rows of slices((skip, take) =>
        issues.findBatch(where, orderBy, skip, take),
      )) {
        const changes = await issues.findChangesOf(rows.map((r) => r.id));
        const facts = historyFacts(
          changes,
          new Map(rows.map((r) => [r.id, r.status])),
        );
        yield rows.map((row) =>
          issueCells(row, facts.get(row.id), columns, lang, now),
        );
      }
    }

    return csvStream(issueExportHeaders(columns, lang), batches());
  }

  historyCsv(query: IssueHistoryExportQueryDto): StreamableFile {
    const where = buildIssueWhere(query, this.clock.now());
    const { lang } = query;
    const issues = this.issues;

    async function* batches(): AsyncGenerator<CsvValue[][]> {
      for await (const rows of slices((skip, take) =>
        issues.findHistoryBatch(where, skip, take),
      ))
        yield rows.map((row) => historyCells(row, lang));
    }

    return csvStream(HISTORY_HEADERS[lang], batches());
  }
}
