'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search, Trash2, Upload } from 'lucide-react';
import { addWord, deleteWord, importWordsCsv, reviewWord } from '@/lib/actions';
import { wordsToCsv, type WordCsvRow } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Word = {
  id: number;
  word: string;
  translation: string;
  definition: string | null;
  example: string | null;
  partOfSpeech: string | null;
  tags: string | null;
  status: string;
  correctCount: number;
  incorrectCount: number;
  nextReviewAt: Date | null;
};

const qualityOptions = [
  { quality: 0, label: 'Не вспомнил' },
  { quality: 3, label: 'С трудом' },
  { quality: 4, label: 'Вспомнил' },
  { quality: 5, label: 'Легко' },
];

export function Vocabulary({ words }: { words: Word[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ word: '', translation: '', definition: '', example: '', partOfSpeech: '', tags: '' });

  const dueWords = useMemo(() => words.filter((word) => !word.nextReviewAt || word.nextReviewAt <= new Date()), [words]);
  const visibleWords = words.filter((word) => {
    const matches = !query || `${word.word} ${word.translation}`.toLowerCase().includes(query.toLowerCase());
    return matches && (!dueOnly || dueWords.some((due) => due.id === word.id));
  });
  const reviewed = words.reduce((sum, word) => sum + word.correctCount + word.incorrectCount, 0);
  const correct = words.reduce((sum, word) => sum + word.correctCount, 0);
  const accuracy = reviewed ? Math.round(correct / reviewed * 100) : null;

  function submitWord(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await addWord({ ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
        setForm({ word: '', translation: '', definition: '', example: '', partOfSpeech: '', tags: '' });
        setAdding(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось добавить слово');
      }
    });
  }

  function submitReview(quality: number) {
    const word = dueWords[0];
    if (!word) return;
    setError('');
    startTransition(async () => {
      try {
        await reviewWord(word.id, quality);
        setShowAnswer(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить повторение');
      }
    });
  }

  function removeWord(word: Word) {
    if (!window.confirm(`Удалить карточку «${word.word}» и историю её повторений?`)) return;
    setError('');
    startTransition(async () => {
      try {
        await deleteWord(word.id);
        setShowAnswer(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить карточку');
      }
    });
  }

  async function importFile(file?: File) {
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const result = await importWordsCsv(await file.text());
      setNotice(`Импортировано: ${result.imported}; пропущено дубликатов: ${result.skipped}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось импортировать CSV');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function exportCsv() {
    const rows: WordCsvRow[] = visibleWords.map((word) => ({
      word: word.word,
      translation: word.translation,
      definition: word.definition || '',
      example: word.example || '',
      partOfSpeech: word.partOfSpeech || '',
      tags: word.tags ? JSON.parse(word.tags) as string[] : [],
    }));
    const blob = new Blob(['\uFEFF', wordsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'levelup-vocabulary.csv';
    anchor.click();
    URL.revokeObjectURL(href);
  }

  const dueWord = dueWords[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Всего слов</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{words.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Освоено</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{words.filter((word) => word.status === 'mastered').length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Повторить сегодня</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{dueWords.length}</p><p className="text-xs text-muted-foreground">Точность: {accuracy === null ? 'Недостаточно данных' : `${accuracy}%`}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Повторение слов</CardTitle>
          <Badge variant="outline">Алгоритм SM-2 · вспомогательная оценка</Badge>
        </CardHeader>
        <CardContent>
          {!dueWord ? <p className="text-muted-foreground">Сегодня повторять нечего. Добавьте слова или возвращайтесь позже.</p> : (
            <div className="space-y-4">
              <p className="text-3xl font-semibold">{dueWord.word}</p>
              {showAnswer ? <div className="space-y-2"><p className="text-xl">{dueWord.translation}</p>{dueWord.definition && <p className="text-muted-foreground">{dueWord.definition}</p>}{dueWord.example && <p className="italic text-muted-foreground">{dueWord.example}</p>}<div className="flex flex-wrap gap-2">{qualityOptions.map((option) => <Button key={option.quality} disabled={pending} onClick={() => submitReview(option.quality)}>{option.label}</Button>)}</div></div> : <Button onClick={() => setShowAnswer(true)}>Показать ответ</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Мой словарь</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAdding((value) => !value)}><Plus className="mr-2 h-4 w-4" />Добавить</Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />Импорт CSV</Button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
            <Button variant="outline" onClick={exportCsv} disabled={visibleWords.length === 0}><Download className="mr-2 h-4 w-4" />Экспорт CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && <form onSubmit={submitWord} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <Input required aria-label="Английское слово" placeholder="Word / phrase" value={form.word} onChange={(event) => setForm({ ...form, word: event.target.value })} />
            <Input required aria-label="Перевод" placeholder="Перевод" value={form.translation} onChange={(event) => setForm({ ...form, translation: event.target.value })} />
            <Input aria-label="Определение" placeholder="Определение на английском" value={form.definition} onChange={(event) => setForm({ ...form, definition: event.target.value })} />
            <Input aria-label="Пример" placeholder="Пример предложения" value={form.example} onChange={(event) => setForm({ ...form, example: event.target.value })} />
            <Input aria-label="Часть речи" placeholder="Часть речи" value={form.partOfSpeech} onChange={(event) => setForm({ ...form, partOfSpeech: event.target.value })} />
            <Input aria-label="Теги" placeholder="Теги через запятую" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            <Button type="submit" disabled={pending}>Сохранить слово</Button>
          </form>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Поиск в словаре" placeholder="Найти слово или перевод" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <Button variant={dueOnly ? 'default' : 'outline'} onClick={() => setDueOnly((value) => !value)}>Только на повторение</Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
          {visibleWords.length === 0 ? <p className="py-6 text-center text-muted-foreground">Слова не найдены. Добавьте слово или измените фильтр.</p> : <div className="divide-y divide-border">{visibleWords.map((word) => <div key={word.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{word.word} <span className="font-normal text-muted-foreground">— {word.translation}</span></p><p className="text-xs text-muted-foreground">{word.correctCount} верно · {word.incorrectCount} ошибок · {word.status === 'mastered' ? 'освоено' : word.status === 'reviewing' ? 'повторяется' : 'изучается'}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{word.nextReviewAt && word.nextReviewAt > new Date() ? `Повтор ${word.nextReviewAt.toLocaleDateString('ru-RU')}` : 'К повторению'}</Badge><Button type="button" size="icon" variant="ghost" aria-label={`Удалить карточку ${word.word}`} title="Удалить карточку и историю" disabled={pending} onClick={() => removeWord(word)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
