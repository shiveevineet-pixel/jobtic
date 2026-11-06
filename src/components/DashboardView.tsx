import { confirmAction } from '../services/confirmAction';
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, ChevronDown, FileText, History, Trash2, Check, Sparkles } from 'lucide-react';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../context/AuthContext';
import { defaultRoles } from '../services/mockDatabase';
import { InterviewSession } from '../services/storageService';
import AIAvatar3D from './AIAvatar3D';
import { getPracticeProgress } from '../services/studioMetrics';
import { getAccountProfile } from '../services/accountProfile';

export type StudioView = 'home' | 'practice' | 'resume' | 'history';
interface DashboardViewProps {
  mode: StudioView;
  onNavigate: (view: StudioView) => void;
  onViewFeedback: (session: InterviewSession) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ mode, onNavigate, onViewFeedback }) => {
  const { sessionsList, startInterview, deleteSession, isLoading } = useInterview();
  const { user, mockUser } = useAuth();
  const { name: displayName, email: accountEmail } = getAccountProfile(user, mockUser);
  const [roleId, setRoleId] = useState('software_engineer');
  const [difficulty, setDifficulty] = useState<'junior' | 'mid' | 'senior' | 'lead'>('mid');
  const [type, setType] = useState('technical');
  const [jobDescription, setJobDescription] = useState('');
  const [questionCount, setQuestionCount] = useState(3);
  const [interviewFormat, setInterviewFormat] = useState<'structured' | 'chat'>('structured');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [startError, setStartError] = useState('');
  useEffect(() => {
    if (mode !== 'practice') return;
    const resumeKey = `jobtic_resume_context:${user ? `user:${user.id}` : 'guest'}`;
    const resumeContext = sessionStorage.getItem(resumeKey);
    if (resumeContext) {
      setJobDescription('[Resume Context] ' + resumeContext.slice(0, 1200));
      setResumeLoaded(true);
      sessionStorage.removeItem(resumeKey);
    }
  }, [mode, user]);
  const roleTitle = roleId === 'custom' ? customRoleTitle || 'Your custom role' : defaultRoles.find(r => r.id === roleId)?.title || roleId;
  const averageScore = getPracticeProgress(sessionsList).average;
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError('');
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
    try {
      await startInterview(roleId === 'custom' ? customRoleTitle.trim() : roleId, difficulty, type, jobDescription, questionCount, interviewFormat === 'chat');
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not prepare your session. Your setup is still here; please try again.');
    }
  };
  const sessionList = (limit?: number) => sessionsList.length ? (
    <div className="sessions-list">
      {sessionsList.slice(0, limit).map(session => (
        <div key={session.id} className="session-item">
          <button className="session-open" onClick={() => onViewFeedback(session)} aria-label={'View feedback for ' + session.roleTitle + ' on ' + session.date}>
            <span className="session-symbol"><BookOpen size={18} /></span>
            <span className="session-meta">
              <span className="session-role">{session.roleTitle}</span>
              <span className="session-details">{session.difficulty} · {session.isChatMode ? 'AI conversation' : session.type.replace('_', ' ')} · {session.date}</span>
            </span>
          </button>
          <span className={'session-score-badge score-' + (session.overallScore >= 80 ? 'high' : session.overallScore >= 60 ? 'mid' : 'low')} aria-label={'Practice score ' + session.overallScore + ' out of 100'}>{session.overallScore}/100</span>
          {mode === 'history' && <button className="icon-btn" aria-label={'Delete session ' + session.roleTitle} onClick={async () => { if (await confirmAction('Delete this session? This cannot be undone.')) deleteSession(session.id); }}><Trash2 size={16} /></button>}
        </div>
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <History size={28} />
      <h3>Your story starts with one session.</h3>
      <p>Practice at your own pace. Your answers and coaching feedback will appear here after you finish.</p>
      <button className="btn-secondary" onClick={() => onNavigate('practice')}>Set up your first practice <ArrowUpRight size={16} /></button>
    </div>
  );

  if (mode === 'history') return (
    <div className="page" key="history">
      <div className="page-heading"><div><span className="eyebrow">Your learning journal</span><h1>Practice history</h1><p>Revisit your answers, find useful feedback, and choose what to work on next.</p></div></div>
      {averageScore !== null && <div className="progress-strip"><div><strong>{sessionsList.length}</strong><span>Completed sessions</span></div><div><strong>{averageScore}/100</strong><span>Average AI practice score</span></div><p className="caption">Scores reflect these practice sessions, not job readiness.</p></div>}
      {sessionList()}
    </div>
  );

  if (mode === 'practice') return (
    <div className="page" key="practice">
      <div className="page-heading"><div><span className="eyebrow">A little practice. A clearer answer.</span><h1>Make this session yours.</h1><p>Choose your focus. We’ll take it one question at a time.</p></div></div>
      <div className="setup-layout">
        <div className="setup-card">
          <form id="practice-setup" onSubmit={handleStart} className="setup-form">
            <fieldset className="setup-group">
              <legend className="group-legend"><span className="group-number">1</span>Role & experience</legend>
              <div className="form-group"><label htmlFor="practice-role">Target role</label><select id="practice-role" value={roleId} onChange={e => setRoleId(e.target.value)}>{defaultRoles.map(role => <option key={role.id} value={role.id}>{role.title}</option>)}<option value="custom">Custom role…</option></select></div>
              {roleId === 'custom' && <div className="form-group"><label htmlFor="custom-role">Your role title</label><input id="custom-role" value={customRoleTitle} onChange={e => setCustomRoleTitle(e.target.value)} placeholder="e.g. Flutter Developer" required maxLength={150} /></div>}
              <div className="form-group"><span id="experience-label">Experience level</span><div className="difficulty-tabs" role="group" aria-labelledby="experience-label">{(['junior', 'mid', 'senior', 'lead'] as const).map(level => <button key={level} type="button" className={'diff-tab ' + (difficulty === level ? 'active' : '')} aria-pressed={difficulty === level} onClick={() => setDifficulty(level)}>{level}</button>)}</div></div>
            </fieldset>
            <fieldset className="setup-group">
              <legend className="group-legend"><span className="group-number">2</span>Focus & format</legend>
              <div className="form-group"><label htmlFor="practice-focus">Interview focus</label><select id="practice-focus" value={type} onChange={e => setType(e.target.value)}><option value="technical">Technical skills</option><option value="behavioral">Behavioral · STAR method</option><option value="system_design">System design</option><option value="general">General fit</option></select></div>
              <div className="format-tabs" role="group" aria-label="Interview format"><button type="button" className={'diff-tab ' + (interviewFormat === 'structured' ? 'active' : '')} aria-pressed={interviewFormat === 'structured'} onClick={() => setInterviewFormat('structured')}>Structured Q&A</button><button type="button" className={'diff-tab ' + (interviewFormat === 'chat' ? 'active' : '')} aria-pressed={interviewFormat === 'chat'} onClick={() => setInterviewFormat('chat')}>AI conversation</button></div>
              <p className="caption">{interviewFormat === 'structured' ? 'Answer individual questions by voice or text, then receive question-level coaching.' : 'Have an open-ended conversation with follow-up questions. End when you’re ready for feedback.'}</p>
            </fieldset>
            <details className="context-details" open={resumeLoaded || undefined}><summary>Personalize with context <span className="caption">Optional <ChevronDown size={14} /></span></summary>
              {resumeLoaded && <div className="context-chip"><span><FileText size={14} /> Resume context attached</span><button type="button" className="text-button" onClick={() => { setJobDescription(''); setResumeLoaded(false); }}>Remove</button></div>}
              <div className="form-group"><label htmlFor="practice-context">Job description, skills, or resume context</label><textarea id="practice-context" value={jobDescription} onChange={e => { setJobDescription(e.target.value); setResumeLoaded(false); }} placeholder="Paste the job description or skills you’d like to practice…" rows={4} /></div>
            </details>
            {interviewFormat === 'structured' && <fieldset className="setup-group"><legend className="group-legend"><span className="group-number">3</span>Session length</legend><div className="form-group"><label htmlFor="practice-length">Number of questions</label><select id="practice-length" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}><option value={3}>3 questions · Quick practice</option><option value={5}>5 questions · Standard</option><option value={10}>10 questions · In depth</option><option value={-1}>Adaptive · Let Jobtic decide</option></select></div>{questionCount === -1 && <p className="caption">Questions adapt to your answers. You can finish the session at any time.</p>}</fieldset>}
            {startError && <div className="alert alert-danger" role="alert">{startError}</div>}
            <p className="setup-inline-summary caption">{roleTitle} · {difficulty} · {interviewFormat === 'chat' ? 'AI conversation, at your pace' : questionCount === -1 ? 'Adaptive Q&A' : questionCount + ' questions'}</p>
            <button type="submit" className="btn-primary start-btn" disabled={isLoading}>{isLoading ? <><span className="loading-spinner" /> Preparing your session…</> : <>Start practice <ArrowUpRight size={18} /></>}</button>
          </form>
        </div>
        <aside className="setup-summary"><span className="eyebrow">Your session</span><h3>{roleTitle}</h3><dl className="summary-list"><div><dt>Experience</dt><dd>{difficulty}</dd></div><div><dt>Focus</dt><dd>{type.replace('_', ' ')}</dd></div><div><dt>Format</dt><dd>{interviewFormat === 'chat' ? 'Conversation' : 'Structured Q&A'}</dd></div><div><dt>Length</dt><dd>{interviewFormat === 'chat' ? 'At your pace' : questionCount === -1 ? 'Adaptive' : questionCount + ' questions'}</dd></div></dl><p className="caption"><Check size={14} /> Voice or text. No pressure to be perfect.</p></aside>
      </div>
    </div>
  );

  return (
    <div className="page dashboard-home" key="home">
      <div className="page-heading"><div><span className="eyebrow">Jobtic career studio</span><h1>{sessionsList.length ? 'Welcome back, ' : 'Hello, '}{displayName.split(' ')[0]}.</h1><p>{accountEmail ? `Signed in as ${accountEmail}` : 'A thoughtful space to prepare for what’s next.'}</p></div><span className="caption">Your next chapter, in progress</span></div>
      <section className="home-hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14} /> One answer at a time</span><h2>Find your words.<br />Build your confidence.</h2><p>Turn interview practice into clearer thinking, stronger answers, and a plan for your next session.</p><div className="hero-actions"><button className="btn-primary" onClick={() => onNavigate('practice')}>Start practice <ArrowUpRight size={17} /></button><button className="btn-secondary" onClick={() => onNavigate('resume')}><FileText size={16} /> Work on my resume</button></div></div><div className="hero-art" aria-hidden="true"><AIAvatar3D status="idle" /><span className="art-label">A calm companion for your next step</span></div></section>
      {averageScore !== null && <div className="progress-strip"><div><strong>{sessionsList.length}</strong><span>Sessions completed</span></div><div><strong>{averageScore}/100</strong><span>Average practice score</span></div><div><strong>{sessionsList[0]?.overallScore}/100</strong><span>Most recent session</span></div></div>}
      <div className="home-columns"><section><div className="section-heading"><h3>Recent practice</h3>{sessionsList.length > 0 && <button className="text-button" onClick={() => onNavigate('history')}>View all <ArrowUpRight size={14} /></button>}</div>{sessionList(3)}</section><aside><div className="editorial-panel"><span className="eyebrow">A useful place to begin</span><h3>{sessionsList.length ? 'Give one answer another try.' : 'Start small. Stay curious.'}</h3><p>{sessionsList.length ? 'Revisit your latest feedback and choose one improvement to focus on. Progress is easier to see when it’s specific.' : 'A three-question session is enough to get comfortable and find your first useful piece of feedback.'}</p><button className="text-button" onClick={() => sessionsList.length ? onViewFeedback(sessionsList[0]) : onNavigate('practice')}>{sessionsList.length ? 'Review latest feedback' : 'Set up a short session'} <ArrowUpRight size={14} /></button></div><div className="editorial-panel"><FileText size={22} color="var(--primary)" /><h3>Your experience, well told.</h3><p>Bring your resume into the studio for a focused review and practical improvements.</p><button className="text-button" onClick={() => onNavigate('resume')}>Open resume workspace <ArrowUpRight size={14} /></button></div></aside></div>
    </div>
  );
};
export default DashboardView;
