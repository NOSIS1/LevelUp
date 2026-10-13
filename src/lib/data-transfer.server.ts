import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { sqlite, schema } from '@/db';
import { buildDataBackup, parseDataBackup } from '@/lib/data-transfer';

const tableConfigs = Object.values(schema).map((value) => getTableConfig(value as SQLiteTable));
const orderedTables = tableConfigs.map((config) => ({
  name: config.name,
  columns: config.columns.map((column) => column.name),
}));

export function exportDatabaseJson(): string {
  const tables = sqlite.transaction(() => Object.fromEntries(orderedTables.map(({ name }) => {
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    return [name, rows];
  })))();
  return JSON.stringify(buildDataBackup(tables), null, 2);
}

export async function restoreDatabaseJson(text: string): Promise<{ rowsRestored: number; safetyBackupPath: string }> {
  const allowedTables = orderedTables.map((table) => table.name);
  const allowedColumns = Object.fromEntries(orderedTables.map((table) => [table.name, table.columns]));
  const backup = parseDataBackup(text, allowedTables, allowedColumns);

  const fs = await import('node:fs');
  const path = await import('node:path');
  const backupDirectory = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const safetyBackupPath = path.join(backupDirectory, `before-json-restore-${timestamp}.db`);
  await sqlite.backup(safetyBackupPath);

  const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
  const restore = sqlite.transaction(() => {
    sqlite.pragma('defer_foreign_keys = ON');
    for (const table of [...orderedTables].reverse()) sqlite.exec(`DELETE FROM ${quote(table.name)}`);
    let rowsRestored = 0;
    for (const table of orderedTables) {
      const rows = backup.tables[table.name];
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const statement = sqlite.prepare(`INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
      for (const row of rows) {
        statement.run(...columns.map((column) => row[column] === undefined ? null : row[column] as null | string | number | bigint | Buffer));
        rowsRestored += 1;
      }
    }
    const foreignKeyErrors = sqlite.pragma('foreign_key_check') as unknown[];
    if (foreignKeyErrors.length) throw new Error('Restore rejected: backup contains broken foreign-key references');
    return rowsRestored;
  });

  const rowsRestored = restore();
  return { rowsRestored, safetyBackupPath: path.relative(process.cwd(), safetyBackupPath) };
}
