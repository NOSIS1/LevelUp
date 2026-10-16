import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GitBranch } from 'lucide-react';

type Node = { id: number; name: string; description: string | null; icon: string | null; parentSkillId: number | null; level: number; xp: number; depth: number; status: string };
const statusLabels: Record<string, string> = { not_started: 'Не начато', learning: 'Изучается', review: 'Повторение', mastered: 'Освоено' };

export function SkillTree({ nodes }: { nodes: Node[] }) {
  const roots = nodes.filter((node) => !node.parentSkillId);
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Skill Tree</CardTitle><p className="text-sm text-muted-foreground">Ветки показывают структуру тем, а не объективную оценку знаний. Статус основан на сохранённом XP навыка.</p></CardHeader><CardContent>{nodes.length === 0 ? <p className="text-sm text-muted-foreground">Навыки ещё не инициализированы.</p> : <div className="space-y-3">{roots.map((root) => <SkillNode key={root.id} node={root} nodes={nodes} />)}</div>}</CardContent></Card>;
}

function SkillNode({ node, nodes }: { node: Node; nodes: Node[] }) {
  const children = nodes.filter((candidate) => candidate.parentSkillId === node.id);
  return <div className="space-y-2"><div className="rounded-lg border border-border bg-background p-3" style={{ marginLeft: `${node.depth * 20}px` }}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xl">{node.icon || '•'}</span><div><p className="font-semibold">{node.name}</p>{node.description && <p className="text-xs text-muted-foreground">{node.description}</p>}</div></div><Badge variant={node.status === 'mastered' ? 'default' : 'outline'}>{statusLabels[node.status] || node.status}</Badge></div><div className="mt-3 flex items-center gap-3"><Progress value={node.status === 'mastered' ? 100 : node.xp % 100} className="h-2" /><span className="whitespace-nowrap text-xs text-muted-foreground">Lv {node.level}</span></div></div>{children.map((child) => <SkillNode key={child.id} node={child} nodes={nodes} />)}</div>;
}
