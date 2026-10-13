export type FocusTimerState = {
  durationSeconds: number;
  elapsedBeforeRunSeconds: number;
  runningSince: number | null;
  status: 'idle' | 'running' | 'paused' | 'completed';
  direction: 'english' | 'coding';
  category: string;
  topic: string;
};

export function remainingSeconds(state: FocusTimerState, now = Date.now()): number {
  const currentRun = state.status === 'running' && state.runningSince !== null
    ? Math.max(0, (now - state.runningSince) / 1000)
    : 0;
  return Math.max(0, Math.ceil(state.durationSeconds - state.elapsedBeforeRunSeconds - currentRun));
}

export function startFocusTimer(state: FocusTimerState, now = Date.now()): FocusTimerState {
  if (state.status === 'completed') return state;
  if (state.status === 'running') return state;
  if (remainingSeconds(state, now) === 0) return { ...state, status: 'completed', runningSince: null };
  return { ...state, status: 'running', runningSince: now };
}

export function pauseFocusTimer(state: FocusTimerState, now = Date.now()): FocusTimerState {
  if (state.status !== 'running' || state.runningSince === null) return state;
  const elapsed = Math.max(0, (now - state.runningSince) / 1000);
  const elapsedBeforeRunSeconds = Math.min(state.durationSeconds, state.elapsedBeforeRunSeconds + elapsed);
  const completed = elapsedBeforeRunSeconds >= state.durationSeconds;
  return {
    ...state,
    elapsedBeforeRunSeconds,
    runningSince: null,
    status: completed ? 'completed' : 'paused',
  };
}

export function normalizeFocusState(value: unknown): FocusTimerState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FocusTimerState>;
  if (!Number.isFinite(candidate.durationSeconds) || (candidate.durationSeconds ?? 0) < 60 ||
      !Number.isFinite(candidate.elapsedBeforeRunSeconds) || (candidate.elapsedBeforeRunSeconds ?? -1) < 0 ||
      !['idle', 'running', 'paused', 'completed'].includes(candidate.status || '') ||
      !['english', 'coding'].includes(candidate.direction || '') ||
      typeof candidate.category !== 'string' || typeof candidate.topic !== 'string' ||
      !(candidate.runningSince === null || Number.isFinite(candidate.runningSince))) return null;
  return candidate as FocusTimerState;
}

export function elapsedFocusMinutes(state: FocusTimerState, now = Date.now()): number {
  const elapsed = state.elapsedBeforeRunSeconds + (state.status === 'running' && state.runningSince !== null
    ? Math.max(0, (now - state.runningSince) / 1000)
    : 0);
  return Math.min(Math.ceil(elapsed / 60), Math.floor(state.durationSeconds / 60));
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
