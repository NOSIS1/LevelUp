export type JournalSession = {
  type: string;
  category: string;
  topic: string | null;
  durationMinutes: number;
  exercisesCompleted: number;
  wordsLearned: number;
};

export type JournalReview = { wordReviews: number; codingNoteReviews: number; taskAttempts: number };

export function buildDailyJournalDraft(sessions: JournalSession[], reviews: JournalReview) {
  if (!sessions.length && !reviews.wordReviews && !reviews.codingNoteReviews && !reviews.taskAttempts) {
    return { title: 'День обучения', content: '', hasActivity: false };
  }
  const english = sessions.filter((session) => session.type === 'english');
  const coding = sessions.filter((session) => session.type === 'coding');
  const englishMinutes = english.reduce((sum, session) => sum + session.durationMinutes, 0);
  const codingMinutes = coding.reduce((sum, session) => sum + session.durationMinutes, 0);
  const exerciseCount = sessions.reduce((sum, session) => sum + session.exercisesCompleted, 0);
  const wordCount = sessions.reduce((sum, session) => sum + session.wordsLearned, 0);
  const topics = [...new Set(sessions.map((session) => session.topic).filter((topic): topic is string => Boolean(topic)))];
  const lines = ['Сегодняшняя фактическая активность:'];
  if (english.length) lines.push(`Английский: ${englishMinutes} мин., ${english.length} занятий.`);
  if (coding.length) lines.push(`Программирование: ${codingMinutes} мин., ${coding.length} занятий.`);
  if (wordCount) lines.push(`Новых слов указано в сессиях: ${wordCount}.`);
  if (exerciseCount) lines.push(`Выполнено упражнений по данным сессий: ${exerciseCount}.`);
  if (reviews.wordReviews) lines.push(`Повторений слов: ${reviews.wordReviews}.`);
  if (reviews.codingNoteReviews) lines.push(`Повторений заметок по программированию: ${reviews.codingNoteReviews}.`);
  if (reviews.taskAttempts) lines.push(`Попыток по практическим задачам: ${reviews.taskAttempts}.`);
  if (topics.length) lines.push(`Темы занятий: ${topics.join(', ')}.`);
  return { title: 'Итоги дня', content: lines.join('\n'), hasActivity: true };
}
