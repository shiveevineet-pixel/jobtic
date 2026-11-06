import { confirmAction } from './services/confirmAction';
import React, { useState, Component, useEffect, useRef, lazy, Suspense } from 'react';
import './App.css';
import PCPreviewSimulator from './components/PCPreviewSimulator';
import Header from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import DashboardView, { StudioView } from './components/DashboardView';
import InterviewRoomView from './components/InterviewRoomView';
import ChatInterviewRoomView from './components/ChatInterviewRoomView';
import FeedbackReportView from './components/FeedbackReportView';
import { useInterview, InterviewProvider } from './context/InterviewContext';
import { InterviewSession } from './services/storageService';
import { House, FileText, History, AudioLines, Check, Settings, WifiOff, X } from 'lucide-react';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthView from './components/AuthView';
const ResumeView = lazy(() => import('./components/ResumeView'));

class ErrorBoundary extends Component<{ children: React.ReactNode; onReset?: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[Jobtic view]', error, info); }
  render() {
    if (this.state.hasError) return <div className="page empty-state" role="alert"><h3>This view couldn’t be opened.</h3><p>Your saved sessions are still available. Try returning to the workspace.</p><button className="btn-primary" onClick={() => { this.setState({ hasError: false }); this.props.onReset?.(); }}>Return to workspace</button></div>;
    return this.props.children;
  }
}

