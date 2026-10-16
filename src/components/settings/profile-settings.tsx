'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { updateProfileSettings } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ProfileSettings = { displayName: string; englishLevel: string; targetEnglishLevel: string | null; dailyGoalMinutes: number; timezone: string };
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function ProfileSettings({ initial }: { initial: ProfileSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...initial, englishLevel: initial.englishLevel as typeof levels[number], targetEnglishLevel: (initial.targetEnglishLevel || 'B2') as typeof levels[number] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    startTransition(async () => {
      try { await updateProfileSettings({ ...form, englishLevel: form.englishLevel as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', dailyGoalMinutes: Number(form.dailyGoalMinutes), targetEnglishLevel: (form.targetEnglishLevel || null) as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null }); setNotice('Профиль и настройки сохранены.'); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить настройки'); }
    });
  }

  return <Card><CardHeader><CardTitle>Профиль и параметры обучения</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm">Имя или никнейм<Input required aria-label="Имя или никнейм" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label className="space-y-2 text-sm">Ежедневная цель, минут<Input required aria-label="Ежедневная цель в минутах" type="number" min="1" max="1440" value={form.dailyGoalMinutes} onChange={(event) => setForm({ ...form, dailyGoalMinutes: Number(event.target.value) })} /></label><label className="space-y-2 text-sm">Текущий уровень английского<select aria-label="Текущий уровень английского" className="h-10 w-full rounded-md border border-input bg-background px-3" value={form.englishLevel} onChange={(event) => setForm({ ...form, englishLevel: event.target.value })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label><label className="space-y-2 text-sm">Целевой уровень английского<select aria-label="Целевой уровень английского" className="h-10 w-full rounded-md border border-input bg-background px-3" value={form.targetEnglishLevel} onChange={(event) => setForm({ ...form, targetEnglishLevel: event.target.value })}>{levels.map((level) => <option key={level}>{level}</option>)}</select></label><label className="space-y-2 text-sm sm:col-span-2">Часовой пояс (IANA)<Input required aria-label="Часовой пояс" placeholder="Europe/Moscow" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /><span className="text-xs text-muted-foreground">Например: Europe/Moscow, Europe/Berlin, America/New_York.</span></label>{error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}{notice && <p role="status" className="text-sm text-green-500 sm:col-span-2">{notice}</p>}<Button type="submit" disabled={pending} className="sm:col-span-2"><Save className="mr-2 h-4 w-4" />Сохранить настройки</Button></form></CardContent></Card>;
}
