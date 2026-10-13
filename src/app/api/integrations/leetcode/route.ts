import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { fetchLeetCodeStats, validateLeetCodeUsername } from '@/lib/leetcode-adapter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { action?: string; username?: string };
  try {
    body = await request.json() as { action?: string; username?: string };
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON-запрос' }, { status: 400 });
  }

  try {
    if (body.action === 'connect') {
      const username = validateLeetCodeUsername(body.username || '');
      const stats = await fetchLeetCodeStats(username);
      const existing = await db.select().from(schema.leetcodeIntegration).limit(1);
      let connection;
      if (existing[0]) {
        [connection] = await db.update(schema.leetcodeIntegration).set({
          username: stats.username, isConnected: true, lastSyncAt: new Date(),
          totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved,
          hardSolved: stats.hardSolved, ranking: stats.ranking, syncError: null, updatedAt: new Date(),
        }).where(eq(schema.leetcodeIntegration.id, existing[0].id)).returning();
      } else {
        [connection] = await db.insert(schema.leetcodeIntegration).values({
          username: stats.username, isConnected: true, lastSyncAt: new Date(),
          totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved,
          hardSolved: stats.hardSolved, ranking: stats.ranking, syncError: null,
        }).returning();
      }
      await db.insert(schema.leetcodeSnapshots).values({ ...stats });
      return NextResponse.json({ username: connection.username, stats });
    }

    if (body.action === 'sync') {
      const [connection] = await db.select().from(schema.leetcodeIntegration)
        .where(eq(schema.leetcodeIntegration.isConnected, true)).limit(1);
      if (!connection) return NextResponse.json({ error: 'Сначала подключите публичный username LeetCode' }, { status: 409 });
      try {
        const stats = await fetchLeetCodeStats(connection.username);
        db.transaction((tx) => {
          tx.insert(schema.leetcodeSnapshots).values({ ...stats }).run();
          tx.update(schema.leetcodeIntegration).set({
            totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved,
            hardSolved: stats.hardSolved, ranking: stats.ranking, lastSyncAt: new Date(), syncError: null,
            updatedAt: new Date(),
          }).where(eq(schema.leetcodeIntegration.id, connection.id)).run();
        });
        return NextResponse.json({ stats });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Синхронизация не удалась';
        await db.update(schema.leetcodeIntegration).set({ syncError: message, updatedAt: new Date() })
          .where(eq(schema.leetcodeIntegration.id, connection.id));
        throw error;
      }
    }

    if (body.action === 'disconnect') {
      const [connection] = await db.select().from(schema.leetcodeIntegration).limit(1);
      if (connection) {
        await db.delete(schema.leetcodeSnapshots).where(eq(schema.leetcodeSnapshots.username, connection.username));
        await db.delete(schema.leetcodeIntegration).where(eq(schema.leetcodeIntegration.id, connection.id));
      }
      return NextResponse.json({ disconnected: true });
    }

    return NextResponse.json({ error: 'Неизвестная операция интеграции' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка интеграции LeetCode';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
