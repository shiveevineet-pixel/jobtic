import { useState, useEffect, useRef, useCallback } from 'react';

// Detect if we're running inside an Android WebView (Capacitor)
const isAndroidWebView = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && (/wv\b/i.test(ua) || /Capacitor/i.test(ua) || /Version\/[\d.]+.*Chrome/i.test(ua));
})();

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionResultItem;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionResultListLike {
  [index: number]: SpeechRecognitionResultLike;
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

import { edgeTts, nativeTts } from '../services/edgeTtsService';

export interface AppVoice {
  name: string;
  lang: string;
  isEdge?: boolean;
  friendlyName?: string;
}

export const useSpeech = () => {
  // ─── Speech Synthesis (Text-to-Speech) ───────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [voices, setVoices] = useState<AppVoice[]>([]);


  // ─── Speech Recognition (Speech-to-Text) ─────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState(''); // live word-by-word preview
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false); // tracks user intent so we can auto-restart
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0); // prevent rapid error loops
  const [speechError, setSpeechError] = useState<string | null>(null);

  // ─── Track processed results to prevent echo/duplication on Android ───────
  const processedResultsRef = useRef(0);

  // ─── Dummy Web Audio ref to keep TS signature compatible ─────────────────
  const dummyAnalyserRef = useRef<AnalyserNode | null>(null);

  // ─── Load the actual voice engines available on this device ───────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    synthRef.current = synth || null;

    let cancelled = false;

    const updateVoices = () => {
      const v = synth?.getVoices() || [];
      const sysVoices: AppVoice[] = v.map(item => ({
        name: item.name,
        lang: item.lang,
        isEdge: false,
        friendlyName: item.name
      }));
      const cloudVoice: AppVoice = {
        name: 'cloud-ai-voice',
        lang: 'en-US',
        isEdge: false,
        friendlyName: 'Jobtic AI Voice (Natural)'
      };
      if (!nativeTts.isAvailable() && !cancelled) {
        setVoices([cloudVoice, ...sysVoices]);
      }
    };

    const updateNativeVoices = async () => {
      if (!nativeTts.isAvailable()) return;
      try {
        const nativeVoices = await nativeTts.getVoices();
        if (!cancelled && nativeVoices.length > 0) {
          setVoices(nativeVoices.map(voice => ({
            name: voice.id,
            lang: voice.lang,
            isEdge: false,
            friendlyName: voice.name
          })));
        }
      } catch (error) {
        // The Android engine may not have completed initialisation yet; retries below handle it.
        console.warn('Could not load native TTS voices yet:', error);
      }
    };

    updateVoices();
    void updateNativeVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoices;
    }
    synth?.addEventListener?.('voiceschanged', updateVoices);

    // Both Web Speech and native Android TTS can become available shortly after launch.
    const pollInterval = setInterval(() => {
      updateVoices();
      void updateNativeVoices();
    }, 500);

    const timeout = setTimeout(() => clearInterval(pollInterval), 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearTimeout(timeout);
      synth?.removeEventListener?.('voiceschanged', updateVoices);
    };
  }, []);

  // ─── Build recognition instance ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    setRecognitionSupported(true);

    const buildRec = () => {
      const rec = new SpeechRecognition();
      // On Android WebView, continuous mode causes rapid on/off flicker loops.
      // Use single-shot mode instead and manually restart when needed.
      rec.continuous = !isAndroidWebView;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        consecutiveErrorsRef.current = 0;
        // Reset processed results counter for this session
        processedResultsRef.current = 0;
      };

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        consecutiveErrorsRef.current = 0;
        let finalChunk = '';
        let interimChunk = '';

        // On Android WebView, event.resultIndex can be unreliable and 
        // the engine may re-send already-processed results, causing echo.
        // We track processed results ourselves to avoid duplication.
        const startIdx = isAndroidWebView
          ? processedResultsRef.current
          : event.resultIndex;

        for (let i = startIdx; i < event.results.length; ++i) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += text + ' ';
            // Mark this result as processed so it won't be re-added
            processedResultsRef.current = i + 1;
          } else {
            interimChunk += text; // live preview (not yet committed)
          }
        }

        if (finalChunk) {
          // Commit final words permanently
          setTranscript(prev => prev + finalChunk);
          setInterimText(''); // clear the preview – it's now in transcript
        } else if (interimChunk) {
          // Show live preview of what's being said right now
          setInterimText(interimChunk);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.error('Speech Recognition Error:', event.error);
        consecutiveErrorsRef.current += 1;
        setSpeechError(event.error);

        // Turn off auto-restart for critical errors or too many consecutive errors
        const isCriticalError = 
          event.error === 'not-allowed' || 
          event.error === 'service-not-allowed' ||
          event.error === 'audio-capture' ||
          event.error === 'aborted' ||
          consecutiveErrorsRef.current >= 3;

        if (isCriticalError) {
          shouldListenRef.current = false;
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimText(''); // clear interim on session end

        // Auto-restart if the user still wants to listen.
        // On Android, use a longer delay to avoid rapid flicker loops.
        if (shouldListenRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          const delay = isAndroidWebView ? 1500 : 800;
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldListenRef.current) {
              // Reset the processed results counter for the new session
              processedResultsRef.current = 0;
              try {
                rec.start();
              } catch {
                // Ignore errors from rapid start attempts
              }
            }
          }, delay);
        }
      };

      return rec;
    };

    recognitionRef.current = buildRec();

    return () => {
      shouldListenRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      recognitionRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, []);

  // ─── TTS ──────────────────────────────────────────────────────────────────
  const speakText = useCallback((
    text: string,
    settings: { voiceEnabled: boolean; rate: number; pitch: number; voiceName?: string },
    onDone?: () => void
  ) => {
    // Only bail if voice is explicitly disabled
    if (!settings.voiceEnabled) {
      onDone?.();
      return;
    }

    // Stop any currently playing speech
    try {
      if (synthRef.current?.paused) {
        synthRef.current.resume();
      }
    } catch (e) {
      console.warn('Speech synthesis resume failed:', e);
    }

    const isSpeakingNow = isSpeaking || synthRef.current?.speaking;
    if (isSpeakingNow) {
      edgeTts.stop();
      synthRef.current?.cancel();
      setIsSpeaking(false);
    }

    setTimeout(async () => {
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      if (!cleanText) {
        onDone?.();
        return;
      }

      setIsSpeaking(true);

      try {
        await edgeTts.speak(
          cleanText,
          settings.voiceName || '',
          settings.rate || 1.0,
          settings.pitch || 1.0,
          () => {
            setIsSpeaking(false);
            onDone?.();
          }
        );
      } catch (err) {
        console.warn('TTS failed:', err);
        setIsSpeaking(false);
        onDone?.();
      }
    }, isSpeakingNow ? 150 : 20);
  }, [isSpeaking]);

  const stopSpeaking = useCallback(() => {
    edgeTts.stop();
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  // ─── Mic controls ─────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;
    setSpeechError(null);
    stopSpeaking();
    shouldListenRef.current = true;
    processedResultsRef.current = 0; // Reset for new listening session
    try {
      recognitionRef.current.start();
    } catch {
      // Already started – safe to ignore
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false; // prevent auto-restart
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore if not started
    }
    setInterimText('');
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimText('');
    processedResultsRef.current = 0;
  }, []);

  return {
    isSpeaking,
    speakText,
    stopSpeaking,
    isListening,
    transcript,
    interimText,   // ← live word-by-word preview
    startListening,
    stopListening,
    resetTranscript,
    recognitionSupported,
    speechError,
    voices,        // ← full voice list for settings UI
    analyserNode: dummyAnalyserRef, // ← dummy ref for waveform fallback
  };
};
