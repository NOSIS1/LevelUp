import { z } from 'zod';

const repoSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  private: z.boolean(),
  fork: z.boolean(),
  html_url: z.string().url(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  pushed_at: z.string().datetime().nullable(),
});

const profileSchema = z.object({ login: z.string(), public_repos: z.number().int().nonnegative() });

export type GitHubRepoData = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  isFork: boolean;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
  pushedAt: Date | null;
};

export type GitHubDayActivity = { date: string; commits: number; pullRequests: number; issues: number; repositories: string[] };
export type GitHubContributionDay = { date: string; contributionCount: number };

export function validateGitHubUsername(input: string): string {
  const username = input.trim();
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username) || username.includes('--')) {
    throw new Error('Некорректный GitHub username');
  }
  return username;
}

export function parseGitHubRepos(value: unknown): GitHubRepoData[] {
  const rows = z.array(repoSchema).parse(value);
  return rows.map((repo) => ({
    id: repo.id, name: repo.name, fullName: repo.full_name, description: repo.description,
    language: repo.language, isPrivate: repo.private, isFork: repo.fork, htmlUrl: repo.html_url,
    createdAt: new Date(repo.created_at), updatedAt: new Date(repo.updated_at),
    pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
  }));
}

export function aggregateGitHubEvents(events: unknown): GitHubDayActivity[] {
  const rows = z.array(z.object({ type: z.string(), created_at: z.string().datetime(), repo: z.object({ name: z.string() }), payload: z.record(z.string(), z.unknown()).optional() })).parse(events);
  const daily = new Map<string, GitHubDayActivity>();
  for (const event of rows) {
    const date = event.created_at.slice(0, 10);
    let activity = daily.get(date);
    if (!activity) {
      activity = { date, commits: 0, pullRequests: 0, issues: 0, repositories: [] };
      daily.set(date, activity);
    }
    const repository = event.repo.name;
    if (!activity.repositories.includes(repository)) activity.repositories.push(repository);
    if (event.type === 'PushEvent') {
      const size = event.payload?.size;
      const commits = typeof size === 'number' && Number.isFinite(size) ? Math.max(0, Math.floor(size)) : 0;
      activity.commits += commits;
    } else if (event.type === 'PullRequestEvent') activity.pullRequests += 1;
    else if (event.type === 'IssuesEvent') activity.issues += 1;
  }
  return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function requestGitHub<T>(url: string, token?: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'LevelUp-local-learning-tracker',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') throw new Error('GitHub API limit reached. Try again after the reset time.');
    throw new Error('GitHub rejected the request. Check username or server-side token.');
  }
  if (response.status === 404) throw new Error('GitHub user not found or has no public profile.');
  if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);
  return await response.json() as T;
}

export async function fetchGitHubProfile(usernameInput: string, options: { token?: string; fetcher?: typeof fetch } = {}) {
  const username = validateGitHubUsername(usernameInput);
  const fetcher = options.fetcher || fetch;
  const token = options.token;
  const profileJson = await requestGitHub<unknown>(`https://api.github.com/users/${encodeURIComponent(username)}`, token, fetcher);
  const profile = profileSchema.parse(profileJson);
  const reposJson = await requestGitHub<unknown>(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, token, fetcher);
  const repositories = parseGitHubRepos(reposJson);
  return { username: profile.login, publicRepos: profile.public_repos, repositories };
}

export async function fetchGitHubEvents(usernameInput: string, options: { token?: string; fetcher?: typeof fetch } = {}) {
  const username = validateGitHubUsername(usernameInput);
  const fetcher = options.fetcher || fetch;
  const events = await requestGitHub<unknown>(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, options.token, fetcher);
  return aggregateGitHubEvents(events);
}

const contributionCalendarSchema = z.object({
  data: z.object({
    user: z.object({
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          totalContributions: z.number().int().nonnegative(),
          weeks: z.array(z.object({ contributionDays: z.array(z.object({ date: z.string().date(), contributionCount: z.number().int().nonnegative() })) })),
        }),
      }),
    }).nullable(),
  }),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export function parseContributionCalendar(payload: unknown): GitHubContributionDay[] {
  const parsed = contributionCalendarSchema.parse(payload);
  if (parsed.errors?.length) throw new Error(parsed.errors.map((error) => error.message).join('; '));
  if (!parsed.data.user) throw new Error('GitHub user not found or contribution calendar unavailable');
  return parsed.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
}

export async function fetchGitHubContributionCalendar(usernameInput: string, token?: string, fetcher: typeof fetch = fetch, now = new Date()) {
  const username = validateGitHubUsername(usernameInput);
  if (!token?.trim()) throw new Error('Official GitHub Contributions requires server-side GITHUB_TOKEN in .env');
  const toDate = new Date(now);
  toDate.setUTCHours(23, 59, 59, 0);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 364);
  const from = fromDate.toISOString();
  const to = toDate.toISOString();
  const response = await fetcher('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'LevelUp-local-learning-tracker' },
    body: JSON.stringify({ query: 'query($login:String!, $from:DateTime!, $to:DateTime!) { user(login:$login) { contributionsCollection(from:$from,to:$to) { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }', variables: { login: username, from, to } }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') throw new Error('GitHub GraphQL rate limit reached; try again after reset');
    throw new Error('GitHub GraphQL authorization failed; verify that GITHUB_TOKEN is valid and can read the public profile');
  }
  if (!response.ok) throw new Error(`GitHub GraphQL returned HTTP ${response.status}`);
  return parseContributionCalendar(await response.json());
}
