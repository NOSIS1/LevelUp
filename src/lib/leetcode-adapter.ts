import { z } from 'zod';

const difficultyCountSchema = z.object({ difficulty: z.string(), count: z.number().int().nonnegative() });
const responseSchema = z.object({
  data: z.object({
    matchedUser: z.object({
      username: z.string(),
      profile: z.object({ ranking: z.number().int().nonnegative().nullable() }).nullable().optional(),
      submitStats: z.object({ acSubmissionNum: z.array(difficultyCountSchema) }),
    }).nullable(),
    allQuestionsCount: z.array(difficultyCountSchema).optional(),
  }),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export type LeetCodePublicStats = {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalQuestions: number | null;
  ranking: number | null;
};

export function validateLeetCodeUsername(value: string): string {
  const username = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) throw new Error('Username должен содержать 1–30 букв, цифр, _ или -');
  return username;
}

export function parseLeetCodeStats(payload: unknown): LeetCodePublicStats {
  const parsed = responseSchema.parse(payload);
  if (parsed.errors?.length) throw new Error(parsed.errors.map((item) => item.message).join('; '));
  const user = parsed.data.matchedUser;
  if (!user) throw new Error('Публичный профиль LeetCode не найден');
  const count = (items: { difficulty: string; count: number }[], difficulty: string) => items.find((item) => item.difficulty.toLowerCase() === difficulty.toLowerCase())?.count ?? 0;
  const solvedCounts = user.submitStats.acSubmissionNum;
  const easySolved = count(solvedCounts, 'Easy');
  const mediumSolved = count(solvedCounts, 'Medium');
  const hardSolved = count(solvedCounts, 'Hard');
  const questions = parsed.data.allQuestionsCount;
  const totalQuestions = questions ? count(questions, 'All') : null;
  return {
    username: user.username,
    easySolved,
    mediumSolved,
    hardSolved,
    totalSolved: count(solvedCounts, 'All') || easySolved + mediumSolved + hardSolved,
    totalQuestions,
    ranking: user.profile?.ranking ?? null,
  };
}

export function solvedPercent(solved: number, total: number | null): number | null {
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.round(solved / total * 1000) / 10);
}

export async function fetchLeetCodeStats(username: string, fetcher: typeof fetch = fetch): Promise<LeetCodePublicStats> {
  const validUsername = validateLeetCodeUsername(username);
  const response = await fetcher('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'LevelUp-Personal-Progress-Tracker' },
    body: JSON.stringify({
      query: `query userPublicProfile($username: String!) { matchedUser(username: $username) { username profile { ranking } submitStats { acSubmissionNum { difficulty count submissions } } } allQuestionsCount { difficulty count } }`,
      variables: { username: validUsername },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 429) throw new Error('LeetCode временно ограничил запросы. Повторите синхронизацию позже.');
  if (!response.ok) throw new Error(`LeetCode вернул HTTP ${response.status}`);
  return parseLeetCodeStats(await response.json());
}
