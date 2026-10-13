import { MAX_DATA_BACKUP_BYTES } from '@/lib/data-transfer';

export type DataTransferHandlers = {
  exportBackup: () => string;
  restoreBackup: (text: string) => Promise<{ rowsRestored: number; safetyBackupPath: string }>;
};

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host && originUrl.protocol === requestUrl.protocol;
  } catch {
    return false;
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function createDataTransferHandlers(services: DataTransferHandlers) {
  return {
    async GET(request: Request): Promise<Response> {
      if (request.headers.get('sec-fetch-site') !== 'same-origin') {
        return errorResponse('Export is available only from the local LevelUp app.', 403);
      }
      try {
        const json = services.exportBackup();
        return new Response(json, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="levelup-export-${new Date().toISOString().slice(0, 10)}.json"`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Export failed', 500);
      }
    },

    async POST(request: Request): Promise<Response> {
      if (!isSameOrigin(request)) return errorResponse('Restore requests must come from this local app origin.', 403);
      if (request.headers.get('x-levelup-confirm') !== 'restore') return errorResponse('Explicit restore confirmation is required.', 400);
      if (!request.headers.get('content-type')?.includes('application/json')) return errorResponse('Upload a JSON export file.', 415);
      const contentLength = Number(request.headers.get('content-length') || 0);
      if (contentLength > MAX_DATA_BACKUP_BYTES) return errorResponse('Backup file exceeds the 25 MB limit.', 413);

      try {
        const body = await request.text();
        if (Buffer.byteLength(body, 'utf8') > MAX_DATA_BACKUP_BYTES) return errorResponse('Backup file exceeds the 25 MB limit.', 413);
        return Response.json(await services.restoreBackup(body));
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Restore failed', 400);
      }
    },
  };
}
