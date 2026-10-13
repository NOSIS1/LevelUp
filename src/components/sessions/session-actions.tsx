'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteLearningSession, updateLearningSession } from '@/lib/actions';

type Session = {
  id: number;
  type: string;
  category: string;
  topic: string | null;
  durationMinutes: number;
  difficulty: string | null;
  language: string | null;
  source: string | null;
  notes: string | null;
  wordsLearned: number;
  exercisesCompleted: number;
  rating: number | null;
  date: Date;
};

export function SessionActions({ session }: { session: Session }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [duration, setDuration] = useState(String(session.durationMinutes));
  const [topic, setTopic] = useState(session.topic || '');
  const [notes, setNotes] = useState(session.notes || '');

  function save() {
    setError('');
    startTransition(async () => {
      try {
        await updateLearningSession(session.id, {
          type: session.type as 'english' | 'coding',
          category: session.category,
          topic,
          durationMinutes: Number(duration),
          difficulty: session.difficulty || 'medium',
          language: session.language || undefined,
          source: session.source || undefined,
          notes,
          wordsLearned: session.wordsLearned,
          exercisesCompleted: session.exercisesCompleted,
          rating: session.rating || undefined,
          date: session.date,
        });
        setEditing(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить занятие');
      }
    });
  }

  function remove() {
    if (!window.confirm('Удалить занятие? XP будет скорректирован в журнале.')) return;
    setError('');
    startTransition(async () => {
      try {
        await deleteLearningSession(session.id);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить занятие');
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-border p-3">
        <Input aria-label="Тема занятия" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Тема" />
        <Input aria-label="Продолжительность в минутах" type="number" min="1" max="300" value={duration} onChange={(event) => setDuration(event.target.value)} />
        <textarea aria-label="Заметки к занятию" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending}><Save className="mr-2 h-4 w-4" />Сохранить</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={pending}><X className="mr-2 h-4 w-4" />Отмена</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending} aria-label="Редактировать занятие"><Pencil className="h-4 w-4" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Удалить занятие"><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}
