'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookMarked, Search, Sparkles, Trash2 } from 'lucide-react';
import { deleteJournalEntry, saveJournalEntry } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Entry = {
  id: number;
  date: string;
  title: string | null;
  content: string;
  tags: string | null;
  mood: string | null;
  learned: string | null;
  challenges: string | null;
  plans: string | null;
};

type DailyDraft = { title: string; content: string; date: string; hasActivity: boolean };
const today = () => new Date().toISOString().slice(0, 10);

export function JournalBoard({ entries, draft }: { entries: Entry[]; draft: DailyDraft }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ date: today(), title: '', content: '', learned: '', challenges: '', plans: '', mood: '', tags: '' });

  const filtered = useMemo(() => entries.filter((entry) => !query || [entry.date, entry.title, entry.content, entry.learned, entry.challenges, entry.plans, entry.tags].some((value) => value?.toLowerCase().includes(query.toLowerCase()))), [entries, query]);

  function startNew() {
    setEditingId(null);
    setForm({ date: today(), title: '', content: '', learned: '', challenges: '', plans: '', mood: '', tags: '' });
    setFormOpen(true);
    setError('');
  }

  function startFromDraft() {
    setEditingId(null);
    setForm({ date: draft.date, title: draft.title, content: draft.content, learned: '', challenges: '', plans: '', mood: '', tags: 'auto-summary' });
    setFormOpen(true);
    setError('');
  }

  function edit(entry: Entry) {
    let tags: string[] = [];
    try { tags = entry.tags ? JSON.parse(entry.tags) as string[] : []; } catch { tags = []; }
    setEditingId(entry.id);
    setForm({ date: entry.date, title: entry.title || '', content: entry.content, learned: entry.learned || '', challenges: entry.challenges || '', plans: entry.plans || '', mood: entry.mood || '', tags: tags.join(', ') });
    setFormOpen(true);
    setError('');
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        await saveJournalEntry({ ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
        setFormOpen(false);
        setEditingId(null);
        setNotice('Запись сохранена.');
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить запись'); }
    });
  }

  function remove(entry: Entry) {
    if (!window.confirm(`Удалить запись от ${entry.date}?`)) return;
    startTransition(async () => {
      try { await deleteJournalEntry(entry.id); setNotice('Запись удалена.'); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось удалить запись'); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-3 text-4xl font-bold"><BookMarked className="h-10 w-10" />Дневник</h1><p className="mt-2 text-muted-foreground">Рефлексия, сложные моменты и следующий шаг.</p></div>
        <Button onClick={startNew}>Новая запись</Button>
      </div>

      <Card><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Черновик по фактической активности</CardTitle><p className="mt-1 text-sm text-muted-foreground">Данные собраны из занятий и истории повторений за {draft.date}.</p></div><Button variant="outline" onClick={startFromDraft} disabled={!draft.hasActivity}>Добавить в дневник</Button></CardHeader><CardContent>{draft.hasActivity ? <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{draft.content}</pre> : <p className="text-sm text-muted-foreground">Сегодня нет сохранённых занятий или повторений, поэтому отчёт не сгенерирован.</p>}</CardContent></Card>

      {formOpen && <Card><CardHeader><CardTitle>{editingId ? 'Редактировать запись' : 'Новая запись'}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><Input required aria-label="Дата записи" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /><Input aria-label="Заголовок записи" placeholder="Заголовок" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <textarea required aria-label="Содержание дневника" placeholder="Что изучил сегодня?" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="grid gap-3 sm:grid-cols-2"><textarea aria-label="Что было сложным" placeholder="Что было сложным?" value={form.challenges} onChange={(event) => setForm({ ...form, challenges: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><textarea aria-label="Что повторить" placeholder="Что хочу повторить?" value={form.learned} onChange={(event) => setForm({ ...form, learned: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="План на завтра" placeholder="План на завтра" value={form.plans} onChange={(event) => setForm({ ...form, plans: event.target.value })} /><Input aria-label="Настроение" placeholder="Настроение (необязательно)" value={form.mood} onChange={(event) => setForm({ ...form, mood: event.target.value })} /><Input aria-label="Теги" placeholder="Теги через запятую" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={pending}>Сохранить</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Отмена</Button></div>
      </form></CardContent></Card>}

      {notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
      {!formOpen && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Поиск записей дневника" className="pl-9" placeholder="Поиск по тексту, теме, планам или тегам" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {filtered.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Записей пока нет. Добавьте запись или используйте фактический черновик за сегодня.</CardContent></Card> : <div className="space-y-4">{filtered.map((entry) => { let tags: string[] = []; try { tags = entry.tags ? JSON.parse(entry.tags) as string[] : []; } catch { tags = []; } return <Card key={entry.id}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{entry.title || 'Запись дневника'}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{entry.date}{entry.mood ? ` · ${entry.mood}` : ''}</p></div><div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => edit(entry)}>Изменить</Button><Button variant="ghost" size="icon" aria-label="Удалить запись" onClick={() => remove(entry)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap text-sm">{entry.content}</p>{entry.challenges && <p className="text-sm"><strong>Сложности:</strong> {entry.challenges}</p>}{entry.learned && <p className="text-sm"><strong>Повторить:</strong> {entry.learned}</p>}{entry.plans && <p className="text-sm"><strong>План:</strong> {entry.plans}</p>}{tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge variant="outline" key={tag}>{tag}</Badge>)}</div>}</CardContent></Card>; })}</div>}
    </div>
  );
}
