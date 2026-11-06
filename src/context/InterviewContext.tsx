import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { InterviewSession } from '../services/storageService';
import { useAuth } from './AuthContext';
import { createHistoryRepository } from '../services/historyRepository';
import { cloudHistory } from '../services/cloudHistory';
import { mockDatabase, Question } from '../services/mockDatabase';
import { geminiService, DEFAULT_GEMINI_KEY } from '../services/geminiService';
import { useSettings } from './SettingsContext';
import { summarizeEvaluatedQuestions } from '../services/studioMetrics';


interface InterviewContextType {
  sessionsList: InterviewSession[];
  currentSession: InterviewSession | null;
  currentQuestionIndex: number;
  isInterviewActive: boolean;
  isLoading: boolean;
  elapsedSeconds: number;
  startInterview: (
    roleId: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    questionCount: number,
    isChatMode?: boolean
  ) => Promise<void>;
  submitAnswer: (answerText: string, finishAfter?: boolean) => Promise<boolean>;
  submitChatAnswer: (answerText: string) => Promise<boolean>;
  errorMessage: string;
  syncMessage: string;
  retrySync: () => void;
  clearError: () => void;
  clearHistory: () => void;
  skipQuestion: () => void;
  endInterview: () => void;
  endChatInterview: () => Promise<void>;
  deleteSession: (sessionId: string) => void;
  resetInterview: () => void;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export const InterviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [history] = useState(() => createHistoryRepository(user?.id || null, cloudHistory));
  const [syncMessage, setSyncMessage] = useState('');
  const mounted = useRef(true);
  const [sessionsList, setSessionsList] = useState<InterviewSession[]>([]);
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const timerRef = useRef<number | null>(null);
  const operationRef = useRef(0);

  const retrySync = () => {
    if (!user) return;
    setSyncMessage('Syncing your account history…');
    history.sync().then(sessions => {
      if (!mounted.current) return;
      setSessionsList(sessions);
      setSyncMessage(history.pending() ? 'Changes saved on this device. Waiting to sync.' : '');
    }).catch(() => {
      if (mounted.current) setSyncMessage('Cloud sync failed. Device-saved changes are waiting to sync; retry when connected.');
    });
  };

