'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FolderGit2, Pencil, Plus, Trash2 } from 'lucide-react';
import { createProject, deleteProject, updateProject } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type Project = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  status: string;
  difficulty: string | null;
  githubUrl: string | null;
  completionPercent: number;
  trackedHours: number;
  linkedTasks: number;
};

const emptyForm = { name: '', description: '', language: '', status: 'in_progress', difficulty: '', githubUrl: '', completionPercent: 0 };
const statusLabels: Record<string, string> = { not_started: 'Не начат', in_progress: 'В работе', paused: 'На паузе', completed: 'Завершён' };

export function ProjectBoard({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function beginCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function beginEdit(project: Project) {
    setForm({
      name: project.name,
      description: project.description || '',
      language: project.language || '',
      status: project.status,
      difficulty: project.difficulty || '',
      githubUrl: project.githubUrl || '',
      completionPercent: project.completionPercent,
    });
    setEditingId(project.id);
    setShowForm(true);
    setError('');
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        if (editingId === null) await createProject(form);
        else await updateProject(editingId, form);
        setEditingId(null);
        setShowForm(false);
        setForm(emptyForm);
        setNotice('Проект сохранён.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить проект');
      }
    });
  }

  function remove(project: Project) {
    if (!window.confirm(`Удалить проект «${project.name}»? Занятия и задачи сохранятся, но будут отвязаны от проекта.`)) return;
    setError('');
    setNotice('');
    startTransition(async () => {
      try {
        await deleteProject(project.id);
        setNotice('Проект удалён; связанные занятия и задачи сохранены.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось удалить проект');
      }
    });
  }

  const formOpen = showForm;

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button onClick={beginCreate}><Plus className="mr-2 h-4 w-4" />Новый проект</Button></div>
      {(formOpen || editingId !== null) && <Card><CardHeader><CardTitle>{editingId === null ? 'Создать проект' : 'Редактировать проект'}</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Input required aria-label="Название проекта" placeholder="Название проекта" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input aria-label="Язык или стек" placeholder="Язык / стек" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
        <select aria-label="Статус проекта" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="not_started">Не начат</option><option value="in_progress">В работе</option><option value="paused">На паузе</option><option value="completed">Завершён</option></select>
        <select aria-label="Сложность проекта" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option value="">Сложность не указана</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <Input aria-label="Ссылка на GitHub" type="url" placeholder="Ссылка на GitHub (необязательно)" value={form.githubUrl} onChange={(event) => setForm({ ...form, githubUrl: event.target.value })} />
        <label className="space-y-1 text-sm">Выполнено: {form.status === 'completed' ? 100 : form.completionPercent}%<input aria-label="Процент выполнения" type="range" min="0" max="100" value={form.status === 'completed' ? 100 : form.completionPercent} onChange={(event) => setForm({ ...form, completionPercent: Number(event.target.value) })} className="block w-full" disabled={form.status === 'completed'} /></label>
        <textarea aria-label="Описание проекта" placeholder="Описание и цель проекта" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="sm:col-span-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {error && <p role="alert" className="sm:col-span-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={pending}>Сохранить</Button><Button type="button" variant="outline" onClick={() => { setEditingId(null); setShowForm(false); setForm(emptyForm); }}>Отмена</Button></div>
      </form></CardContent></Card>}
      {error && !formOpen && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-500">{notice}</p>}
      {projects.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><FolderGit2 className="mx-auto mb-4 h-12 w-12 opacity-50" /><p>Пока нет проектов</p><p className="mt-2 text-sm">Создайте проект, чтобы связать с ним занятия и задачи.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <Card key={project.id}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{project.name}</CardTitle><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{statusLabels[project.status] || project.status}</Badge>{project.language && <Badge variant="secondary">{project.language}</Badge>}{project.difficulty && <Badge variant="outline">{project.difficulty}</Badge>}</div></div><div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Редактировать ${project.name}`} onClick={() => beginEdit(project)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Удалить ${project.name}`} onClick={() => remove(project)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardHeader><CardContent className="space-y-4">{project.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.description}</p>}<div className="space-y-2"><div className="flex justify-between text-sm"><span>Прогресс</span><span>{project.completionPercent}%</span></div><Progress value={project.completionPercent} /></div><div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{project.trackedHours} ч по сохранённым занятиям</span><span>{project.linkedTasks} задач</span></div>{project.githubUrl && <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Открыть GitHub</a>}</CardContent></Card>)}</div>}
    </div>
  );
}
