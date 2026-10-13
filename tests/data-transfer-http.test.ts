import { describe, expect, it, vi } from 'vitest';
import { createDataTransferHandlers } from '@/lib/data-transfer-http';

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1:3000${path}`, init);
}

describe('data backup HTTP API', () => {
  it('exports JSON only for same-origin browser requests with download headers', async () => {
    const handlers = createDataTransferHandlers({ exportBackup: () => '{"format":"levelup-sqlite-json"}', restoreBackup: vi.fn() });
    const response = await handlers.GET(request('/api/data/backup', { headers: { 'sec-fetch-site': 'same-origin' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('levelup-export-');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('levelup-sqlite-json');
  });

  it('rejects cross-origin exports and restores without user confirmation', async () => {
    const restoreBackup = vi.fn();
    const handlers = createDataTransferHandlers({ exportBackup: () => '{}', restoreBackup });
    expect((await handlers.GET(request('/api/data/backup'))).status).toBe(403);
    const response = await handlers.POST(request('/api/data/backup', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(400);
    expect(restoreBackup).not.toHaveBeenCalled();
  });

  it('validates content type, size, restore errors, and successful response', async () => {
    const restoreBackup = vi.fn(async (text: string) => {
      if (text === 'bad') throw new Error('invalid backup schema');
      return { rowsRestored: 12, safetyBackupPath: 'backups/safety.db' };
    });
    const handlers = createDataTransferHandlers({ exportBackup: () => '{}', restoreBackup });
    const headers = { origin: 'http://127.0.0.1:3000', 'x-levelup-confirm': 'restore' };
    expect((await handlers.POST(request('/api/data/backup', { method: 'POST', headers, body: 'plain text' }))).status).toBe(415);
    expect((await handlers.POST(request('/api/data/backup', { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'content-length': String(26 * 1024 * 1024) }, body: '{}' }))).status).toBe(413);
    const invalid = await handlers.POST(request('/api/data/backup', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: 'bad' }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: 'invalid backup schema' });
    const success = await handlers.POST(request('/api/data/backup', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{"ok":true}' }));
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ rowsRestored: 12, safetyBackupPath: 'backups/safety.db' });
  });
});
