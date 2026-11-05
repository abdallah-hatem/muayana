import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Leaves a route's return value out of the envelope (contract: the CSV exports stream
 * `text/csv` with a BOM). Errors are still enveloped by the exception filter.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
