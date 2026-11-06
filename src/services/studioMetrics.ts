import type { InterviewQuestionResponse, InterviewSession } from './storageService';

export function getPracticeProgress(sessions: InterviewSession[]) {
  return {
    completed: sessions.length,
    average: sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.overallScore, 0) / sessions.length) : null,
    latest: sessions[0]?.overallScore ?? null,
  };
}

export function getQuestionMetrics(questions: InterviewQuestionResponse[]) {
  const average = (field: 'technicalScore' | 'communicationScore' | 'structureScore') =>
    questions.length ? Math.round(questions.reduce((sum, question) => sum + (question[field] ?? question.score), 0) / questions.length) : null;
  return { technical: average('technicalScore'), communication: average('communicationScore'), structure: average('structureScore') };
}

/** Unanswered scaffold questions must not lower a partial-session score. */
export function summarizeEvaluatedQuestions(questions: InterviewQuestionResponse[]) {
  const evaluated = questions.filter(question => question.userResponse.trim().length > 0);
  if (!evaluated.length) return null;
  return { questions: evaluated, overallScore: Math.round(evaluated.reduce((sum, question) => sum + question.score, 0) / evaluated.length) };
}
