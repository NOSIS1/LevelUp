'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { radarData, type RadarSkill } from '@/lib/skill-radar';

export function SkillRadar({ skills, title = 'Баланс навыков' }: { skills: RadarSkill[]; title?: string }) {
  const data = skills.map(radarData).filter((skill) => skill.hasData);
  if (!data.length) return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="py-8 text-center text-sm text-muted-foreground">Недостаточно данных для Radar Chart. Сначала сохраните занятия, практику или оценки навыков.</p></CardContent></Card>;
  const selected = data[0];
  const axes = ['Activity', 'Practice', 'Assessment', 'Confidence', 'Consistency'];
  const chartData = axes.map((axis) => ({ axis, value: selected[axis as keyof typeof selected] as number }));
  return <Card><CardHeader><CardTitle>{title}</CardTitle><p className="text-xs text-muted-foreground">Расчётные индексы, а не объективная оценка знаний · выбран навык: {selected.name}</p></CardHeader><CardContent><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%"><PolarGrid /><PolarAngleAxis dataKey="axis" /><PolarRadiusAxis domain={[0, 100]} /><Radar name={selected.name} dataKey="value" stroke="#60a5fa" fill="#3b82f6" fillOpacity={0.35} /><Tooltip /></RadarChart></ResponsiveContainer></div><div className="flex flex-wrap justify-center gap-2">{data.map((skill) => <span key={skill.name} className="rounded border border-border px-2 py-1 text-xs">{skill.name}</span>)}</div></CardContent></Card>;
}
