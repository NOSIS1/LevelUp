'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { changeGoalStatus, createGoal, deleteGoal, setManualGoalProgress, updateGoal } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type Goal = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  timeframe: string;
  priority: string;
  deadline: Date | null;
  status: string;
  progress: { value: number; progressPercent: number; daysLeft: number | null; forecastWeekly: number | null; source: 'tracked' | 'manual' };
};

type GoalForm = { title: string; description: string; type: string; category: string; targetValue: number; unit: string; timeframe: string; priority: string; deadline: string };
const initialForm: GoalForm = { title: '', description: '', type: 'time', category: 'coding', targetValue: 5, unit: 'hours', timeframe: 'weekly', priority: 'medium', deadline: '' };

export function GoalBoard({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [manualValues, setManualValues] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function startCreate() {
    setEditingId(null);
    setForm(initialForm);
    setFormOpen(true);
    setError('');
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description || '',
      type: goal.type,
      category: goal.category,
      targetValue: goal.targetValue,
      unit: goal.unit,
      timeframe: goal.timeframe,
      priority: goal.priority,
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : '',
    });
    setFormOpen(true);
    setError('');
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const data = {
          ...form,
          type: form.type as 'time' | 'count' | 'skill_level' | 'custom',
          category: form.category as 'english' | 'coding' | 'leetcode' | 'github' | 'general',
          timeframe: form.timeframe as 'daily' | 'weekly' | 'monthly' | 'custom',
          priority: form.priority as 'low' | 'medium' | 'high',
          deadline: form.deadline ? new Date(`${form.deadline}T23:59:59`) : null,
        };
        if (editingId) await updateGoal(editingId, data);
        else await createGoal(data);
        setFormOpen(false);
        setEditingId(null);
        setNotice('Цель сохранена.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить цель');
      }
    });
  }

  function remove(goal: Goal) {
    if (!window.confirm(`Удалить цель «${goal.title}»?`)) return;
    startTransition(async () => {
      try {
        await deleteGoal(goal.id);
        setNotice('Цель удалена.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить цель');
      }
    });
  }

  function updateStatus(goal: Goal) {
    const next = goal.status === 'paused' ? 'active' : 'paused';
    startTransition(async () => {
      try { await changeGoalStatus(goal.id, next); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось изменить статус'); }
    });
  }

  function setManual(goal: Goal) {
    startTransition(async () => {
      try {
        await setManualGoalProgress(goal.id, Number(manualValues[goal.id] ?? goal.currentValue));
        setNotice('Прогресс обновлён.');
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось обновить прогресс'); }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Новая цель</Button></div>
      {formOpen && <Card><CardHeader><CardTitle>{editingId ? 'Изменить цель' : 'Создать цель'}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Input required aria-label="Название цели" placeholder="Например: 5 часов программирования" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <select aria-label="Тип цели" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, unit: event.target.value === 'time' ? 'hours' : event.target.value === 'count' ? 'sessions' : 'points' })}><option value="time">Учебное время (автоматически)</option><option value="count">Число занятий (автоматически)</option><option value="skill_level">Оценка навыка (вручную)</option><option value="custom">Пользовательская цель (вручную)</option></select>
        <select aria-label="Направление цели" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="coding">Программирование</option><option value="english">Английский</option><option value="leetcode">LeetCode</option><option value="github">GitHub</option><option value="general">Общая</option></select>
        <Input required aria-label="Целевое значение" type="number" min="0.1" step="0.1" placeholder="Целевое значение" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: Number(event.target.value) })} />
        <select aria-label="Период цели" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.timeframe} onChange={(event) => setForm({ ...form, timeframe: event.target.value })}><option value="weekly">Недельная</option><option value="monthly">Месячная</option><option value="daily">Ежедневная</option><option value="custom">Долгосрочная</option></select>
        <select aria-label="Приоритет цели" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Низкий приоритет</option><option value="medium">Средний приоритет</option><option value="high">Высокий приоритет</option></select>
        <Input aria-label="Дедлайн" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
        <textarea aria-label="Описание цели" placeholder="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={pending}>Сохранить</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Отмена</Button></div>
      </form></CardContent></Card>}
      {error && !formOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
      {goals.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><p className="text-lg font-medium">Пока нет целей</p><p className="mt-2 text-sm">Создайте цель. Для времени и количества занятий прогресс будет браться из журнала автоматически.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{goals.map((goal) => <Card key={goal.id}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{goal.title}</CardTitle><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{goal.timeframe}</Badge><Badge variant={goal.status === 'paused' ? 'secondary' : 'default'}>{goal.status === 'completed' ? 'выполнена' : goal.status === 'paused' ? 'на паузе' : 'активна'}</Badge><Badge variant="outline">Приоритет: {goal.priority}</Badge></div></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label="Изменить цель" onClick={() => startEdit(goal)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Удалить цель" onClick={() => remove(goal)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardHeader><CardContent className="space-y-3">{goal.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{goal.description}</p>}<div className="flex justify-between text-sm"><span>Прогресс · {goal.progress.source === 'tracked' ? 'из журнала занятий' : 'ручной'}</span><span>{goal.progress.value.toFixed(1)} / {goal.targetValue} {goal.unit}</span></div><Progress value={goal.progress.progressPercent} /><p className="text-xs text-muted-foreground">{goal.progress.daysLeft === null ? 'Без дедлайна' : `${goal.progress.daysLeft} дн. до дедлайна`}{goal.progress.forecastWeekly === null ? ' · Недостаточно данных для темпа' : ` · Нужный темп: ${goal.progress.forecastWeekly.toFixed(1)} ${goal.unit}/нед.`}</p>{goal.progress.source === 'manual' && goal.status !== 'completed' && <div className="flex gap-2"><Input aria-label="Текущий прогресс" type="number" min="0" step="0.1" value={manualValues[goal.id] ?? goal.currentValue} onChange={(event) => setManualValues({ ...manualValues, [goal.id]: event.target.value })} /><Button variant="outline" onClick={() => setManual(goal)} disabled={pending}>Обновить</Button></div>}<Button size="sm" variant="outline" onClick={() => updateStatus(goal)} disabled={goal.status === 'completed' || pending}>{goal.status === 'paused' ? 'Возобновить' : 'Пауза'}</Button></CardContent></Card>)}</div>}
    </div>
  );
}
