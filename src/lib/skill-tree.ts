export type SkillTreeNode = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  parentSkillId: number | null;
  level: number;
  xp: number;
  category: string;
};

export function skillStatus(level: number, xp: number): 'not_started' | 'learning' | 'review' | 'mastered' {
  if (level >= 5) return 'mastered';
  if (xp > 0) return level > 0 ? 'review' : 'learning';
  return 'not_started';
}

export function treeDepth(nodeId: number, nodes: SkillTreeNode[]): number {
  let depth = 0;
  let current = nodes.find((node) => node.id === nodeId);
  const seen = new Set<number>();
  while (current?.parentSkillId && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = nodes.find((node) => node.id === current?.parentSkillId);
  }
  return depth;
}
