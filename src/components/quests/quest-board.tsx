'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { confirmQuestCompletion, createQuest, deleteQuest, toggleQuestPause } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type Quest = { id: number; title: string; description: string; type: string; category: string; targetValue: number; currentValue: number; unit: string; difficulty: string; xpReward: number; status: string; startDate: Date; endDate: Date; progressPercent: number; autoTracked: boolean };
const initialForm = { title: '', description: '', type: 'daily', category: 'coding', targetValue: 25, unit: 'minutes', difficulty: 'medium', xpReward: 25 };

export function QuestBoard({ quests }: { quests: Quest[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    startTransition(async () => {
      try { await createQuest(form); setForm(initialForm); setFormOpen(false); setNotice('Квест создан.'); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать квест'); }
    });
  }

  function complete(quest: Quest) {
    if (!window.confirm(`Подтвердить выполнение квеста «${quest.title}» и получить ${quest.xpReward} XP?`)) return;
    setError('');
    startTransition(async () => {
      try { const result = await confirmQuestCompletion(quest.id); setNotice(result.alreadyCompleted ? 'Квест уже завершён; повторной награды нет.' : `Квест завершён: +${result.xpAwarded} XP.`); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось завершить квест'); }
    });
  }

  function pause(quest: Quest) {
    startTransition(async () => {
      try { await toggleQuestPause(quest.id); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось изменить статус'); }
    });
  }

  function remove(quest: Quest) {
    if (!window.confirm(`Удалить квест «${quest.title}»? Уже начисленный XP не отзывается.`)) return;
    startTransition(async () => {
      try { await deleteQuest(quest.id); setNotice('Квест удалён.'); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить квест'); }
    });
  }

  const active = quests.filter((quest) => quest.status === 'active' || quest.status === 'paused');
  const completed = quests.filter((quest) => quest.status === 'completed');

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-4xl font-bold">Квесты</h1><p className="mt-2 text-muted-foreground">Отслеживаемые квесты обновляются из сессий; ручные завершаются вашим подтверждением.</p></div><Button onClick={() => setFormOpen((value) => !value)}><Plus className="mr-2 h-4 w-4" />Новый квест</Button></div>
    {formOpen && <Card><CardHeader><CardTitle>Создать квест</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <Input required aria-label="Название квеста" placeholder="Название" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      <select aria-label="Период квеста" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="daily">Ежедневный</option><option value="weekly">Недельный</option><option value="milestone">Долгосрочный</option></select>
      <select aria-label="Направление квеста" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="coding">Программирование</option><option value="english">Английский</option><option value="general">Общий / вручную</option></select>
      <select aria-label="Тип измерения" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="minutes">Минуты (автотрекинг)</option><option value="sessions">Занятия (автотрекинг)</option><option value="tasks">Задачи (ручное подтверждение)</option><option value="words">Слова (ручное подтверждение)</option><option value="custom">Другое (ручное подтверждение)</option></select>
      <Input required aria-label="Целевое значение квеста" type="number" min="1" step="1" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: Number(event.target.value) })} />
      <Input required aria-label="XP награда" type="number" min="0" step="1" value={form.xpReward} onChange={(event) => setForm({ ...form, xpReward: Number(event.target.value) })} />
      <select aria-label="Сложность квеста" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="easy">Лёгкий</option><option value="medium">Средний</option><option value="hard">Сложный</option></select>
      <textarea aria-label="Описание квеста" placeholder="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>Создать квест</Button>
    </form></CardContent></Card>}
    {error && !formOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Активные квесты</h2>{active.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Активных квестов пока нет. Создайте квест, соответствующий вашим планам.</CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{active.map((quest) => <Card key={quest.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{quest.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{quest.description}</p></div><Badge variant={quest.status === 'paused' ? 'secondary' : 'default'}>{quest.status === 'paused' ? 'Пауза' : quest.type === 'daily' ? 'Ежедневный' : quest.type === 'weekly' ? 'Недельный' : 'Долгосрочный'}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span>{quest.autoTracked ? 'Из занятий' : 'Ручное подтверждение'}</span><span>{quest.currentValue} / {quest.targetValue} {quest.unit}</span></div><Progress value={quest.progressPercent} /><p className="text-xs text-muted-foreground">Награда: {quest.xpReward} XP · до {new Date(quest.endDate).toLocaleDateString('ru-RU')}</p><div className="flex flex-wrap gap-2">{(!quest.autoTracked || quest.currentValue >= quest.targetValue) && <Button size="sm" onClick={() => complete(quest)} disabled={pending || quest.status === 'paused'}><Check className="mr-1 h-4 w-4" />{quest.autoTracked ? 'Забрать награду' : 'Завершить'}</Button>}<Button size="sm" variant="outline" onClick={() => pause(quest)} disabled={pending}>{quest.status === 'paused' ? <><Play className="mr-1 h-4 w-4" />Продолжить</> : <><Pause className="mr-1 h-4 w-4" />Пауза</>}</Button><Button size="icon" variant="ghost" aria-label={`Удалить квест ${quest.title}`} onClick={() => remove(quest)} disabled={pending}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>)}</div>}</section>
    {completed.length > 0 && <section className="space-y-3"><h2 className="text-2xl font-semibold">Завершённые</h2><div className="grid gap-3 sm:grid-cols-2">{completed.map((quest) => <Card key={quest.id}><CardContent className="flex items-center justify-between gap-3 pt-6"><div><p className="font-medium">{quest.title}</p><p className="text-xs text-muted-foreground">{quest.currentValue} / {quest.targetValue} {quest.unit}</p></div><Badge>+{quest.xpReward} XP</Badge></CardContent></Card>)}</div></section>}
  </div>;
}
