import { NextResponse } from 'next/server';
import { exportDatabaseJson, restoreDatabaseJson } from '@/lib/data-transfer.server';
import { MAX_DATA_BACKUP_BYTES } from '@/lib/data-transfer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    return NextResponse.json({ error: 'Export is available only from the local LevelUp app.' }, { status: 403 });
  }
  try {
    const json = exportDatabaseJson();
    return new Response(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="levelup-export-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Restore requests must come from this local app origin.' }, { status: 403 });
  if (request.headers.get('x-levelup-confirm') !== 'restore') return NextResponse.json({ error: 'Explicit restore confirmation is required.' }, { status: 400 });
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'Upload a JSON export file.' }, { status: 415 });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_DATA_BACKUP_BYTES) return NextResponse.json({ error: 'Backup file exceeds the 25 MB limit.' }, { status: 413 });

  try {
    const body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_DATA_BACKUP_BYTES) return NextResponse.json({ error: 'Backup file exceeds the 25 MB limit.' }, { status: 413 });
    const result = await restoreDatabaseJson(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Restore failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
