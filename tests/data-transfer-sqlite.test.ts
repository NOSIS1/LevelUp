import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildDataBackup } from '@/lib/data-transfer';
import { restoreTablesAtomically } from '@/lib/data-transfer-sqlite';

const temporaryDirectories: string[] = [];

function createDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), 'levelup-transfer-'));
  temporaryDirectories.push(directory);
  const database = new Database(path.join(directory, 'test.db'));
  database.pragma('foreign_keys = ON');
  database.exec('CREATE TABLE profiles (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE notes (id INTEGER PRIMARY KEY, profile_id INTEGER NOT NULL REFERENCES profiles(id), body TEXT NOT NULL);');
  return database;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('SQLite data restore transaction', () => {
  const layout = [
    { name: 'profiles', columns: ['id', 'name'] },
    { name: 'notes', columns: ['id', 'profile_id', 'body'] },
  ];

  it('restores related rows atomically and validates foreign keys', () => {
    const database = createDatabase();
    database.prepare('INSERT INTO profiles VALUES (?, ?)').run(1, 'Old');
    database.prepare('INSERT INTO notes VALUES (?, ?, ?)').run(1, 1, 'Old note');
    const backup = buildDataBackup({
      profiles: [{ id: 8, name: 'Restored' }],
      notes: [{ id: 12, profile_id: 8, body: 'Restored note' }],
    });

    expect(restoreTablesAtomically(database, backup, layout)).toBe(2);
    expect(database.prepare('SELECT * FROM profiles').all()).toEqual([{ id: 8, name: 'Restored' }]);
    expect(database.prepare('SELECT * FROM notes').all()).toEqual([{ id: 12, profile_id: 8, body: 'Restored note' }]);
    expect(database.pragma('foreign_key_check')).toEqual([]);
    database.close();
  });

  it('rolls back and preserves current records if a backup violates foreign keys', () => {
    const database = createDatabase();
    database.prepare('INSERT INTO profiles VALUES (?, ?)').run(1, 'Keep me');
    database.prepare('INSERT INTO notes VALUES (?, ?, ?)').run(1, 1, 'Keep this note');
    const invalidBackup = buildDataBackup({
      profiles: [{ id: 8, name: 'Invalid' }],
      notes: [{ id: 12, profile_id: 404, body: 'Broken relation' }],
    });

    expect(() => restoreTablesAtomically(database, invalidBackup, layout)).toThrow('broken foreign-key');
    expect(database.prepare('SELECT * FROM profiles').all()).toEqual([{ id: 1, name: 'Keep me' }]);
    expect(database.prepare('SELECT * FROM notes').all()).toEqual([{ id: 1, profile_id: 1, body: 'Keep this note' }]);
    database.close();
  });
});
