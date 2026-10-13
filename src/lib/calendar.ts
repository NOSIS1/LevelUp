export type CalendarSession = { date: string; type: string; durationMinutes: number; category: string; topic: string | null; xpAwarded: number };
export type CalendarDay = { date: string; minutes: number; sessions: number; xp: number; level: 0 | 1 | 2 | 3 | 4 };

export function activityLevel(minutes: number): CalendarDay['level'] {
  if (minutes <= 0) return 0;
  if (minutes < 25) return 1;
  if (minutes < 50) return 2;
  if (minutes < 90) return 3;
  return 4;
}

export function buildCalendarMonth(sessions: CalendarSession[], year: number, month: number): CalendarDay[] {
  if (!Number.isInteger(year) || year < 1970 || year > 9999 || !Number.isInteger(month) || month < 0 || month > 11) {
    throw new RangeError('Expected a valid year and zero-based month');
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate = new Map<string, CalendarDay>();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    byDate.set(date, { date, minutes: 0, sessions: 0, xp: 0, level: 0 });
  }
  for (const session of sessions) {
    const day = byDate.get(session.date);
    if (!day || !Number.isFinite(session.durationMinutes) || session.durationMinutes < 0) continue;
    day.minutes += session.durationMinutes;
    day.sessions += 1;
    day.xp += Math.max(0, session.xpAwarded || 0);
  }
  return [...byDate.values()].map((day) => ({ ...day, level: activityLevel(day.minutes) }));
}

export function calendarWeeks(days: CalendarDay[], year: number, month: number): (CalendarDay | null)[][] {
  if (!days.length) return [];
  const firstWeekday = new Date(year, month, 1).getDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const cells: (CalendarDay | null)[] = [...Array(mondayOffset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
