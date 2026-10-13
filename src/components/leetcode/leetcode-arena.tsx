'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Trash2, Unplug, Zap } from 'lucide-react';
import { addLeetCodeTask, deleteLeetCodeTask } from '@/lib/actions';
import { solvedPercent } from '@/lib/leetcode-adapter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Snapshot = { id: number; totalSolved: number; easySolved: number; mediumSolved: number; hardSolved: number; totalQuestions: number | null; ranking: number | null; capturedAt: Date };
type Task = { id: number; slug: string; title: string; difficulty: string; topics: string | null; status: string; solvedAt: Date | null; notes: string | null; xpAwarded: number };
type Connection = { username: string; totalSolved: number; easySolved: number; mediumSolved: number; hardSolved: number; ranking: number | null; lastSyncAt: Date | null; syncError: string | null };

async function callIntegration(action: 'connect' | 'sync' | 'disconnect', username?: string) {
  const response = await fetch('/api/integrations/leetcode', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, username }),
  });
  const payload = await response.json() as { error?: string; username?: string; stats?: { totalSolved: number } };
  if (!response.ok) throw new Error(payload.error || `Ошибка API (${response.status})`);
  return payload;
}

export function LeetCodeArena({ connection, snapshots, tasks }: { connection: Connection | null; snapshots: Snapshot[]; tasks: Task[] }) {
  const router = useRouter();
  const [username, setUsername] = useState(connection?.username || '');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: '', title: '', difficulty: 'Easy', topics: '', solvedAt: '', notes: '', status: 'not_started' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function connect() {
    setError(''); setNotice('');
    startTransition(async () => {
      try { const result = await callIntegration('connect', username); setNotice(`Подключен публичный профиль ${result.username}.`); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось подключить профиль'); }
    });
  }

  function sync() {
    setError(''); setNotice('');
    startTransition(async () => {
      try { const result = await callIntegration('sync'); setNotice(`Синхронизировано: ${result.stats?.totalSolved ?? 0} решённых задач.`); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Синхронизация не удалась'); }
    });
  }

  function disconnect() {
    if (!window.confirm('Отключить LeetCode и удалить сохранённые снимки статистики? Личный список задач останется.')) return;
    startTransition(async () => { try { await callIntegration('disconnect'); setNotice('Интеграция отключена, снимки статистики удалены.'); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отключить интеграцию'); } });
  }

  function saveTask(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    startTransition(async () => {
      try { await addLeetCodeTask({ ...form, topics: form.topics.split(',').map((topic) => topic.trim()).filter(Boolean) }); setForm({ slug: '', title: '', difficulty: 'Easy', topics: '', solvedAt: '', notes: '', status: 'not_started' }); setShowForm(false); setNotice('Задача добавлена в личный журнал. Внешний счётчик сам по себе не создает записи задач.'); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось добавить задачу'); }
    });
  }

  function removeTask(task: Task) {
    if (!window.confirm(`Удалить задачу «${task.title}»? XP корректируется, если он начислялся.`)) return;
    startTransition(async () => { try { const result = await deleteLeetCodeTask(task.id); setNotice(result.xpRemoved ? `Удалено; отозвано ${result.xpRemoved} XP.` : 'Задача удалена.'); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить задачу'); } });
  }

  const latest = snapshots[0];
  const prior = snapshots[1];
  const change = latest && prior ? latest.totalSolved - prior.totalSolved : null;

  return <div className="space-y-6">
    <div><h1 className="flex items-center gap-3 text-4xl font-bold"><Zap className="h-10 w-10 text-yellow-500" />LeetCode Arena</h1><p className="mt-2 text-muted-foreground">Публичная статистика и ваш отдельный личный журнал задач.</p></div>
    {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-md border border-green-500/30 p-3 text-sm text-green-500">{notice}</p>}
    <Card><CardHeader><CardTitle>Публичный аккаунт</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Используется публичный неофициальный GraphQL endpoint LeetCode. Пароль и cookies не нужны; доступность и схема могут меняться. Получаются только агрегированные открытые счётчики, не история принятых решений.</p>{connection ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">@{connection.username}</p><p className="text-xs text-muted-foreground">Последняя синхронизация: {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString('ru-RU') : 'ещё не синхронизировался'}</p></div><div className="flex gap-2"><Button onClick={sync} disabled={pending}><RefreshCw className="mr-2 h-4 w-4" />Синхронизировать</Button><Button variant="outline" onClick={disconnect} disabled={pending}><Unplug className="mr-2 h-4 w-4" />Отключить</Button></div></div>{connection.syncError && <p role="alert" className="text-sm text-destructive">Последняя ошибка синхронизации: {connection.syncError}</p>}</> : <div className="space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="LeetCode username" placeholder="LeetCode username" value={username} onChange={(event) => setUsername(event.target.value)} /><Button onClick={connect} disabled={pending || !username.trim()}>{pending ? 'Подключение…' : 'Подключить и получить статистику'}</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>}</CardContent></Card>
    {connection && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Решено всего" value={connection.totalSolved} /><Metric title="Easy" value={connection.easySolved} /><Metric title="Medium" value={connection.mediumSolved} /><Metric title="Hard" value={connection.hardSolved} /></div><Card><CardHeader><CardTitle>История снимков</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Публичная статистика не содержит надёжную историю решённых задач, поэтому изменение показывается только между сохранёнными снимками.</p>{change !== null && <p className="mt-3 text-lg font-semibold">Изменение с прошлого снимка: {change >= 0 ? '+' : ''}{change} задач</p>}{latest?.ranking !== null && latest?.ranking !== undefined && <p className="mt-2 text-sm">Публичный рейтинг: {latest.ranking.toLocaleString('ru-RU')}</p>}{latest?.totalQuestions ? <p className="mt-2 text-sm">Решено от общего числа ({latest.totalQuestions}): {solvedPercent(latest.totalSolved, latest.totalQuestions)}%</p> : <p className="mt-2 text-sm text-muted-foreground">Общее число задач недоступно в ответе источника.</p>}{snapshots.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Снимков ещё нет.</p> : <ul className="mt-4 max-h-48 space-y-2 overflow-auto">{snapshots.map((snapshot) => <li key={snapshot.id} className="flex justify-between border-b border-border py-2 text-sm"><span>{new Date(snapshot.capturedAt).toLocaleString('ru-RU')}</span><span>{snapshot.totalSolved} solved · E {snapshot.easySolved} / M {snapshot.mediumSolved} / H {snapshot.hardSolved}</span></li>)}</ul>}</CardContent></Card></>}
    <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle>Мой журнал задач</CardTitle><p className="mt-1 text-sm text-muted-foreground">Дата решения, темы, заметки и статус вносятся вручную. Не выводятся из общего счётчика.</p></div><Button variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Добавить задачу</Button></CardHeader><CardContent className="space-y-4">{showForm && <form onSubmit={saveTask} className="grid gap-3 sm:grid-cols-2"><Input required aria-label="LeetCode slug" placeholder="Slug (two-sum)" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /><Input required aria-label="Название задачи" placeholder="Название задачи" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><select aria-label="Сложность задачи" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select><Input aria-label="Темы задачи" placeholder="Темы через запятую" value={form.topics} onChange={(event) => setForm({ ...form, topics: event.target.value })} /><Input aria-label="Дата решения" type="date" value={form.solvedAt} onChange={(event) => setForm({ ...form, solvedAt: event.target.value })} /><select aria-label="Статус задачи" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="not_started">Не начата</option><option value="solved">Решена</option><option value="review">Повторить</option><option value="mastered">Освоена</option></select><textarea aria-label="Заметки к задаче" placeholder="Заметки о решении" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><Button type="submit" disabled={pending}>Сохранить задачу</Button></form>}{tasks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Личный список пуст. Данные не импортируются из агрегированного счётчика LeetCode.</p> : <div className="divide-y divide-border">{tasks.map((task) => { let topics: string[] = []; try { topics = task.topics ? JSON.parse(task.topics) as string[] : []; } catch { topics = []; } return <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><a className="font-semibold text-primary hover:underline" href={`https://leetcode.com/problems/${task.slug}/`} target="_blank" rel="noreferrer">{task.title}</a><p className="text-xs text-muted-foreground">{task.difficulty}{topics.length ? ` · ${topics.join(', ')}` : ''}{task.solvedAt ? ` · решена ${new Date(task.solvedAt).toLocaleDateString('ru-RU')}` : ''}</p>{task.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{task.notes}</p>}</div><div className="flex items-center gap-2"><Badge variant="outline">{task.status}</Badge><Button size="icon" variant="ghost" aria-label={`Удалить ${task.title}`} onClick={() => removeTask(task)} disabled={pending}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>; })}</div>}</CardContent></Card>
  </div>;
}

function Metric({ title, value }: { title: string; value: number }) {
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value.toLocaleString('ru-RU')}</p></CardContent></Card>;
}
