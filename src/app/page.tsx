import { getDashboardStats, getSkillsWithProgress } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getXpProgress, formatDuration } from '@/lib/utils';
import {
  Trophy,
  Flame,
  Clock,
  Target,
  TrendingUp,
  BookOpen,
  Code,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const skills = await getSkillsWithProgress();

  const xpProgress = getXpProgress(stats.profile.totalXp);
  const englishSkills = skills.filter(s => s.category === 'english');
  const programmingSkills = skills.filter(s => s.category === 'programming');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">
          Добро пожаловать, {stats.profile.displayName}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Ваш путь развития в английском и программировании
        </p>
      </div>

      {/* Level and XP Card */}
      <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">
                Уровень {xpProgress.currentLevel}
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {stats.profile.totalXp.toLocaleString()} XP
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary bg-primary/20">
              <Star className="h-10 w-10 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                До уровня {xpProgress.currentLevel + 1}
              </span>
              <span className="font-medium">
                {xpProgress.xpInCurrentLevel} / {xpProgress.xpForNextLevel - xpProgress.xpForCurrentLevel} XP
              </span>
            </div>
            <Progress value={xpProgress.progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(xpProgress.progressPercent)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Серия дней</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <p className="text-xs text-muted-foreground">
              {stats.currentStreak > 0 ? 'Продолжай в том же духе!' : 'Начни занятие сегодня'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего часов</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sessionsCount} сессий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Задачи</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              Завершено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Достижения</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.achievementsCount}</div>
            <p className="text-xs text-muted-foreground">
              Разблокировано
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Цель на сегодня</CardTitle><span className="text-sm text-muted-foreground">{stats.todayMinutes} / {stats.dailyGoalMinutes} мин.</span></CardHeader>
        <CardContent><Progress value={stats.dailyGoalProgress} /><p className="mt-2 text-xs text-muted-foreground">{stats.dailyGoalProgress}% · Часовой пояс: {stats.timezone}</p></CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/english/session/new">
              <Button className="w-full h-20" variant="outline">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6" />
                  <div className="text-left">
                    <div className="font-semibold">Начать занятие</div>
                    <div className="text-xs text-muted-foreground">Английский язык</div>
                  </div>
                </div>
              </Button>
            </Link>

            <Link href="/coding/session/new">
              <Button className="w-full h-20" variant="outline">
                <div className="flex items-center gap-3">
                  <Code className="h-6 w-6" />
                  <div className="text-left">
                    <div className="font-semibold">Начать занятие</div>
                    <div className="text-xs text-muted-foreground">Программирование</div>
                  </div>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Skills Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* English Skills */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Английский язык</CardTitle>
              <Badge variant="outline">{stats.profile.englishLevel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {englishSkills.map((skill) => (
              <div key={skill.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{skill.icon}</span>
                    <span className="font-medium">{skill.name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    Lv {skill.level || 0}
                  </span>
                </div>
                <Progress value={(skill.xp || 0) % 100} className="h-2" />
              </div>
            ))}
            <div className="pt-2">
              <Link href="/english">
                <Button variant="outline" size="sm" className="w-full">
                  Подробнее
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Programming Skills */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Программирование</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {programmingSkills.map((skill) => (
              <div key={skill.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{skill.icon}</span>
                    <span className="font-medium">{skill.name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    Lv {skill.level || 0}
                  </span>
                </div>
                <Progress value={(skill.xp || 0) % 100} className="h-2" />
              </div>
            ))}
            <div className="pt-2">
              <Link href="/coding">
                <Button variant="outline" size="sm" className="w-full">
                  Подробнее
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Последние занятия</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Пока нет занятий</p>
              <p className="text-sm mt-2">Начните первое занятие прямо сейчас!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    {session.type === 'english' ? (
                      <BookOpen className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Code className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{session.category}</p>
                      {session.topic && (
                        <p className="text-sm text-muted-foreground">{session.topic}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatDuration(session.durationMinutes)}</p>
                    <p className="text-sm text-muted-foreground">+{session.xpAwarded} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
