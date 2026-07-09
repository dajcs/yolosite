export type Column = { key: string; header: string };

export function toCsv(
  rows: Record<string, unknown>[],
  columns: Column[],
): string {
  const escape = (value: unknown): string => {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c.key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
