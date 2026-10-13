'use client';

import { useState, useTransition } from 'react';
import { Github, RefreshCw, Trash2 } from 'lucide-react';
import { setGitHubRepositoryTracked } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Connection = { username: string; lastSyncAt: Date | null; totalRepos: number; totalCommits: number; syncError: string | null };
type Repo = { id: number; name: string; fullName: string; description: string | null; language: string | null; isFork: boolean; isTracked: boolean; htmlUrl: string; pushedAt: Date | null };
type Day = { date: string; commits: number; pullRequests: number; issues: number; repositories: string | null };
type Contribution = { date: string; contributionCount: number; source: string };

export function GitHubDashboard({ connection, repositories, activity, contributions }: { connection: Connection | null; repositories: Repo[]; activity: Day[]; contributions: Contribution[] }) {
  const [username, setUsername] = useState(connection?.username || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const maxCommits = Math.max(1, ...activity.map((day) => day.commits));
  const contributionMap = new Map(contributions.map((day) => [day.date, day]));
  const today = new Date();
  const gridStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 364));
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const contributionCells = Array.from({ length: 53 * 7 }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * 86400000).toISOString().slice(0, 10);
    return { date, record: contributionMap.get(date) };
  });
  const contributionTotal = contributions.reduce((sum, day) => sum + day.contributionCount, 0);
  const contributionSource = contributions.some((day) => day.source === 'github-graphql') ? 'GitHub GraphQL Contributions (официальные дневные totals)' : 'Публичные REST Events (только полученные события; пропуски — неизвестные данные)';

  function sync() {
    setError(''); setNotice('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/integrations/github', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) });
        const result = await response.json() as { error?: string; repositories?: number; commits?: number; activeDays?: number };
        if (!response.ok) throw new Error(result.error || `GitHub API HTTP ${response.status}`);
        setNotice(`Синхронизировано репозиториев: ${result.repositories}; событий коммитов: ${result.commits}; активных дней: ${result.activeDays}.`);
        window.location.reload();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'GitHub sync failed'); }
    });
  }

  function disconnect() {
    if (!window.confirm('Отключить GitHub и удалить локально сохранённые репозитории и активность?')) return;
    startTransition(async () => { try { await fetch('/api/integrations/github', { method: 'DELETE' }); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отключить GitHub'); } });
  }

  function toggle(repo: Repo) {
    startTransition(async () => { try { await setGitHubRepositoryTracked(repo.id, !repo.isTracked); window.location.reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось обновить репозиторий'); } });
  }

  return <div className="space-y-6">
    <div><h1 className="flex items-center gap-3 text-4xl font-bold"><Github className="h-10 w-10" />GitHub</h1><p className="mt-2 text-muted-foreground">Публичные репозитории и доступная активность. GitHub не является доказательством качества знаний.</p></div>
    {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="rounded-md border border-green-500/30 p-3 text-sm text-green-500">{notice}</p>}
    <Card><CardHeader><CardTitle>Подключение</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Username используется для публичных запросов. Если в серверном .env задан GITHUB_TOKEN, он применяется только на сервере для расширения лимита API и не передаётся в браузер.</p><div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="GitHub username" placeholder="GitHub username" value={username} onChange={(event) => setUsername(event.target.value)} /><Button onClick={sync} disabled={pending || !username.trim()}><RefreshCw className="mr-2 h-4 w-4" />{pending ? 'Синхронизация…' : 'Синхронизировать'}</Button>{connection && <Button variant="outline" onClick={disconnect} disabled={pending}><Trash2 className="mr-2 h-4 w-4" />Отключить</Button>}</div>{connection && <p className="text-xs text-muted-foreground">Последнее обновление: {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString('ru-RU') : 'нет'} · API repos: {connection.totalRepos} · коммитов в доступных событиях: {connection.totalCommits}</p>}{connection?.syncError && <p className="text-sm text-destructive">Ошибка: {connection.syncError}</p>}</CardContent></Card>
    {!connection ? <Card><CardContent className="py-10 text-center text-muted-foreground">Подключите публичный username, чтобы загрузить данные.</CardContent></Card> : <><div className="grid gap-4 sm:grid-cols-3"><Metric title="Репозитории" value={repositories.length} /><Metric title="Forks" value={repositories.filter((repo) => repo.isFork).length} /><Metric title="Активных дней из доступных событий" value={activity.length} /></div><Card><CardHeader><CardTitle>Contributions · последние 52 недели</CardTitle></CardHeader><CardContent><div className="overflow-x-auto pb-2"><div className="min-w-[760px]"><div className="mb-2 grid grid-flow-col grid-rows-1 text-xs text-muted-foreground">{Array.from({ length: 12 }, (_, i) => { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + i, 1)); return <span key={i} className="col-span-4">{date.toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' })}</span>; })}</div><div className="grid grid-rows-7 grid-flow-col gap-[3px]">{contributionCells.map(({ date, record }) => { const count = record?.contributionCount; const color = count === undefined ? 'bg-transparent border border-dashed border-border/50' : count === 0 ? 'bg-secondary' : count < 3 ? 'bg-emerald-950' : count < 6 ? 'bg-emerald-800' : count < 10 ? 'bg-emerald-600' : 'bg-emerald-400'; return <div key={date} title={count === undefined ? `${date}: нет данных` : `${date}: ${count} contributions`} aria-label={count === undefined ? `${date}: нет данных` : `${date}: ${count} contributions`} className={`h-3 w-3 rounded-[2px] ${color}`} />; })}</div></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Всего в сохранённых данных: {contributions.length ? contributionTotal : 'нет данных'}</span><div className="flex items-center gap-1"><span>Меньше</span>{['bg-secondary', 'bg-emerald-950', 'bg-emerald-800', 'bg-emerald-600', 'bg-emerald-400'].map((color) => <span key={color} className={`h-3 w-3 rounded-[2px] ${color}`} />)}<span>Больше</span><span className="ml-2 border border-dashed border-border/50 px-1">нет данных</span></div></div><p className="mt-3 text-xs text-muted-foreground">Источник: {contributions.length ? contributionSource : 'данные contributions ещё не синхронизированы'}. Для полной официальной сетки нужен серверный GITHUB_TOKEN с доступом к публичному профилю; без токена показываются только известные дни событий, остальные ячейки отмечены как неизвестные, а не нулевые.</p></CardContent></Card><Card><CardHeader><CardTitle>Публичные события активности</CardTitle></CardHeader><CardContent><div className="flex h-40 items-end gap-1 overflow-x-auto border-b border-border pb-2">{activity.length === 0 ? <p className="self-center text-sm text-muted-foreground">Нет доступных событий.</p> : activity.map((day) => <div key={day.date} title={`${day.date}: ${day.commits} коммитов`} className="min-w-3 flex-1 rounded-t bg-primary/80" style={{ height: `${day.commits / maxCommits * 100}%` }} />)}</div><p className="mt-3 text-xs text-muted-foreground">REST Events API ограничен последними публичными событиями; это не полная история contributions.</p></CardContent></Card><Card><CardHeader><CardTitle>Репозитории</CardTitle></CardHeader><CardContent>{repositories.length === 0 ? <p className="text-sm text-muted-foreground">Публичные репозитории не найдены.</p> : <div className="divide-y divide-border">{repositories.map((repo) => <div key={repo.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{repo.fullName}</a><p className="text-sm text-muted-foreground">{repo.description || 'Без описания'}{repo.language ? ` · ${repo.language}` : ''}</p></div><div className="flex items-center gap-2"><Badge variant={repo.isTracked ? 'default' : 'outline'}>{repo.isTracked ? 'Отслеживается' : 'Не отслеживается'}</Badge><Button size="sm" variant="outline" onClick={() => toggle(repo)} disabled={pending}>{repo.isTracked ? 'Убрать' : 'Отслеживать'}</Button></div></div>)}</div>}</CardContent></Card></>}
  </div>;
}

function Metric({ title, value }: { title: string; value: number }) { return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value.toLocaleString('ru-RU')}</p></CardContent></Card>; }
