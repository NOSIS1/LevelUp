import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, LockKeyhole } from 'lucide-react';

type Achievement = {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  isSecret: boolean;
  xpReward: number;
  progress: number;
  isUnlocked: boolean;
};

export function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((achievement) => achievement.isUnlocked).length;
  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-3 text-4xl font-bold"><Trophy className="h-10 w-10 text-yellow-500" />Достижения</h1><p className="mt-2 text-muted-foreground">Условия проверяются по сохранённым занятиям, словам, проектам и задачам.</p></div>
      <Card><CardContent className="flex items-center gap-4 pt-6"><p className="text-3xl font-bold">{unlocked} / {achievements.length}</p><p className="text-sm text-muted-foreground">разблокировано · XP выдаётся только один раз</p></CardContent></Card>
      {achievements.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">Достижения пока не инициализированы.</CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{achievements.map((achievement) => {
        const hidden = achievement.isSecret && !achievement.isUnlocked;
        return <Card key={achievement.id} className={achievement.isUnlocked ? 'border-primary/40' : 'opacity-90'}><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="text-3xl">{hidden ? <LockKeyhole className="h-7 w-7 text-muted-foreground" /> : achievement.icon}</div><div><CardTitle className="text-base">{hidden ? 'Секретное достижение' : achievement.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{achievement.category}</p></div></div><Badge variant="outline">{achievement.rarity}</Badge></div></CardHeader><CardContent className="space-y-3"><p className="min-h-10 text-sm text-muted-foreground">{hidden ? 'Условие откроется после получения.' : achievement.description}</p>{!achievement.isUnlocked && !hidden && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>Прогресс</span><span>{achievement.progress}%</span></div><Progress value={achievement.progress} /></div>}<div className="flex justify-between text-xs"><span>{achievement.isUnlocked ? 'Разблокировано' : 'Награда'}</span><span>{achievement.isUnlocked ? 'Получено' : `+${achievement.xpReward} XP`}</span></div></CardContent></Card>;
      })}</div>}
    </div>
  );
}
