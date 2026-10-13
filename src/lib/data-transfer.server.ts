import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { sqlite, schema } from '@/db';
import { buildDataBackup, parseDataBackup } from '@/lib/data-transfer';
import { restoreTablesAtomically } from '@/lib/data-transfer-sqlite';
import fs from 'node:fs';
import path from 'node:path';

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

  const backupDirectory = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const safetyBackupPath = path.join(backupDirectory, `before-json-restore-${timestamp}.db`);
  await sqlite.backup(safetyBackupPath);

  const rowsRestored = restoreTablesAtomically(sqlite, backup, orderedTables);
  return { rowsRestored, safetyBackupPath: path.relative(process.cwd(), safetyBackupPath) };
}
