import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, Plus } from 'lucide-react';
import Link from 'next/link';
import { getRecentSessions, getCodingNotes, getCodingTasks, getProgrammingSkillTree } from '@/lib/actions';
import { formatDuration } from '@/lib/utils';
import { SessionActions } from '@/components/sessions/session-actions';
import { CodingNotes } from '@/components/coding/coding-notes';
import { CodingTasks } from '@/components/coding/coding-tasks';
import { SkillTree } from '@/components/coding/skill-tree';
export const dynamic = 'force-dynamic';

export default async function CodingPage() {
  const sessions = await getRecentSessions(20);
  const codingSessions = sessions.filter(s => s.type === 'coding');
  const codingNotes = await getCodingNotes();
  const codingTasks = await getCodingTasks();
  const skillTree = await getProgrammingSkillTree();

  const totalMinutes = codingSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Code className="h-10 w-10" />
            Программирование
          </h1>
          <p className="text-muted-foreground mt-2">
            Fundamentals, Algorithms, Projects, Tools, Computer Science
          </p>
        </div>
        <Link href="/coding/session/new">
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
              {codingSessions.length} занятий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Задачи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{codingTasks.filter((task) => task.status === 'completed').length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Решено задач
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Проекты</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{codingTasks.filter((task) => task.type === 'project' && task.status !== 'completed').length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Активных проектов
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
          {codingSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Пока нет занятий</p>
              <p className="text-sm mt-2">Начните своё первое занятие программированием!</p>
              <Link href="/coding/session/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Начать занятие
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {codingSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <Code className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{session.category}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {session.language && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">
                              {session.language}
                            </span>
                          )}
                          {session.topic && (
                            <span className="text-sm text-muted-foreground">{session.topic}</span>
                          )}
                        </div>
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

      <CodingNotes notes={codingNotes} />
      <SkillTree nodes={skillTree} />
      <CodingTasks tasks={codingTasks} />
    </div>
  );
}
