import { Header, applyDecorators } from '@nestjs/common';
import { RawResponse } from './raw-response.decorator';

/**
 * A CSV download route (contract: the only answers outside the envelope): `text/csv` in UTF-8,
 * saved as `filename`. Errors are still enveloped by the exception filter.
 */
export const CsvResponse = (filename: string) =>
  applyDecorators(
    RawResponse(),
    Header('Content-Type', 'text/csv; charset=utf-8'),
    Header('Content-Disposition', `attachment; filename="${filename}"`),
  );
