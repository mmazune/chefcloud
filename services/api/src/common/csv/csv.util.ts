// services/api/src/common/csv/csv.util.ts

/**
 * Converts a single row of values into a CSV line with proper escaping.
 * Values containing commas, quotes, or newlines are quoted.
 * Quotes inside values are escaped by doubling them.
 */
export function toCsvLine(values: (string | number | null | undefined)[]): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // Escape quotes by doubling them
      const needsQuotes = /[",\n]/.test(str);
      const escaped = str.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    })
    .join(',');
}

/**
 * Converts headers and rows into a complete CSV string.
 * Returns a string with comma-separated values and newline endings.
 */
export function toCsvString(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines: string[] = [];
  lines.push(toCsvLine(headers));
  for (const row of rows) {
    lines.push(toCsvLine(row));
  }
  return lines.join('\n');
}
