import { confirmAction } from '../services/confirmAction';
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, StopCircle, Keyboard, Volume2 } from 'lucide-react';
import { useInterview } from '../context/InterviewContext';
import { useSettings } from '../context/SettingsContext';
import { useSpeech } from '../hooks/useSpeech';
import WaveformVisualizer from './WaveformVisualizer';
import AIAvatar3D from './AIAvatar3D';

export const InterviewRoomView: React.FC = () => {
  const { settings } = useSettings();
  const {
    currentSession,
    currentQuestionIndex,
    isLoading,
    elapsedSeconds,
    submitAnswer,
    skipQuestion,
    endInterview,
  } = useInterview();

  const {
    isSpeaking,
    speakText,
    stopSpeaking,
    isListening,
    transcript,
    interimText,       // ← live word-by-word preview
    startListening,
    stopListening,
    resetTranscript,
    recognitionSupported,
    speechError,
    analyserNode,      // ← real mic data for waveform
  } = useSpeech();

  const [typedAnswer, setTypedAnswer] = useState('');
  const [useKeyboard, setUseKeyboard] = useState(false);
  const [isQuestionSpeaking, setIsQuestionSpeaking] = useState(true);

  const currentQuestion = currentSession?.questions[currentQuestionIndex];

  // ─── Auto-speak the question whenever it changes ──────────────────────────
  useEffect(() => {
    if (!currentQuestion) return;

    setTypedAnswer('');
    resetTranscript();
    setUseKeyboard(!recognitionSupported);
    setIsQuestionSpeaking(true);
    stopListening();

    // Small delay so the UI finishes animating before speech starts
    const t = setTimeout(() => {
      speakText(
        currentQuestion.questionText,
        {
          voiceEnabled: settings.voiceEnabled,
          rate: settings.voiceRate ?? 1.0,
          pitch: settings.voicePitch ?? 1.0,
          voiceName: settings.voiceName ?? '',
        },
        () => {
          // Finished speaking loud once!
          setIsQuestionSpeaking(false);
        }
      );
    }, 450);

    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, !!currentQuestion]);

  // ─── Sync final transcript into the answer box ────────────────────────────
  useEffect(() => {
    if (transcript) {
      setTypedAnswer(transcript);
    }
  }, [transcript]);

  const hasSession = !!currentSession;
  // ─── Auto-coordinate microphone: ONLY listen when AI is completely done speaking ───
  useEffect(() => {
    if (
      recognitionSupported &&
      !speechError &&
      !useKeyboard &&
      !isSpeaking &&
      !isQuestionSpeaking &&
      hasSession &&
      !isLoading
    ) {
      startListening();
    } else if (isSpeaking || isQuestionSpeaking) {
      stopListening();
    }
  }, [isSpeaking, isQuestionSpeaking, useKeyboard, isLoading, hasSession, recognitionSupported, startListening, stopListening, speechError]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  if (!currentSession) {
    return (
      <div className="interview-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <div className="loading-blocker" style={{ position: 'relative', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="loading-spinner" style={{ width: '40px', height: '40px' }} />
          <span className="loading-text" style={{ fontSize: '1rem', marginTop: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Preparing your interview questions...
          </span>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', maxWidth: '280px' }}>
            Selecting realistic questions tailored for this role.
          </p>
        </div>
      </div>
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getAiState = (): 'speaking' | 'listening' | 'idle' => {
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async () => {
    stopListening();
    stopSpeaking();
    const finalAnswer = typedAnswer.trim();
    await submitAnswer(finalAnswer || 'No verbal response captured.');
  };

  const handleSkip = () => {
    stopSpeaking();
    stopListening();
    skipQuestion();
  };

  const handleFinish = async () => {
    if (!await confirmAction('Finish this practice and review your feedback? Any text in your current answer will be evaluated first.')) return;
    stopSpeaking();
    stopListening();
    const currentText = typedAnswer.trim();
    if (currentText) {
      await submitAnswer(currentText, true);
    } else {
      endInterview();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // What to display in the transcription box
  const displayedText = typedAnswer + (interimText ? ` ${interimText}` : '');
  const aiState = getAiState();

  return (
    <div className="interview-container">
      <div><span className="eyebrow">Focused practice</span><p className="session-context">{currentSession.roleTitle} · {currentSession.difficulty} · {currentSession.type.replace('_', ' ')}</p></div>

      {/* ── Interview header ─────────────────────────────────────────────── */}
      <div className="interview-header glass">
        <span className="interview-progress">
          {currentSession.isAdaptive
            ? `Q ${currentQuestionIndex + 1} (Adaptive)`
            : `Q ${currentQuestionIndex + 1} / ${currentSession.questions.length}`}
        </span>

        <div className="interview-timer">
          <ClockIcon size={12} />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>

        <button className="leave-room-btn" onClick={handleFinish} disabled={isLoading}>
          <StopCircle size={14} style={{ marginRight: 4 }} /> Finish
        </button>
      </div>

      {/* ── Loading overlay ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="loading-blocker" role="status">
          <div className="loading-spinner" />
          <span className="loading-text">Evaluating…</span>
        </div>
      )}

      {/* ── AI Panel ─────────────────────────────────────────────────────── */}
      <div className="ai-panel">

        {/* 3D Avatar */}
        <div className={`avatar-3d-container ${aiState}`}>
          <AIAvatar3D status={aiState} />
        </div>

        {/* Status label + manual replay button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <span className={`ai-status-text ${aiState}`} role="status">
            {isLoading ? 'Processing your answer…' : isSpeaking ? 'Reading your question…' : isListening ? 'Listening to your answer…' : 'Ready when you are'}
          </span>
          <button
            type="button"
            onClick={() => speakText(currentQuestion?.questionText || '', {
              voiceEnabled: true,
              rate: settings.voiceRate ?? 1.0,
              pitch: settings.voicePitch ?? 1.0,
              voiceName: settings.voiceName ?? '',
            })}
            title="Read question aloud"
            aria-label="Read question aloud"
            className="icon-btn"
          ><Volume2 size={18} /></button>
        </div>

        {/* Question text (shown as the AI's subtitle) */}
        <div className="ai-subtitle-box glass">
          <p>{currentQuestion?.questionText}</p>
        </div>

        {/* Real-time waveform – shows mic data when listening, animated wave when speaking */}
        <WaveformVisualizer
          status={aiState}
          analyserNode={analyserNode}
        />
      </div>

      {/* ── User Input Panel ─────────────────────────────────────────────── */}
      <div className="user-panel glass">

        {/* Panel header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Your Answer
          </span>
          {recognitionSupported && (
            <button
              className="toggle-simulator-btn"
              style={{ padding: '4px 8px', fontSize: '14px' }}
              disabled={isLoading}
              onClick={() => { stopListening(); setUseKeyboard(!useKeyboard); }}
            >
              {useKeyboard ? <><Mic size={10} /> Speak</> : <><Keyboard size={10} /> Type</>}
            </button>
          )}
        </div>

        {/* Transcription / typing box */}
        <div className={`transcription-box ${useKeyboard ? 'fallback-active' : ''} ${isListening ? 'is-listening' : ''}`}>
          {useKeyboard ? (
            <textarea
              className="transcription-textarea"
              aria-label="Your answer"
              value={typedAnswer}
              onChange={e => setTypedAnswer(e.target.value)}
              placeholder="Type your response here…"
              disabled={isLoading}
            />
          ) : (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
              {/* Final text (white) + interim preview (dimmer) */}
              {typedAnswer}
              {interimText && (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {' '}{interimText}
                </span>
              )}
              {!displayedText && (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', fontSize: '14px', lineHeight: '1.4' }}>
                  {speechError ? (
                    speechError === 'not-allowed' ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                        ⚠️ Microphone access is blocked. Please allow mic permissions in your browser settings, or tap the "Type" button above to type your answer.
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                        ⚠️ Speech recognition failed ({speechError}). If using Brave, enable "Google Services for Web Speech API" in <code>brave://settings/shields</code>, or tap the "Type" button to type.
                      </span>
                    )
                  ) : isListening ? (
                    'Speak now – your words will appear here in real-time…'
                  ) : (
                    'Tap the mic below and start speaking…'
                  )}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Mic controls (only in voice mode) */}
        {!useKeyboard && (
          <div className="voice-controls">
            <button
              className={`mic-btn ${isListening ? 'active' : ''}`}
              onClick={handleMicToggle}
              disabled={isLoading}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              {isListening ? <Mic size={32} /> : <MicOff size={32} />}
              {isListening && <div className="mic-ripple" />}
            </button>
            <span className="mic-instructions">
              {isListening ? 'Tap to STOP recording' : 'Tap mic to START speaking'}
            </span>
            {/* Keyboard escape hint */}
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Voice not working?{' '}
              <button
                onClick={() => setUseKeyboard(true)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', padding: 0, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
              >
                Switch to typing
              </button>
            </span>
          </div>
        )}

        {/* Submit / Skip */}
        <div className="action-bar">
          <button
            className="btn-secondary"
            onClick={handleSkip}
            disabled={isLoading}
            style={{ fontSize: '14px' }}
          >
            Skip question
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !displayedText.trim()}
            style={{ fontSize: '14px' }}
          >
            <Send size={14} /> Submit answer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Inline clock icon ─────────────────────────────────────────────────────────
const ClockIcon = ({ size, style }: { size: number; style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default InterviewRoomView;
