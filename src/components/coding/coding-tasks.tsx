'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { addCodingTask, deleteCodingTask, recordCodingTaskAttempt } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseStringArray } from '@/lib/json';

type Task = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  difficulty: string;
  status: string;
  language: string | null;
  topics: string | null;
  solutionUrl: string | null;
  attempts: number;
  nextReviewAt: Date | null;
  xpAwarded: number;
};

const outcomes = [
  { value: 'solved', label: 'Решил сам' },
  { value: 'hint', label: 'С подсказкой' },
  { value: 'viewed_solution', label: 'Посмотрел решение' },
  { value: 'failed', label: 'Не решил' },
  { value: 'repeat', label: 'Повторил' },
] as const;

export function CodingTasks({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ title: '', description: '', type: 'algorithm', difficulty: 'easy', language: '', topic: '', solutionUrl: '' });

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await addCodingTask(form);
        setForm({ title: '', description: '', type: 'algorithm', difficulty: 'easy', language: '', topic: '', solutionUrl: '' });
        setShowForm(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить задачу');
      }
    });
  }

  function attempt(task: Task, outcome: typeof outcomes[number]['value']) {
    const confidence = outcome === 'solved' || outcome === 'repeat' ? 4 : outcome === 'hint' ? 3 : 1;
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const result = await recordCodingTaskAttempt(task.id, outcome, confidence);
        if (result.xpAwarded) setNotice(`Задача отмечена решённой: +${result.xpAwarded} XP`);
        else if (result.duplicateSolve) setNotice('Повторное решение сохранено; XP повторно не начислялся.');
        else setNotice('Попытка сохранена. История повторений обновлена.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить попытку');
      }
    });
  }

  function removeTask(task: Task) {
    if (!window.confirm(`Удалить задачу «${task.title}» и историю попыток?${task.xpAwarded > 0 ? ' Ранее начисленный XP будет вычтен.' : ''}`)) return;
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        const result = await deleteCodingTask(task.id);
        setNotice(result.xpRemoved ? `Задача удалена; ${result.xpRemoved} XP отозвано корректировкой.` : 'Задача и история попыток удалены.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить задачу');
      }
    });
  }

  const solved = tasks.filter((task) => task.status === 'completed').length;
  const due = tasks.filter((task) => task.status === 'completed' && task.nextReviewAt && task.nextReviewAt <= new Date()).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div><CardTitle>Практические задачи</CardTitle><p className="mt-1 text-sm text-muted-foreground">Личный журнал задач и попыток</p></div>
        <Button variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Добавить задачу</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Всего задач</p><p className="text-2xl font-bold">{tasks.length}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Решено</p><p className="text-2xl font-bold">{solved}</p></CardContent></Card><Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">К повторению</p><p className="text-2xl font-bold">{due}</p></CardContent></Card></div>
        {showForm && <form onSubmit={save} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <Input required aria-label="Название задачи" placeholder="Название задачи" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select aria-label="Тип задачи" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="algorithm">Алгоритмическая</option><option value="exercise">Упражнение</option><option value="project">Мини-проект</option><option value="bug_fix">Исправление ошибки</option><option value="refactor">Рефакторинг</option></select>
          <select aria-label="Сложность задачи" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="easy">Easy · 20 XP</option><option value="medium">Medium · 50 XP</option><option value="hard">Hard · 100 XP</option></select>
          <Input aria-label="Язык программирования" placeholder="Язык" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
          <Input aria-label="Тема задачи" placeholder="Тема" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
          <Input aria-label="Ссылка на задачу или решение" type="url" placeholder="Ссылка" value={form.solutionUrl} onChange={(event) => setForm({ ...form, solutionUrl: event.target.value })} />
          <textarea aria-label="Описание задачи" placeholder="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="sm:col-span-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit" disabled={pending}>Сохранить задачу</Button>
        </form>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
        {tasks.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Список пока пуст. Добавьте учебную или алгоритмическую задачу.</p> : <div className="divide-y divide-border">{tasks.map((task) => <div key={task.id} className="space-y-2 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{task.title}</p>{task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}<p className="mt-1 text-xs text-muted-foreground">{task.language || 'Без языка'}{parseStringArray(task.topics).length ? ` · ${parseStringArray(task.topics).join(', ')}` : ''} · {task.attempts} попыток · {task.xpAwarded} XP всего</p></div><div className="flex gap-2"><Badge variant="outline">{task.difficulty}</Badge><Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>{task.status === 'completed' ? 'решено' : task.status === 'in_progress' ? 'изучается' : 'не начато'}</Badge></div></div><div className="flex flex-wrap items-center gap-2">{outcomes.map((outcome) => <Button key={outcome.value} size="sm" variant={outcome.value === 'solved' ? 'default' : 'outline'} disabled={pending} onClick={() => attempt(task, outcome.value)}>{outcome.label}</Button>)}{task.solutionUrl && <a href={task.solutionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Открыть ссылку <ExternalLink className="h-3 w-3" /></a>}<Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => removeTask(task)} aria-label={`Удалить задачу ${task.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}
      </CardContent>
    </Card>
  );
}
