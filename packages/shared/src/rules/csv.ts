/** UTF-8 byte-order mark: Excel reads the file as UTF-8 and shows Arabic (§7). */
export const CSV_BOM = String.fromCharCode(0xfeff);
const LINE_END = '\r\n';

/** Characters that make a spreadsheet run a cell as a formula (§7; tab and CR per OWASP). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export type CsvValue = string | number | boolean | null | undefined;

/**
 * One CSV cell: empty for null/undefined; text starting with `=`, `+`, `-`, `@` gets a leading
 * apostrophe so it isn't run as a formula; quotes, commas and newlines are quoted (RFC 4180).
 * Numbers and booleans are data, never formulas, so they are written as they are.
 */
/**
 * A text value a spreadsheet could run as a formula (`=`, `+`, `-`, `@`, tab, CR first) gets a
 * leading apostrophe (§7). CSV cells and the contractor Excel's text cells both pass through it.
 */
export const guardFormula = (text: string): string =>
  FORMULA_START.test(text) ? `'${text}` : text;

export const escapeCsvCell = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? guardFormula(value) : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** One CSV line: the cells escaped, comma-separated, ending in CRLF (streamed exports write these). */
export const csvRow = (row: readonly CsvValue[]): string =>
  row.map(escapeCsvCell).join(',') + LINE_END;

/** A whole CSV file: BOM, the header row, then one row per entry, CRLF line ends. */
export const toCsv = (
  rows: readonly (readonly CsvValue[])[],
  headers: readonly string[],
): string => CSV_BOM + [headers, ...rows].map(csvRow).join('');
