import { StreamableFile } from '@nestjs/common';
import { CSV_BOM, csvRow, type CsvValue } from '@muayana/shared';
import { Readable } from 'node:stream';

/*
 * What every CSV export shares (business §7): the streamed file itself. Labels written in the
 * export language (status, priority, yes/no, category) live with the shared export columns
 * (@muayana/shared issue-export); text cells are formula-guarded by csvRow.
 */

/**
 * A CSV answer built while it is sent: the BOM and header row first, then each batch of rows
 * as the database returns it, so an export of every matching row never sits in memory whole.
 */
export function csvStream(
  headers: readonly string[],
  batches: AsyncIterable<readonly (readonly CsvValue[])[]>,
): StreamableFile {
  async function* lines(): AsyncGenerator<string> {
    yield CSV_BOM + csvRow(headers);
    for await (const rows of batches) {
      if (rows.length > 0) yield rows.map(csvRow).join('');
    }
  }
  return new StreamableFile(Readable.from(lines()), {
    type: 'text/csv; charset=utf-8',
  });
}
