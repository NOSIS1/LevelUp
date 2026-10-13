'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildDailyAnalytics, compareMetric, summarizeAnalytics, type AnalyticsSession } from '@/lib/analytics';
import { formatDuration } from '@/lib/utils';

export function AnalyticsDashboard({ sessions }: { sessions: AnalyticsSession[] }) {
  const [period, setPeriod] = useState(30);
  const data = useMemo(() => buildDailyAnalytics(sessions, period), [sessions, period]);
  const summary = summarizeAnalytics(sessions);
  const activeDays = data.filter((day) => day.sessions > 0).length;
  const currentStart = new Date();
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - period + 1);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - period);
  const previousSessions = sessions.filter((session) => session.date >= previousStart && session.date < currentStart);
  const currentSessions = sessions.filter((session) => session.date >= currentStart);
  const current = summarizeAnalytics(currentSessions);
  const previous = summarizeAnalytics(previousSessions);
  const codingCompare = compareMetric(current.codingMinutes, previous.codingMinutes);
  const maxMinutes = Math.max(1, ...data.map((day) => day.englishMinutes + day.codingMinutes));
  const maxXp = Math.max(1, ...data.map((day) => day.xp));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-bold">Аналитика</h1><p className="mt-2 text-muted-foreground">Расчёты основаны только на сохранённых учебных сессиях.</p></div>
        <div className="flex gap-2">{[7, 30, 90].map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value} className={`rounded-md border px-4 py-2 text-sm ${period === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>{value} дней</button>)}</div>
      </div>

      {sessions.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Недостаточно данных для аналитики. Сохраните несколько занятий, чтобы увидеть реальные графики.</CardContent></Card> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat title="Время обучения" value={`${Math.round((summary.englishMinutes + summary.codingMinutes) / 60 * 10) / 10} ч`} caption="Сумма сохранённых сессий" /><Stat title="Английский" value={formatDuration(summary.englishMinutes)} caption="По сессиям типа English" /><Stat title="Программирование" value={formatDuration(summary.codingMinutes)} caption="По сессиям типа Coding" /><Stat title="Активных дней" value={`${activeDays} / ${period}`} caption="Дни с одной или более сессией" /></div>

        <Card><CardHeader><CardTitle>Время обучения по дням</CardTitle></CardHeader><CardContent><div className="flex h-56 items-end gap-1 overflow-x-auto border-b border-border pb-2">{data.map((day) => { const englishHeight = day.englishMinutes / maxMinutes * 100; const codingHeight = day.codingMinutes / maxMinutes * 100; return <div key={day.date} className="group relative flex h-full min-w-3 flex-1 flex-col justify-end" title={`${day.date}: English ${day.englishMinutes} мин, Coding ${day.codingMinutes} мин`}><div className="w-full rounded-t bg-green-500/80" style={{ height: `${englishHeight}%` }} /><div className="w-full bg-blue-500/80" style={{ height: `${codingHeight}%` }} /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs shadow group-hover:block">{day.date}: {day.englishMinutes + day.codingMinutes} мин</span></div>; })}</div><div className="mt-3 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2 w-2 rounded bg-green-500" />Английский</span><span><i className="mr-1 inline-block h-2 w-2 rounded bg-blue-500" />Программирование</span></div></CardContent></Card>

        <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>XP по дням</CardTitle></CardHeader><CardContent><div className="flex h-44 items-end gap-1 overflow-x-auto border-b border-border pb-2">{data.map((day) => <div key={day.date} title={`${day.date}: ${day.xp} XP`} className="min-w-3 flex-1 rounded-t bg-primary/80" style={{ height: `${day.xp / maxXp * 100}%` }} />)}</div><p className="mt-3 text-xs text-muted-foreground">Показаны только XP, сохранённые в сессиях.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Сравнение программирования</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-3xl font-bold">{formatDuration(current.codingMinutes)}</p><p className="text-sm text-muted-foreground">За текущий период. Предыдущий равный период: {formatDuration(previous.codingMinutes)}.</p><p className="text-sm">{codingCompare.percent === null ? 'Недостаточно истории для процентного сравнения.' : `${codingCompare.difference >= 0 ? '+' : ''}${codingCompare.percent}% к предыдущему периоду`}</p><p className="text-xs text-muted-foreground">Число занятий в выбранном периоде: {current.sessionCount}. Сравнение ограничено доступной историей.</p></CardContent></Card></div>
      </>}
    </div>
  );
}

function Stat({ title, value, caption }: { title: string; value: string; caption: string }) {
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{caption}</p></CardContent></Card>;
}
