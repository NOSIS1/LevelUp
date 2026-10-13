export type AnalyticsSession = {
  date: Date;
  type: 'english' | 'coding' | string;
  durationMinutes: number;
  xpAwarded: number;
  language: string | null;
  projectId: number | null;
};

export type AnalyticsDay = {
  date: string;
  englishMinutes: number;
  codingMinutes: number;
  xp: number;
  sessions: number;
};

export function buildDailyAnalytics(sessions: AnalyticsSession[], days: number, now = new Date()): AnalyticsDay[] {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new RangeError('Days must be an integer from 1 to 365');
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const result = new Map<string, AnalyticsDay>();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    result.set(date, { date, englishMinutes: 0, codingMinutes: 0, xp: 0, sessions: 0 });
  }
  for (const session of sessions) {
    const date = session.date.toISOString().slice(0, 10);
    const day = result.get(date);
    if (!day) continue;
    if (!Number.isFinite(session.durationMinutes) || session.durationMinutes < 0) continue;
    if (session.type === 'english') day.englishMinutes += session.durationMinutes;
    if (session.type === 'coding') day.codingMinutes += session.durationMinutes;
    day.xp += session.xpAwarded;
    day.sessions += 1;
  }
  return [...result.values()];
}

export function summarizeAnalytics(sessions: AnalyticsSession[]) {
  return sessions.reduce((summary, session) => {
    if (session.type === 'english') summary.englishMinutes += session.durationMinutes;
    if (session.type === 'coding') summary.codingMinutes += session.durationMinutes;
    summary.totalXp += session.xpAwarded;
    summary.sessionCount += 1;
    return summary;
  }, { englishMinutes: 0, codingMinutes: 0, totalXp: 0, sessionCount: 0 });
}

export function compareMetric(current: number, previous: number): { difference: number; percent: number | null } {
  const difference = current - previous;
  return { difference, percent: previous === 0 ? (current === 0 ? 0 : null) : Math.round(difference / previous * 100) };
}
