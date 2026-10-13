import { FolderGit2 } from 'lucide-react';
import { ProjectBoard } from '@/components/projects/project-board';
import { getProjects } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-4xl font-bold"><FolderGit2 className="h-10 w-10" />Проекты</h1>
        <p className="mt-2 text-muted-foreground">Создавайте проекты, отслеживайте прогресс и связывайте работу с учебными занятиями.</p>
      </div>
      <ProjectBoard projects={projects} />
    </div>
  );
}
