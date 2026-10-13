import { NextResponse } from 'next/server';
import { syncGitHub } from '@/lib/actions';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string };
    const result = await syncGitHub(body.username || '');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub synchronization failed';
    const status = message.includes('username') ? 400 : message.includes('not found') ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const { disconnectGitHub } = await import('@/lib/actions');
    return NextResponse.json(await disconnectGitHub());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub disconnect failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
