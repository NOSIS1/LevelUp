'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildCalendarMonth, calendarWeeks, type CalendarSession } from '@/lib/calendar';
import { formatDuration } from '@/lib/utils';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const levelClasses = ['bg-secondary', 'bg-emerald-950', 'bg-emerald-800', 'bg-emerald-600', 'bg-emerald-400'];

export function ActivityCalendar({ sessions }: { sessions: CalendarSession[] }) {
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const days = useMemo(() => buildCalendarMonth(sessions, year, month), [sessions, year, month]);
  const weeks = useMemo(() => calendarWeeks(days, year, month), [days, year, month]);
  const activeDays = days.filter((day) => day.sessions > 0).length;
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const selectedSessions = selectedDate ? sessions.filter((session) => session.date === selectedDate) : [];

  function moveMonth(delta: number) {
    setMonthDate(new Date(year, month + delta, 1));
    setSelectedDate(null);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-3 text-4xl font-bold"><CalendarDays className="h-10 w-10" />Календарь активности</h1><p className="mt-2 text-muted-foreground">Тепловая карта строится по реальным сохранённым занятиям.</p></div>
      <div className="grid gap-4 sm:grid-cols-3"><Metric title="Активных дней в месяце" value={String(activeDays)} /><Metric title="Время за месяц" value={formatDuration(totalMinutes)} /><Metric title="Занятий за месяц" value={String(days.reduce((sum, day) => sum + day.sessions, 0))} /></div>
      <Card><CardHeader className="flex flex-row items-center justify-between"><button type="button" aria-label="Предыдущий месяц" className="rounded p-2 hover:bg-accent" onClick={() => moveMonth(-1)}><ChevronLeft /></button><CardTitle className="capitalize">{monthFormatter.format(monthDate)}</CardTitle><button type="button" aria-label="Следующий месяц" className="rounded p-2 hover:bg-accent" onClick={() => moveMonth(1)} disabled={year === new Date().getFullYear() && month === new Date().getMonth()}><ChevronRight /></button></CardHeader><CardContent><div className="grid grid-cols-7 gap-2">{weekdays.map((weekday) => <p key={weekday} className="pb-1 text-center text-xs text-muted-foreground">{weekday}</p>)}{weeks.flatMap((week, weekIndex) => week.map((day, dayIndex) => day ? <button key={day.date} type="button" aria-label={`${day.date}: ${day.minutes} мин., ${day.sessions} занятий`} aria-pressed={selectedDate === day.date} title={`${day.date}: ${day.minutes} мин.`} onClick={() => setSelectedDate(day.date)} className={`aspect-square rounded-md border border-transparent transition hover:ring-2 hover:ring-primary ${levelClasses[day.level]} ${selectedDate === day.date ? 'ring-2 ring-primary' : ''}`} /> : <span key={`empty-${weekIndex}-${dayIndex}`} aria-hidden="true" />))}</div><div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>Пустой день означает отсутствие записанных занятий, а не пропуск.</span><div className="flex items-center gap-1"><span>Меньше</span>{levelClasses.map((className, index) => <span key={index} className={`h-3 w-3 rounded-sm ${className}`} />)}<span>Больше</span></div></div></CardContent></Card>
      <Card><CardHeader><CardTitle>{selectedDate ? `Занятия · ${selectedDate}` : 'Выберите день на календаре'}</CardTitle></CardHeader><CardContent>{!selectedDate ? <p className="text-sm text-muted-foreground">Нажмите на ячейку, чтобы посмотреть активность за этот день.</p> : selectedSessions.length === 0 ? <p className="text-sm text-muted-foreground">За этот день сохранённых занятий нет.</p> : <div className="space-y-3">{selectedSessions.map((session, index) => <div key={`${session.date}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div><p className="font-medium">{session.type === 'english' ? 'Английский' : 'Программирование'} · {session.category}</p>{session.topic && <p className="text-sm text-muted-foreground">{session.topic}</p>}</div><div className="flex items-center gap-2"><Badge variant="outline">{formatDuration(session.durationMinutes)}</Badge><Badge>+{session.xpAwarded} XP</Badge></div></div>)}</div>}</CardContent></Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}
