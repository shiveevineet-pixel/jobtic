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
import { transcribeAudioBlob } from '../services/transcriptionService';

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
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  // ─── Audio capture & recording refs ──────────────────────────────────────
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

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

    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const hasSpeech = !!(windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition);

    if (hasMedia || hasSpeech) {
      setRecognitionSupported(true);
    }

    return () => {
      shouldListenRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {}
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
      }
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
    stopSpeaking();
    setSpeechError(null);
    shouldListenRef.current = true;
    processedResultsRef.current = 0;
    audioChunksRef.current = [];

    // 1. Acquire mic permission and active MediaStream
    let stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
        } catch (permErr) {
          console.warn('Microphone permission not granted:', permErr);
          setSpeechError('not-allowed');
          setIsListening(false);
          shouldListenRef.current = false;
          return;
        }
      }
    }

    // 2. Connect AudioContext & AnalyserNode for real waveform feedback
    if (stream && typeof window !== 'undefined') {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new AudioCtx();
          }
          if (audioContextRef.current.state === 'suspended') {
            void audioContextRef.current.resume();
          }
          const source = audioContextRef.current.createMediaStreamSource(stream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext setup skipped:', audioCtxErr);
      }
    }

    // 3. Start MediaRecorder as reliable universal audio capture
    if (stream && typeof MediaRecorder !== 'undefined') {
      try {
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else mimeType = '';
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn('MediaRecorder init failed:', recErr);
      }
    }

    setIsListening(true);

    // 4. Start Web Speech Recognition if available (provides live interim results)
    const windowWithSpeech = typeof window !== 'undefined'
      ? (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        })
      : {};

    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        try {
          recognitionRef.current?.abort();
        } catch {}

        const rec = new SpeechRecognition();
        rec.continuous = !isAndroidWebView;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
          consecutiveErrorsRef.current = 0;
          processedResultsRef.current = 0;
        };

        rec.onresult = (event: SpeechRecognitionEventLike) => {
          consecutiveErrorsRef.current = 0;
          let finalChunk = '';
          let interimChunk = '';

          const startIdx = isAndroidWebView ? processedResultsRef.current : event.resultIndex;
          for (let i = startIdx; i < event.results.length; ++i) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalChunk += text + ' ';
              processedResultsRef.current = i + 1;
            } else {
              interimChunk += text;
            }
          }

          if (finalChunk) {
            setTranscript(prev => (prev ? prev + ' ' + finalChunk.trim() : finalChunk.trim()));
            setInterimText('');
          } else if (interimChunk) {
            setInterimText(interimChunk);
          }
        };

        rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
          if (event.error === 'no-speech') {
            return;
          }
          if (event.error === 'network' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
            console.log(`Speech recognition engine reported ${event.error}; Whisper backup active.`);
            return;
          }
          if (event.error === 'not-allowed') {
            setSpeechError('not-allowed');
            setIsListening(false);
            shouldListenRef.current = false;
          }
        };

        rec.onend = () => {
          if (shouldListenRef.current && !isAndroidWebView) {
            try {
              rec.start();
            } catch {
              // Ignore restart error
            }
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (speechErr) {
        console.warn('SpeechRecognition start failed, relying on MediaRecorder:', speechErr);
      }
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimText('');

    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    try {
      recognitionRef.current?.stop();
    } catch {}

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (chunks.length === 0) return;

        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mime });

        // If audio blob contains data (>2KB), transcribe with Whisper
        if (audioBlob.size > 2000) {
          try {
            setIsTranscribing(true);
            const whisperText = await transcribeAudioBlob(audioBlob);
            if (whisperText && whisperText.trim()) {
              setTranscript(prev => {
                if (prev && prev.trim().toLowerCase().includes(whisperText.trim().toLowerCase())) {
                  return prev;
                }
                return prev ? `${prev.trim()} ${whisperText.trim()}` : whisperText.trim();
              });
            }
          } catch (err) {
            console.warn('Whisper transcription failed:', err);
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      try {
        recorder.stop();
      } catch {}
    }
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
    isTranscribing,
    transcript,
    interimText,   // ← live word-by-word preview
    startListening,
    stopListening,
    resetTranscript,
    recognitionSupported,
    speechError,
    voices,        // ← full voice list for settings UI
    analyserNode: analyserRef, // ← real mic analyser for waveform
  };
};
