import { GitHubDashboard } from '@/components/github/github-dashboard';
import { getGitHubDashboard } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function GitHubPage() {
  const data = await getGitHubDashboard();
  return <GitHubDashboard {...data} />;
}
