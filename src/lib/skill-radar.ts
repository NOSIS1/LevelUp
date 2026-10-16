export type RadarSkill = {
  id: number;
  name: string;
  activityScore: number;
  practiceScore: number;
  assessmentScore: number;
  confidenceScore: number;
  consistencyScore: number;
};

export function radarData(skill: RadarSkill) {
  const values = [skill.activityScore, skill.practiceScore, skill.assessmentScore, skill.confidenceScore, skill.consistencyScore];
  const hasData = values.some((value) => Number.isFinite(value) && value > 0);
  return {
    name: skill.name,
    Activity: hasData ? Math.round(skill.activityScore) : null,
    Practice: hasData ? Math.round(skill.practiceScore) : null,
    Assessment: hasData ? Math.round(skill.assessmentScore) : null,
    Confidence: hasData ? Math.round(skill.confidenceScore) : null,
    Consistency: hasData ? Math.round(skill.consistencyScore) : null,
    hasData,
  };
}
