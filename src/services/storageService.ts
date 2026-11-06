import { BUILT_IN_GEMINI_KEYS, BUILT_IN_GROQ_KEYS } from './apiKeyPool';

export interface InterviewQuestionResponse {
  questionId: string;
  questionText: string;
  userResponse: string;
  score: number;
  technicalScore: number;
  communicationScore: number;
  structureScore: number;
  strengths: string;
  weaknesses: string;
  feedback: string;
  modelAnswer: string;
}

export interface InterviewSession {
  id: string;
  roleId: string;
  roleTitle: string;
  difficulty: string;
  type: string;
  date: string;
  overallScore: number;
  questions: InterviewQuestionResponse[];
  isAdaptive?: boolean;
  jobDescription?: string;
  isChatMode?: boolean;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

const STORAGE_KEYS = {
  SESSIONS: 'ai_interviewer_sessions',
  SETTINGS: 'ai_interviewer_settings_v2'
};

export interface AppSettings {
  voiceEnabled: boolean;
  voicePitch: number;
  voiceRate: number;
  theme: 'dark' | 'light';
  userName: string;
  voiceName: string;
  groqApiKey: string;
  nvidiaApiKey: string;
  geminiApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  voicePitch: 1.0,
  voiceRate: 1.0,
  theme: 'light',
  userName: 'Job Seeker',
  voiceName: '',
  groqApiKey: BUILT_IN_GROQ_KEYS[0],
  nvidiaApiKey: '',
  geminiApiKey: BUILT_IN_GEMINI_KEYS[0]
};

export const storageService = {
  getSessions(scope = 'guest'): InterviewSession[] {
    const raw = localStorage.getItem(`${STORAGE_KEYS.SESSIONS}:${scope}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveSession(session: InterviewSession, scope = 'guest'): void {
    const sessions = this.getSessions(scope);
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    this.replaceSessions(sessions, scope);
  },

  deleteSession(id: string, scope = 'guest'): void {
    this.replaceSessions(this.getSessions(scope).filter(s => s.id !== id), scope);
  },

  clearSessions(scope = 'guest'): void {
    this.replaceSessions([], scope);
  },

  replaceSessions(sessions: InterviewSession[], scope = 'guest'): void {
    localStorage.setItem(`${STORAGE_KEYS.SESSIONS}:${scope}`, JSON.stringify(sessions));
  },

  getSettings(scope = 'guest'): AppSettings {
    const raw = localStorage.getItem(`${STORAGE_KEYS.SETTINGS}:${scope}`);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      const settings = { ...DEFAULT_SETTINGS, ...parsed, groqApiKey: 'server', geminiApiKey: 'server', nvidiaApiKey: '' };
      if (!settings.groqApiKey) {
        settings.groqApiKey = DEFAULT_SETTINGS.groqApiKey;
      }
      return settings;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings: Partial<AppSettings>, scope = 'guest'): AppSettings {
    const current = this.getSettings(scope);
    const updated = { ...current, ...settings };
    localStorage.setItem(`${STORAGE_KEYS.SETTINGS}:${scope}`, JSON.stringify(updated));
    return updated;
  }
};
