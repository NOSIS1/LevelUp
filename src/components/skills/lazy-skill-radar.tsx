'use client';

import dynamic from 'next/dynamic';
import type { RadarSkill } from '@/lib/skill-radar';

const SkillRadar = dynamic(() => import('@/components/skills/skill-radar').then((module) => module.SkillRadar), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />,
});

export function LazySkillRadar({ skills, title }: { skills: RadarSkill[]; title: string }) {
  return <SkillRadar skills={skills} title={title} />;
}
