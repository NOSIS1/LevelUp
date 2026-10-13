import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { getRecentSessions, getWords } from '@/lib/actions';
import { formatDuration } from '@/lib/utils';
import { SessionActions } from '@/components/sessions/session-actions';
import { Vocabulary } from '@/components/english/vocabulary';
export const dynamic = 'force-dynamic';

export default async function EnglishPage() {
  const sessions = await getRecentSessions(20);
  const words = await getWords();
  const englishSessions = sessions.filter(s => s.type === 'english');

  const totalMinutes = englishSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <BookOpen className="h-10 w-10" />
            Английский язык
          </h1>
          <p className="text-muted-foreground mt-2">
            Vocabulary, Grammar, Listening, Speaking, Reading, Writing
          </p>
        </div>
        <Link href="/english/session/new">
          <Button size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Новое занятие
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Всего часов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalHours}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {englishSessions.length} занятий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Словарь</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Слов добавлено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">На повторение</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Слов сегодня
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Последние занятия</CardTitle>
        </CardHeader>
        <CardContent>
          {englishSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Пока нет занятий</p>
              <p className="text-sm mt-2">Начните своё первое занятие английским!</p>
              <Link href="/english/session/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Начать занятие
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {englishSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{session.category}</p>
                        {session.topic && (
                          <p className="text-sm text-muted-foreground">{session.topic}</p>
                        )}
                      </div>
                    </div>
                    {session.notes && (
                      <p className="text-sm text-muted-foreground mt-2 ml-13">
                        {session.notes.substring(0, 100)}{session.notes.length > 100 ? '...' : ''}
                      </p>
                    )}
                    <SessionActions session={session} />
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{formatDuration(session.durationMinutes)}</p>
                    <p className="text-sm text-muted-foreground">+{session.xpAwarded} XP</p>
                    {session.difficulty && (
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {session.difficulty}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Vocabulary words={words} />
    </div>
  );
}