  useEffect(() => {
    mounted.current = true;
    setSessionsList(history.list());
    retrySync();
    window.addEventListener('online', retrySync);
    return () => { mounted.current = false; operationRef.current += 1; window.removeEventListener('online', retrySync); };
    // The account-keyed provider owns one immutable repository for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer loop when active
  useEffect(() => {
    if (isInterviewActive && !isLoading) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isInterviewActive, isLoading]);

  // A storage failure must never prevent the candidate from seeing the report they just earned.
  const finalizeSession = (session: InterviewSession) => {
    try {
      history.save(session);
      setSessionsList(history.list());
      retrySync();
    } catch (error) {
      console.error('Interview storage failed:', error);
      setSyncMessage('This report could not be saved on the device. Keep it open and export it before leaving.');
    }
    setCurrentSession(session);
    setIsInterviewActive(false);
  };

  const startInterview = async (
    roleId: string,
    difficulty: string,
    type: string,
    jobDescription: string,
    questionCount: number,
    isChatMode?: boolean
  ) => {
    const operation = ++operationRef.current;
    setErrorMessage('');
    setIsLoading(true);
    setIsInterviewActive(true);
    setCurrentQuestionIndex(0);
    setElapsedSeconds(0);

    let roleTitle = "Custom Role";
    // Find matching role in mock database
    const dbKeys = Object.keys(mockDatabase);
    const matchedKey = dbKeys.find(key => key.toLowerCase() === roleId.toLowerCase() || mockDatabase[key].title.toLowerCase() === roleId.toLowerCase());

    if (matchedKey) {
      roleTitle = mockDatabase[matchedKey].title;
    } else {
      roleTitle = roleId; // custom role name typed by user
    }

    if (isChatMode) {
      try {
        const activeApiKey = settings.geminiApiKey || DEFAULT_GEMINI_KEY;
        const welcomeMsg = await geminiService.generateChatResponse(
          roleTitle, difficulty, type, jobDescription, [], activeApiKey
        );
        if (operation !== operationRef.current) return;
        const newSession: InterviewSession = {
          id: 'session_' + crypto.randomUUID(),
          roleId,
          roleTitle,
          difficulty,
          type,
          date: new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          overallScore: 0,
          questions: [],
          isChatMode: true,
          chatHistory: [
            { role: 'assistant', content: welcomeMsg }
          ],
          jobDescription: jobDescription
        };

        setCurrentSession(newSession);
      } catch (err) {
        if (operation !== operationRef.current) return;
        console.error("Setup Chat Error:", err);
        setErrorMessage('Could not prepare the conversation. Check your connection and try again; your setup is still here.');
        setIsInterviewActive(false);
      } finally {
        if (operation === operationRef.current) setIsLoading(false);
      }
      return;
    }

    let selectedQuestions: Partial<Question>[] = [];

    try {
      // Find matching role in mock database
      const dbKeys = Object.keys(mockDatabase);
      const matchedKey = dbKeys.find(key => key.toLowerCase() === roleId.toLowerCase() || mockDatabase[key].title.toLowerCase() === roleId.toLowerCase());

      if (matchedKey) {
        roleTitle = mockDatabase[matchedKey].title;
      } else {
        roleTitle = roleId; // custom role name typed by user
      }

      // Every interview question is generated by Gemini Google AI
      const activeApiKey = settings.geminiApiKey || DEFAULT_GEMINI_KEY;
      const countToGenerate = questionCount === -1 ? 1 : questionCount;
      selectedQuestions = await geminiService.generateQuestions(
        roleTitle, difficulty, type, jobDescription, countToGenerate, activeApiKey
      );
      if (operation !== operationRef.current) return;
      if (selectedQuestions.length === 0) {
        throw new Error('Could not generate any interview questions.');
      }

      // Scaffold empty interview session
      const newSession: InterviewSession = {
        id: 'session_' + crypto.randomUUID(),
        roleId,
        roleTitle,
        difficulty,
        type,
        date: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        overallScore: 0,
        questions: selectedQuestions.map(q => ({
          questionId: q.id || 'q_' + Math.random().toString(36).substr(2, 9),
          questionText: q.text || '',
          userResponse: '',
          score: 0,
          technicalScore: 0,
          communicationScore: 0,
          structureScore: 0,
          strengths: '',
          weaknesses: '',
          feedback: '',
          modelAnswer: q.modelAnswer || ''
        })),
        isAdaptive: questionCount === -1,
        jobDescription: jobDescription
      };


      setCurrentSession(newSession);
    } catch (err) {
      if (operation !== operationRef.current) return;
      console.error("Setup Error:", err);
      setErrorMessage('Could not prepare your questions. Check your connection and try again; your setup is still here.');
      setIsInterviewActive(false);
    } finally {
      if (operation === operationRef.current) setIsLoading(false);
    }
  };

  const submitAnswer = async (answerText: string, finishAfter = false) => {
    if (!currentSession) return false;
    const operation = ++operationRef.current;
    setErrorMessage('');
    setIsLoading(true);

    const updatedQuestions = [...currentSession.questions];
    const currentQ = updatedQuestions[currentQuestionIndex];
    if (!currentQ) {
      console.error('Cannot submit an answer because there is no active question.');
      setIsLoading(false);
      return false;
    }

    try {
      const activeApiKey = settings.geminiApiKey || DEFAULT_GEMINI_KEY;
      const evaluation = await geminiService.evaluateResponse(
        currentQ.questionText, answerText, activeApiKey
      );
      if (operation !== operationRef.current) return false;

      // Update question response details
      updatedQuestions[currentQuestionIndex] = {
        ...currentQ,
        userResponse: answerText,
        score: evaluation.score,
        technicalScore: evaluation.technicalScore,
        communicationScore: evaluation.communicationScore,
        structureScore: evaluation.structureScore,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        feedback: evaluation.feedback,
        modelAnswer: evaluation.modelAnswer
      };

      const nextIndex = currentQuestionIndex + 1;
      let isFinished = finishAfter || nextIndex >= updatedQuestions.length;

      // If in adaptive mode, dynamically query the next question
      if (currentSession.isAdaptive && isFinished && !finishAfter) {
        try {
          const history = updatedQuestions.map(q => ({
            questionText: q.questionText,
            userResponse: q.userResponse,
            score: q.score
          }));

          const adaptiveResult = await geminiService.generateNextAdaptiveQuestion(
            currentSession.roleTitle,
            currentSession.difficulty,
            currentSession.type,
            currentSession.jobDescription || "",
            history,
            activeApiKey
          );
          if (operation !== operationRef.current) return false;

          if (adaptiveResult.shouldContinue && adaptiveResult.nextQuestion) {
            const nQ = adaptiveResult.nextQuestion;
            updatedQuestions.push({
              questionId: nQ.id || 'q_adapt_' + Math.random().toString(36).substr(2, 9),
              questionText: nQ.text || '',
              userResponse: '',
              score: 0,
              technicalScore: 0,
              communicationScore: 0,
              structureScore: 0,
              strengths: '',
              weaknesses: '',
              feedback: '',
              modelAnswer: nQ.modelAnswer || ''
            });
            isFinished = false; // We have a new question, so the interview is not finished yet!
          }
        } catch (adaptiveErr) {
          console.error("Failed to generate the next adaptive question. Completing the report with the real evaluation already received.", adaptiveErr);
          isFinished = true;
        }
      }

      const reportQuestions = finishAfter ? summarizeEvaluatedQuestions(updatedQuestions)!.questions : updatedQuestions;
      let overallScore = 0;
      if (isFinished) {
        const total = reportQuestions.reduce((acc, q) => acc + q.score, 0);
        overallScore = Math.round(total / reportQuestions.length);
      }

      const updatedSession: InterviewSession = {
        ...currentSession,
        overallScore: isFinished ? overallScore : 0,
        questions: reportQuestions
      };

      setCurrentSession(updatedSession);

      if (isFinished) {
        finalizeSession(updatedSession);
      } else {
        setCurrentQuestionIndex(nextIndex);
      }
      return true;
    } catch (err) {
      if (operation !== operationRef.current) return false;
      console.error("Evaluation Error:", err);
      setErrorMessage('Your answer couldn’t be evaluated. It’s still here; check your connection and submit again.');
      return false;
    } finally {
      if (operation === operationRef.current) setIsLoading(false);
    }
  };

  const skipQuestion = async () => {
    await submitAnswer("No response provided (question skipped).");
  };

  const endInterview = () => {
    if (!currentSession) return;

    // A partial report may only contain answers that have actually been evaluated by the LLM.
    const summary = summarizeEvaluatedQuestions(currentSession.questions);
    if (!summary) {
      setErrorMessage('Answer or skip at least one question before finishing to receive coaching feedback.');
      return;
    }

    const finalizedSession: InterviewSession = {
      ...currentSession,
      ...summary
    };

    finalizeSession(finalizedSession);
  };

  const submitChatAnswer = async (answerText: string) => {
    if (!currentSession || !currentSession.chatHistory) return false;
    const operation = ++operationRef.current;
    setErrorMessage('');
    setIsLoading(true);

    const userMsg = { role: 'user' as const, content: answerText };
    const updatedHistory = [...currentSession.chatHistory, userMsg];

    // Temporarily update currentSession state with user reply so the bubble shows up instantly
    setCurrentSession({
      ...currentSession,
      chatHistory: updatedHistory
    });

    try {
      const activeApiKey = settings.geminiApiKey || DEFAULT_GEMINI_KEY;
      
      const aiReply = await geminiService.generateChatResponse(
        currentSession.roleTitle,
        currentSession.difficulty,
        currentSession.type,
        currentSession.jobDescription || "",
        updatedHistory,
        activeApiKey
      );
      if (operation !== operationRef.current) return false;

      const assistantMsg = { role: 'assistant' as const, content: aiReply };
      
      setCurrentSession({
        ...currentSession,
        chatHistory: [...updatedHistory, assistantMsg]
      });
      return true;
    } catch (err) {
      if (operation !== operationRef.current) return false;
      console.error("Chat Response Error:", err);
      setCurrentSession(currentSession);
      setErrorMessage('The interviewer couldn’t respond. Your answer is back in the composer; try sending again.');
      return false;
    } finally {
      if (operation === operationRef.current) setIsLoading(false);
    }
  };

  const endChatInterview = async () => {
    if (!currentSession || !currentSession.chatHistory) return;
    const operation = ++operationRef.current;
    setErrorMessage('');
    if (!currentSession.chatHistory.some(message => message.role === 'user')) {
      setErrorMessage('Send at least one response before ending the conversation for feedback.');
      return;
    }
    setIsLoading(true);

    try {
      const activeApiKey = settings.geminiApiKey || DEFAULT_GEMINI_KEY;
      const evaluation = await geminiService.evaluateChatSession(
        currentSession.roleTitle,
        currentSession.difficulty,
        currentSession.type,
        currentSession.chatHistory,
        activeApiKey
      );
      if (operation !== operationRef.current) return;

      const candidateResponses = currentSession.chatHistory
        .filter(message => message.role === 'user')
        .map(message => message.content)
        .join('\n\n');
      const finalizedSession: InterviewSession = {
        ...currentSession,
        overallScore: evaluation.score,
        questions: [{
          questionId: 'q_chat_overall',
          questionText: 'Conversational Chat Mock Interview Summary',
          userResponse: candidateResponses || 'No candidate response was recorded.',
          score: evaluation.score,
          technicalScore: evaluation.technicalScore,
          communicationScore: evaluation.communicationScore,
          structureScore: evaluation.structureScore,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          feedback: evaluation.feedback,
          modelAnswer: evaluation.modelAnswer
        }],
        chatHistory: currentSession.chatHistory
      };

      finalizeSession(finalizedSession);
    } catch (error) {
      if (operation !== operationRef.current) return;
      console.error('Chat AI evaluation failed:', error);
      setErrorMessage('Feedback couldn’t be generated. Your conversation is still here; check your connection and try finishing again.');
    } finally {
      if (operation === operationRef.current) setIsLoading(false);
    }
  };

  const deleteSession = (id: string) => {
    try { history.remove(id); setSessionsList(history.list()); retrySync(); }
    catch { setSyncMessage('Could not save this deletion. Please try again.'); return; }
    if (currentSession && currentSession.id === id) {
      setCurrentSession(null);
    }
  };

  const resetInterview = () => {
    operationRef.current += 1;
    setErrorMessage('');
    setCurrentSession(null);
    setCurrentQuestionIndex(0);
    setIsInterviewActive(false);
    setIsLoading(false);
    setElapsedSeconds(0);
  };

  return (
    <InterviewContext.Provider value={{
      sessionsList,
      currentSession,
      currentQuestionIndex,
      isInterviewActive,
      isLoading,
      elapsedSeconds,
      errorMessage,
      syncMessage,
      retrySync,
      clearError: () => setErrorMessage(''),
      clearHistory: () => { try { history.clear(); setSessionsList([]); retrySync(); } catch { setSyncMessage('Could not save the history deletion. Please try again.'); } },
      startInterview,
      submitAnswer,
      submitChatAnswer,
      skipQuestion,
      endInterview,
      endChatInterview,
      deleteSession,
      resetInterview
    }}>
      {children}
    </InterviewContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};
