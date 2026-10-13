import { z } from 'zod';

export const DATA_BACKUP_FORMAT = 'levelup-sqlite-json';
export const DATA_BACKUP_VERSION = 1;
export const MAX_DATA_BACKUP_BYTES = 25 * 1024 * 1024;
export const MAX_DATA_BACKUP_ROWS = 250_000;

const backupSchema = z.object({
  format: z.literal(DATA_BACKUP_FORMAT),
  version: z.literal(DATA_BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export type DataBackup = z.infer<typeof backupSchema>;

export function parseDataBackup(text: string, allowedTables: string[], allowedColumns: Record<string, string[]>): DataBackup {
  if (Buffer.byteLength(text, 'utf8') > MAX_DATA_BACKUP_BYTES) throw new Error('Backup file exceeds the 25 MB limit');
  let input: unknown;
  try { input = JSON.parse(text) as unknown; }
  catch { throw new Error('Backup is not valid JSON'); }
  const parsed = backupSchema.parse(input);
  const expected = [...allowedTables].sort();
  const received = Object.keys(parsed.tables).sort();
  if (expected.length !== received.length || expected.some((table, index) => table !== received[index])) {
    throw new Error('Backup tables do not match this LevelUp version');
  }
  let totalRows = 0;
  for (const [table, rows] of Object.entries(parsed.tables)) {
    totalRows += rows.length;
    const allowed = new Set(allowedColumns[table] || []);
    for (const [index, row] of rows.entries()) {
      const extraColumns = Object.keys(row).filter((column) => !allowed.has(column));
      if (extraColumns.length) throw new Error(`Unexpected column in ${table} row ${index + 1}`);
      const missingColumns = (allowedColumns[table] || []).filter((column) => !(column in row));
      if (missingColumns.length) throw new Error(`Missing column in ${table} row ${index + 1}`);
      if (Object.values(row).some((value) => value !== null && typeof value === 'object')) {
        throw new Error(`Nested values are not supported in ${table} row ${index + 1}`);
      }
    }
  }
  if (totalRows > MAX_DATA_BACKUP_ROWS) throw new Error('Backup exceeds the 250,000 row limit');
  return parsed;
}

export function buildDataBackup(tables: Record<string, Record<string, unknown>[]>, now = new Date()): DataBackup {
  return backupSchema.parse({ format: DATA_BACKUP_FORMAT, version: DATA_BACKUP_VERSION, exportedAt: now.toISOString(), tables });
}
