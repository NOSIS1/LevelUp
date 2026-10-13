import type Database from 'better-sqlite3';
import type { DataBackup } from '@/lib/data-transfer';

export type BackupTableLayout = { name: string; columns: string[] };

export function restoreTablesAtomically(database: Database.Database, backup: DataBackup, orderedTables: BackupTableLayout[]): number {
  const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
  const restore = database.transaction(() => {
    database.pragma('defer_foreign_keys = ON');
    for (const table of [...orderedTables].reverse()) database.exec(`DELETE FROM ${quote(table.name)}`);
    let rowsRestored = 0;
    for (const table of orderedTables) {
      const rows = backup.tables[table.name];
      if (!rows.length) continue;
      const columns = table.columns;
      const statement = database.prepare(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
      for (const row of rows) {
        statement.run(...columns.map((column) => row[column] === undefined ? null : row[column] as null | string | number | bigint | Buffer));
        rowsRestored += 1;
      }
    }
    const foreignKeyErrors = database.pragma('foreign_key_check') as unknown[];
    if (foreignKeyErrors.length) throw new Error('Restore rejected: backup contains broken foreign-key references');
    return rowsRestored;
  });
  return restore();
}