function AppContent() {
  const { user, mockUser, isLoading } = useAuth();
  const { isInterviewActive, currentSession, resetInterview, startInterview, errorMessage, clearError, clearHistory, syncMessage, retrySync } = useInterview();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [activeMainView, setActiveMainView] = useState<StudioView>('home');
  const [hasOpenedResume, setHasOpenedResume] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const mainRef = useRef<HTMLElement>(null);
  const activeViewRef = useRef<StudioView>('home');
  useEffect(() => {
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (!isInterviewActive) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isInterviewActive]);
  const navigate = async (view: StudioView) => {
    if (isInterviewActive && !await confirmAction('Leave this practice? Unfinished answers will be lost. Cancel to continue or finish the session first.')) return;
    if (isInterviewActive || currentSession) resetInterview();
    activeViewRef.current = view;
    setSelectedSession(null);
    setActiveMainView(view);
    if (view === 'resume') setHasOpenedResume(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Animate destination smoothly from bottom with zero side motion or blur
    requestAnimationFrame(() => {
      const main = mainRef.current;
      main?.focus({ preventScroll: true });
      if (!main || window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof main.animate !== 'function') return;
      main.getAnimations().forEach(animation => animation.cancel());
      main.animate([
        { opacity: 0, transform: 'translate3d(0, 18px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ], { duration: 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
  };
  const showMain = !isInterviewActive && !currentSession && !selectedSession;
  const session = currentSession || selectedSession;
  const retry = async () => {
    if (!session) return;
    const previous = session;
    setSelectedSession(null);
    resetInterview();
    await startInterview(previous.roleId, String(previous.difficulty), previous.type, previous.jobDescription || '', previous.isAdaptive ? -1 : previous.questions.length, !!previous.isChatMode);
  };
  const destinations = [
    { id: 'home' as const, label: 'Home', icon: House },
    { id: 'practice' as const, label: 'Practice', icon: AudioLines },
    { id: 'resume' as const, label: 'Resumes', icon: FileText },
    { id: 'history' as const, label: 'History', icon: History },
  ];
  if (isLoading) return <div className="auth-container" role="status"><div className="loading-spinner" /><p>Opening your workspace…</p></div>;
  if (!user && !mockUser) return <AuthView />;
  return (
    <PCPreviewSimulator>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className={'workspace ' + (isInterviewActive ? 'workspace--session' : '')}>
        <aside className="studio-sidebar">
          <div className="brand"><span className="brand-mark"><Check size={22} /></span><div className="brand-name">jobtic<span className="brand-product">Career studio</span></div></div>
          <nav className="studio-navigation" aria-label="Workspace navigation">{destinations.map(({ id, label, icon: Icon }) => <button key={id} className={'nav-item ' + (activeMainView === id && showMain ? 'active' : '')} aria-current={activeMainView === id && showMain ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18} />{label}</button>)}</nav>
          <div className="sidebar-footer"><div className="sidebar-note"><span className="eyebrow">Room to grow</span><p>Good preparation starts with one thoughtful answer.</p></div><button className="nav-item" onClick={() => setIsSettingsOpen(true)}><Settings size={18} />Settings & preferences</button></div>
        </aside>
        <div className="workspace-body">
          <Header onOpenSettings={() => setIsSettingsOpen(true)} beforeSignOut={() => !isInterviewActive || confirmAction('Sign out and leave this unfinished practice? Your current answers will be lost.')} />
          <main id="main-content" className="workspace-main" tabIndex={-1} ref={mainRef}>
            {offline && <div className="notice" role="status"><WifiOff size={18} />You’re offline. Saved feedback is available; AI practice and resume analysis need a connection.</div>}
            {syncMessage && <div className="notice" role="status"><span>{syncMessage}</span><button className="btn-secondary" onClick={retrySync}>Retry sync</button></div>}
            {errorMessage && <div className="alert alert-danger workspace-alert" role="alert"><span>{errorMessage}</span><button className="icon-btn" onClick={clearError} aria-label="Dismiss error"><X size={16} /></button></div>}
            {isInterviewActive && <ErrorBoundary onReset={resetInterview}>{!currentSession ? <div className="page preparing-state" role="status"><div className="loading-spinner" /><h3>Preparing your practice…</h3><p>Finding questions tailored to your role and focus. You can cancel without losing your setup.</p><button className="btn-secondary" onClick={() => navigate('practice')}>Cancel preparation</button></div> : currentSession.isChatMode ? <ChatInterviewRoomView /> : <InterviewRoomView />}</ErrorBoundary>}
            {!isInterviewActive && session && <ErrorBoundary onReset={() => navigate('history')}><FeedbackReportView session={session} onBackToDashboard={() => navigate('history')} onRetry={retry} /></ErrorBoundary>}
            {/* Keep drafts mounted when moving between destinations. No fabricated data. */}
            <div hidden={!showMain || activeMainView === 'resume'}><ErrorBoundary onReset={() => navigate('home')}><DashboardView mode={activeMainView} onNavigate={navigate} onViewFeedback={setSelectedSession} /></ErrorBoundary></div>
            {hasOpenedResume && <div hidden={!showMain || activeMainView !== 'resume'}><ErrorBoundary onReset={() => navigate('home')}><Suspense fallback={<div className="page" role="status"><div className="loading-spinner" /><p>Opening resume workspace…</p></div>}><ResumeView onUseForInterview={text => { sessionStorage.setItem(`jobtic_resume_context:${user ? `user:${user.id}` : 'guest'}`, text); navigate('practice'); }} /></Suspense></ErrorBoundary></div>}
          </main>
        </div>
        {showMain && <nav className="bottom-tab-nav" aria-label="Mobile navigation">{destinations.map(({ id, label, icon: Icon }) => <button key={id} id={'tab-' + id} className={'bottom-tab-btn ' + (activeMainView === id ? 'active' : '')} aria-current={activeMainView === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>)}</nav>}
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearHistory={() => { clearHistory(); setSelectedSession(null); }} />
    </PCPreviewSimulator>
  );
}
export default function App() {
  return <AuthProvider><AccountWorkspace /></AuthProvider>;
}

function AccountWorkspace() {
  const { user, mockUser, isLoading } = useAuth();
  const identity = user ? `user:${user.id}` : mockUser ? 'guest' : 'signed-out';
  useEffect(() => { sessionStorage.removeItem('jobtic_resume_context'); }, [identity]);
  if (isLoading) return <div className="auth-container" role="status"><div className="loading-spinner" /><p>Verifying your account…</p></div>;
  // Every account change destroys drafts, timers, reports, settings and pending UI work.
  return <SettingsProvider key={identity}><InterviewProvider><AppContent /></InterviewProvider></SettingsProvider>;
}
