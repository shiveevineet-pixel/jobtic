import { jsPDF } from 'jspdf';
import type { InterviewSession } from './storageService';
import { getQuestionMetrics } from './studioMetrics';

/** Imported only on export. Wrap and paginate every line, including long answers. */
export function createInterviewPdf(session: InterviewSession) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;
  const paragraph = (text: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lineHeight = size * .45;
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      if (y + lineHeight > bottom) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 4;
  };
  const metrics = getQuestionMetrics(session.questions);
  paragraph('Jobtic · Practice feedback', 18, true);
  paragraph(session.roleTitle + ' | ' + session.difficulty + ' | ' + session.date, 10);
  paragraph('AI practice score: ' + session.overallScore + '/100. Coaching guidance, not a measure of job readiness.', 10);
  paragraph('Technical: ' + (metrics.technical ?? 'Not assessed') + ' | Clarity: ' + (metrics.communication ?? 'Not assessed') + ' | Structure: ' + (metrics.structure ?? 'Not assessed'), 10);
  session.questions.forEach((question, index) => {
    paragraph('Question ' + (index + 1) + ': ' + question.questionText, 12, true);
    paragraph('Practice score: ' + question.score + '/100', 10, true);
    paragraph('Your response: ' + (question.userResponse || 'No response recorded.'));
    paragraph('Strengths: ' + (question.strengths || 'None recorded.'));
    paragraph('Areas to improve: ' + (question.weaknesses || 'None recorded.'));
    paragraph('Coaching feedback: ' + (question.feedback || 'None recorded.'));
    if (question.modelAnswer) paragraph('Suggested answer: ' + question.modelAnswer);
  });
  return doc;
}
