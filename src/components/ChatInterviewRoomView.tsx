import { confirmAction } from '../services/confirmAction';
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, StopCircle, Keyboard } from 'lucide-react';
import { useInterview } from '../context/InterviewContext';
import { useSettings } from '../context/SettingsContext';
import { useSpeech } from '../hooks/useSpeech';
import WaveformVisualizer from './WaveformVisualizer';
import AIAvatar3D from './AIAvatar3D';

export const ChatInterviewRoomView: React.FC = () => {
  const { settings } = useSettings();
  const {
    currentSession,
    isLoading,
    elapsedSeconds,
    submitChatAnswer,
    endChatInterview,
  } = useInterview();

  const {
    isSpeaking,
    speakText,
    stopSpeaking,
    isListening,
    transcript,
    interimText,
    startListening,
    stopListening,
    resetTranscript,
    recognitionSupported,
    analyserNode,
    speechError,
  } = useSpeech();

  const [typedAnswer, setTypedAnswer] = useState('');
  const [useKeyboard, setUseKeyboard] = useState(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  }, [currentSession?.chatHistory, isLoading]);

  // Retrieve Sophia's latest message to auto-speak
  const lastMessage = currentSession?.chatHistory?.[currentSession.chatHistory.length - 1];

  useEffect(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    resetTranscript();
    setTypedAnswer('');
    setIsAiSpeaking(true);
    stopListening();
    
    // Auto-read the new message from Sophia
    const t = setTimeout(() => {
      speakText(
        lastMessage.content,
        {
          voiceEnabled: settings.voiceEnabled,
          rate: settings.voiceRate ?? 1.0,
          pitch: settings.voicePitch ?? 1.0,
          voiceName: settings.voiceName ?? '',
        },
        () => {
          setIsAiSpeaking(false);
        }
      );
    }, 400);

    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.content]);

  // Sync final speech recognition transcript into the input field
  useEffect(() => {
    if (transcript) {
      setTypedAnswer(transcript);
    }
  }, [transcript]);

  // Only stop mic when Sophia is speaking or AI is loading — never force-start it
  useEffect(() => {
    if (isSpeaking || isAiSpeaking || isLoading) {
      stopListening();
    }
  }, [isSpeaking, isAiSpeaking, isLoading, stopListening]);

  // Teardown speech on component unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  if (!currentSession) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const answer = typedAnswer.trim();
    if (!answer || isLoading) return;

    stopSpeaking();
    stopListening();
    setTypedAnswer('');
    resetTranscript();
    const sent = await submitChatAnswer(answer);
    if (!sent) setTypedAnswer(answer);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Determine avatar expression: speaking, listening or neutral
  const getAiState = (): 'speaking' | 'listening' | 'idle' => {
    if (isSpeaking) return 'speaking';
    if (isListening && !useKeyboard) return 'listening';
    return 'idle';
  };

  return (
    <div className="interview-container chat-room-layout">
      {/* 3D Interviewer Area */}
      <div className="avatar-header-section glass">
        <div className="avatar-wrapper-chat">
          <AIAvatar3D status={getAiState()} />
        </div>
        
        <div className="interviewer-header-info">
          <div className="header-meta-row">
            <span className="badge-type">{currentSession.type.replace('_', ' ')}</span>
            <span className="badge-difficulty">{currentSession.difficulty}</span>
          </div>
          <h3 className="interviewer-name">Sophia</h3>
          <p className="interviewer-title">AI practice companion · {currentSession.roleTitle}</p>
          
          <div className="live-indicators">
            <span className={`status-dot ${getAiState()}`}></span>
            <span className="status-label">
              {getAiState() === 'speaking' && "Sophia is speaking..."}
              {getAiState() === 'listening' && "Sophia is listening..."}
                {getAiState() === 'idle' && (isLoading ? "Preparing a response…" : "Ready for your answer")}
            </span>
            <span className="elapsed-timer">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        <button className="btn-danger finish-session-btn" onClick={async () => { if (!await confirmAction(typedAnswer.trim() ? 'Finish and evaluate this conversation? Your unsent draft will not be included. Cancel to send it first.' : 'Finish this conversation and review your feedback?')) return; stopSpeaking(); stopListening(); endChatInterview(); }} disabled={isLoading}>
          <StopCircle size={14} /> Finish & review
        </button>
      </div>

      {/* Chat Thread Container */}
      <div className="chat-thread-container glass">
        <div className="chat-messages-scroll" role="log" aria-label="Interview conversation" aria-live="polite">
          {currentSession.chatHistory?.map((msg, index) => (
            <div key={index} className={`chat-bubble-row ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="chat-avatar-circle">S</div>
              )}
              <div className={`chat-bubble-bubble ${msg.role}`}>
                <p className="bubble-text">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="chat-bubble-row assistant">
              <div className="chat-avatar-circle">S</div>
              <div className="chat-bubble-bubble assistant typing-indicator-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Live speech preview if candidate is currently talking */}
        {isListening && interimText && !useKeyboard && (
          <div className="live-speech-bubble-preview">
            <span style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>SPEECH PREVIEW</span>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>{interimText}</p>
          </div>
        )}
      </div>

      {/* Input / Control Panel */}
      <div className="chat-input-controls glass">
        {speechError && <p className="caption" role="alert">Microphone transcription unavailable ({speechError}). You can type your response below.</p>}
        <form onSubmit={handleSend} style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}>
          {/* Visualizer when listening */}
          {isListening && !useKeyboard && (
            <div className="chat-waveform-container">
              <WaveformVisualizer status={getAiState()} analyserNode={analyserNode} />
            </div>
          )}

          {/* Toggle Typing vs Speaking Mode */}
          <button
            type="button"
            className={`control-circle-btn ${useKeyboard ? 'active' : ''}`}
            disabled={!recognitionSupported || isLoading}
            aria-label={useKeyboard ? "Switch to voice" : "Switch to typing"}
            onClick={() => {
              if (useKeyboard) {
                setUseKeyboard(false);
                startListening();
              } else {
                setUseKeyboard(true);
                stopListening();
              }
            }}
            title={useKeyboard ? "Switch to Voice" : "Switch to Keyboard"}
          >
            <Keyboard size={18} />
          </button>

          {/* Text input area */}
          <input
            type="text"
            className="chat-text-input"
            aria-label="Your response"
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder={
              useKeyboard
                ? "Type your response here..."
                : isListening
                ? "Listening... Speak now or type..."
                : "Tap the mic or type to respond..."
            }
            disabled={isLoading}
          />

          {/* Voice Microphone Toggle */}
          {recognitionSupported && !useKeyboard && (
            <button
              type="button"
              className={`mic-circle-btn ${isListening ? 'active pulsing' : ''}`}
              aria-label={isListening ? "Stop microphone" : "Start microphone"}
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  resetTranscript();
                  startListening();
                }
              }}
              title={isListening ? "Mute Microphone" : "Unmute Microphone"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          {/* Send Response Button */}
          <button
            type="submit"
            className="chat-send-btn"
            aria-label="Send response"
            disabled={isLoading || !typedAnswer.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterviewRoomView;
