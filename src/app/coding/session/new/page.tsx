'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createLearningSession } from '@/lib/actions';
import { ArrowLeft, Code } from 'lucide-react';
import Link from 'next/link';

const categories = [
  { value: 'fundamentals', label: 'Fundamentals', description: 'Основы программирования' },
  { value: 'algorithms', label: 'Algorithms', description: 'Алгоритмы и структуры данных' },
  { value: 'problem_solving', label: 'Problem Solving', description: 'Решение задач' },
  { value: 'projects', label: 'Projects', description: 'Разработка проектов' },
  { value: 'tools', label: 'Tools & Workflow', description: 'Инструменты разработчика' },
  { value: 'computer_science', label: 'Computer Science', description: 'Фундаментальные знания CS' },
];

const languages = [
  'C#', 'Python', 'Java', 'Kotlin', 'JavaScript', 'TypeScript', 'SQL', 'Go', 'Rust', 'Other'
];

const difficulties = [
  { value: 'easy', label: 'Easy', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'hard', label: 'Hard', color: 'bg-red-500' },
];

export default function NewCodingSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: 'fundamentals',
    topic: '',
    durationMinutes: 50,
    difficulty: 'medium',
    language: 'TypeScript',
    source: '',
    notes: '',
    exercisesCompleted: 0,
    rating: 3,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createLearningSession({
        type: 'coding',
        ...formData,
      });

      if (result.newLevel) {
        alert(`Поздравляем! Вы достигли нового уровня!`);
      }

      router.push('/coding');
      router.refresh();
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Ошибка при сохранении сессии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coding">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Новое занятие</h1>
          <p className="text-muted-foreground">Программирование</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Детали занятия
            </CardTitle>
            <CardDescription>
              Заполните информацию о вашем занятии
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Категория</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.category === cat.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Язык программирования</label>
              <div className="grid grid-cols-5 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setFormData({ ...formData, language: lang })}
                    className={`px-3 py-2 rounded-md border-2 text-sm transition-all ${
                      formData.language === lang
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <label htmlFor="topic" className="text-sm font-medium">
                Тема (опционально)
              </label>
              <Input
                id="topic"
                placeholder="Например: Binary Search, REST API, Design Patterns..."
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label htmlFor="duration" className="text-sm font-medium">
                Продолжительность (минуты)
              </label>
              <div className="flex gap-2">
                {[25, 50, 90, 120].map((mins) => (
                  <Button
                    key={mins}
                    type="button"
                    variant={formData.durationMinutes === mins ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, durationMinutes: mins })}
                  >
                    {mins} мин
                  </Button>
                ))}
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="300"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                  className="w-24"
                />
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Сложность</label>
              <div className="flex gap-2">
                {difficulties.map((diff) => (
                  <button
                    key={diff.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, difficulty: diff.value })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border-2 transition-all ${
                      formData.difficulty === diff.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${diff.color}`} />
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exercises */}
            <div className="space-y-2">
              <label htmlFor="exercises" className="text-sm font-medium">
                Выполнено задач/упражнений
              </label>
              <Input
                id="exercises"
                type="number"
                min="0"
                value={formData.exercisesCompleted}
                onChange={(e) => setFormData({ ...formData, exercisesCompleted: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Source */}
            <div className="space-y-2">
              <label htmlFor="source" className="text-sm font-medium">
                Источник (опционально)
              </label>
              <Input
                id="source"
                placeholder="Например: курс, книга, документация..."
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Заметки (опционально)
              </label>
              <textarea
                id="notes"
                rows={4}
                placeholder="Что изучили, какие концепции поняли, что нужно повторить..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Оценка занятия</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating })}
                    className={`w-12 h-12 rounded-lg border-2 transition-all ${
                      formData.rating === rating
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            {/* XP Preview */}
            <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Награда за занятие</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.durationMinutes} мин × сложность {formData.difficulty}
                  </p>
                </div>
                <Badge className="text-lg px-4 py-2">
                  +{formData.durationMinutes + (formData.durationMinutes >= 50 ? 5 : 0)} XP
                </Badge>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1" disabled={loading || formData.durationMinutes < 1}>
                {loading ? 'Сохранение...' : 'Завершить занятие'}
              </Button>
              <Link href="/coding">
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
