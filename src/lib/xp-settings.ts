export type XpSettings = {
  xpPerMinute: number;
  longSessionThresholdMinutes: number;
  longSessionBonusXp: number;
  levelBaseXp: number;
  levelExponent: number;
};

export const defaultXpSettings: XpSettings = {
  xpPerMinute: 1,
  longSessionThresholdMinutes: 50,
  longSessionBonusXp: 5,
  levelBaseXp: 100,
  levelExponent: 2,
};

export function calculateConfigurableSessionXp(durationMinutes: number, settings: XpSettings): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) throw new RangeError('Duration must be a positive integer');
  return Math.round(durationMinutes * settings.xpPerMinute + (durationMinutes >= settings.longSessionThresholdMinutes ? settings.longSessionBonusXp : 0));
}

export function calculateConfigurableLevel(totalXp: number, settings: XpSettings): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  return Math.floor(Math.pow(totalXp / settings.levelBaseXp, 1 / settings.levelExponent)) + 1;
}
