'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, RotateCcw, Save } from 'lucide-react';
import { createLearningSession } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { elapsedFocusMinutes, formatTimer, normalizeFocusState, pauseFocusTimer, remainingSeconds, startFocusTimer, type FocusTimerState } from '@/lib/focus-timer';

const STORAGE_KEY = 'levelup.focus.v1';
const defaultState: FocusTimerState = { durationSeconds: 25 * 60, elapsedBeforeRunSeconds: 0, runningSince: null, status: 'idle', direction: 'coding', category: 'fundamentals', topic: '' };
const codingCategories = ['fundamentals', 'algorithms', 'problem_solving', 'projects', 'tools', 'computer_science'];
const englishCategories = ['vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing', 'pronunciation', 'immersion'];

export function FocusTimer() {
  const router = useRouter();
  const [state, setState] = useState<FocusTimerState>(defaultState);
  const [now, setNow] = useState(Date.now());
  const [durationInput, setDurationInput] = useState('25');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = normalizeFocusState(JSON.parse(saved));
        if (parsed) {
          setState(parsed);
          setDurationInput(String(Math.floor(parsed.durationSeconds / 60)));
        }
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.status !== 'running') return;
    const intervalId = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (remainingSeconds(state, time) === 0) {
        setState((current) => pauseFocusTimer(current, time));
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Фокус-сессия завершена', { body: 'Подтвердите и сохраните занятие, если вы действительно занимались.' });
        }
      }
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [state]);

  const remaining = remainingSeconds(state, now);
  const elapsedMinutes = elapsedFocusMinutes(state, now);
  const categories = state.direction === 'english' ? englishCategories : codingCategories;

  function start() {
    setError('');
    setState((current) => startFocusTimer(current, Date.now()));
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  }

  function pause() { setState((current) => pauseFocusTimer(current, Date.now())); }

  function reset() {
    if (state.status !== 'idle' && !window.confirm('Сбросить таймер? Незавершённое время не попадёт в статистику.')) return;
    setState({ ...defaultState, direction: state.direction, category: categories[0], topic: '' });
    setDurationInput('25');
    setError('');
  }

  function setDuration(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      setError('Укажите длительность от 1 до 180 минут.');
      return;
    }
    setError('');
    setDurationInput(String(minutes));
    setState((current) => ({ ...current, durationSeconds: minutes * 60, elapsedBeforeRunSeconds: 0, runningSince: null, status: 'idle' }));
  }

  function saveSession() {
    if (state.status !== 'completed' || elapsedMinutes < 1) return;
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const result = await createLearningSession({
          type: state.direction,
          category: state.category,
          topic: state.topic,
          durationMinutes: elapsedMinutes,
          difficulty: 'medium',
          notes: 'Подтверждённая сессия из Focus Timer.',
        });
        setNotice(`Сессия сохранена: ${elapsedMinutes} мин., +${result.xpAwarded} XP.`);
        setState({ ...defaultState, direction: state.direction, category: categories[0], topic: '' });
        setDurationInput('25');
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить сессию'); }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-4xl font-bold">Фокус</h1><p className="mt-2 text-muted-foreground">Таймер не начисляет XP сам по себе — завершённую сессию нужно подтвердить.</p></div>
      <Card><CardHeader><CardTitle>Pomodoro / Deep Work</CardTitle></CardHeader><CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm">Направление<select aria-label="Направление обучения" className="h-10 w-full rounded-md border border-input bg-background px-3" value={state.direction} disabled={state.status === 'running'} onChange={(event) => { const direction = event.target.value as 'english' | 'coding'; setState((current) => ({ ...current, direction, category: direction === 'english' ? englishCategories[0] : codingCategories[0] })); }}><option value="english">Английский</option><option value="coding">Программирование</option></select></label><label className="space-y-2 text-sm">Категория<select aria-label="Категория занятия" className="h-10 w-full rounded-md border border-input bg-background px-3" value={state.category} disabled={state.status === 'running'} onChange={(event) => setState((current) => ({ ...current, category: event.target.value }))}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label></div>
        <Input aria-label="Тема фокус-сессии" placeholder="Тема занятия (необязательно)" value={state.topic} disabled={state.status === 'running'} onChange={(event) => setState((current) => ({ ...current, topic: event.target.value }))} />
        <div className="flex flex-wrap items-center justify-center gap-2">{[25, 50, 90].map((minutes) => <Button key={minutes} variant={Number(durationInput) === minutes ? 'default' : 'outline'} disabled={state.status === 'running'} onClick={() => setDuration(minutes)}>{minutes} мин</Button>)}<Input aria-label="Длительность в минутах" type="number" min="1" max="180" value={durationInput} disabled={state.status === 'running'} onChange={(event) => { setDurationInput(event.target.value); const value = Number(event.target.value); if (value >= 1 && value <= 180) setDuration(value); }} className="w-24" /></div>
        <div className="py-2 text-center"><p aria-live="polite" className="font-mono text-7xl font-bold tabular-nums sm:text-8xl">{formatTimer(remaining)}</p><p className="mt-3 text-sm text-muted-foreground">{state.status === 'running' ? 'Идёт фокус-сессия' : state.status === 'paused' ? 'Пауза' : state.status === 'completed' ? 'Время завершено — подтвердите фактическое занятие' : 'Готов к запуску'}</p></div>
        <div className="flex justify-center gap-3">{state.status === 'running' ? <Button size="lg" onClick={pause}><Pause className="mr-2 h-4 w-4" />Пауза</Button> : state.status !== 'completed' ? <Button size="lg" onClick={start}><Play className="mr-2 h-4 w-4" />{state.status === 'paused' ? 'Продолжить' : 'Старт'}</Button> : <Button size="lg" onClick={saveSession} disabled={pending || elapsedMinutes < 1}><Save className="mr-2 h-4 w-4" />Подтвердить и сохранить · {elapsedMinutes} мин</Button>}<Button variant="outline" size="lg" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Сброс</Button></div>
        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-center text-sm text-green-500">{notice}</p>}
      </CardContent></Card>
      <Card><CardContent className="pt-6 text-sm text-muted-foreground">Таймер сохраняет состояние в этом браузере и рассчитывает время по временным отметкам, поэтому пауза и обновление страницы не обнуляют прогресс. Сессия попадёт в статистику и начислит XP только после явного подтверждения.</CardContent></Card>
    </div>
  );
}
