'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Plus, Search, Trash2 } from 'lucide-react';
import { addCodingNote, deleteCodingNote, reviewCodingNote } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CodingNote = {
  id: number;
  prompt: string;
  answer: string;
  language: string | null;
  topic: string | null;
  tags: string | null;
  status: string;
  correctCount: number;
  incorrectCount: number;
  nextReviewAt: Date | null;
};

const qualities = [
  { value: 0, label: 'Не вспомнил' },
  { value: 3, label: 'С подсказкой' },
  { value: 4, label: 'Самостоятельно' },
  { value: 5, label: 'Уверенно' },
];

export function CodingNotes({ notes }: { notes: CodingNote[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ prompt: '', answer: '', language: '', topic: '', tags: '' });

  const dueNotes = useMemo(() => notes.filter((note) => !note.nextReviewAt || note.nextReviewAt <= new Date()), [notes]);
  const visible = notes.filter((note) => {
    const matches = !query || `${note.prompt} ${note.answer} ${note.topic || ''} ${note.language || ''}`.toLowerCase().includes(query.toLowerCase());
    return matches && (!dueOnly || dueNotes.some((due) => due.id === note.id));
  });
  const current = dueNotes[0];

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await addCodingNote({ ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
        setForm({ prompt: '', answer: '', language: '', topic: '', tags: '' });
        setShowForm(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить заметку');
      }
    });
  }

  function review(quality: number) {
    if (!current) return;
    setError('');
    startTransition(async () => {
      try {
        await reviewCodingNote(current.id, quality);
        setShowAnswer(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить повторение');
      }
    });
  }

  function removeNote(note: CodingNote) {
    if (!window.confirm('Удалить эту заметку и историю повторений?')) return;
    setError('');
    startTransition(async () => {
      try {
        await deleteCodingNote(note.id);
        setShowAnswer(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить заметку');
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-green-400" />Заметки по программированию</CardTitle><p className="mt-1 text-sm text-muted-foreground">Вопросы и отдельные ответы для повторения</p></div>
        <Button variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Добавить заметку</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && <form onSubmit={save} className="grid gap-3 rounded-lg border border-border p-4">
          <textarea required aria-label="Заметка или вопрос" placeholder="Заметка / вопрос: например, чем отличается map от forEach?" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <textarea required aria-label="Ответ на заметку" placeholder="Ответ / объяснение" value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Язык" placeholder="Язык: TypeScript" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} /><Input aria-label="Тема" placeholder="Тема" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} /><Input aria-label="Теги" placeholder="Теги через запятую" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></div>
          <Button type="submit" disabled={pending}>Сохранить заметку</Button>
        </form>}

        <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Всего заметок</p><p className="text-3xl font-bold">{notes.length}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">К повторению</p><p className="text-3xl font-bold">{dueNotes.length}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Освоено</p><p className="text-3xl font-bold">{notes.filter((note) => note.status === 'mastered').length}</p></CardContent></Card></div>

        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Повторение заметок</p><p className="text-xs text-muted-foreground">Ответ скрыт до самостоятельной попытки</p></div><Badge variant="outline">SM-2 · вспомогательная модель</Badge></div>{!current ? <p className="mt-4 text-sm text-muted-foreground">Сегодня заметок для повторения нет.</p> : <div className="mt-4 space-y-3"><p className="whitespace-pre-wrap font-medium">{current.prompt}</p>{showAnswer ? <div className="space-y-3"><div className="rounded-md bg-background p-3 text-sm whitespace-pre-wrap">{current.answer}</div><div className="flex flex-wrap gap-2">{qualities.map((quality) => <Button key={quality.value} size="sm" disabled={pending} onClick={() => review(quality.value)}>{quality.label}</Button>)}</div></div> : <Button onClick={() => setShowAnswer(true)}>Показать ответ</Button>}</div>}</div>

        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Поиск заметок" className="pl-9" placeholder="Поиск по заметкам, ответам, темам" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Button variant={dueOnly ? 'default' : 'outline'} onClick={() => setDueOnly((value) => !value)}>Только к повторению</Button></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {visible.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Заметок не найдено.</p> : <div className="divide-y divide-border">{visible.map((note) => <div key={note.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-medium">{note.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{note.language || 'Без языка'}{note.topic ? ` · ${note.topic}` : ''} · {note.correctCount} верно · {note.incorrectCount} ошибок</p></div><div className="flex items-center gap-2"><Badge variant="outline">{note.status === 'mastered' ? 'освоено' : !note.nextReviewAt || note.nextReviewAt <= new Date() ? 'к повторению' : 'запланировано'}</Badge><Button type="button" size="icon" variant="ghost" aria-label="Удалить заметку" title="Удалить заметку и историю" disabled={pending} onClick={() => removeNote(note)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}
      </CardContent>
    </Card>
  );
}
