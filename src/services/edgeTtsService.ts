/**
 * Cross-platform text-to-speech.
 *
 * Desktop browsers can expose Microsoft Edge voices through Web Speech. Android
 * WebViews cannot access those browser voices, so the native Android TTS engine
 * is used there instead. The selected native voice is stored as `native:<index>`.
 */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface NativeVoice {
  id: string;
  name: string;
  lang: string;
}

const NATIVE_VOICE_PREFIX = 'native:';

const nativeVoiceIndex = (voiceId?: string) => {
  if (!voiceId?.startsWith(NATIVE_VOICE_PREFIX)) return undefined;
  const index = Number(voiceId.slice(NATIVE_VOICE_PREFIX.length));
  return Number.isInteger(index) && index >= 0 ? index : undefined;
};

export const nativeTts = {
  isAvailable: () => Capacitor.isNativePlatform(),

  async getVoices(): Promise<NativeVoice[]> {
    if (!Capacitor.isNativePlatform()) return [];
    const { voices } = await TextToSpeech.getSupportedVoices();
    return voices.map((voice, index) => ({
      id: `${NATIVE_VOICE_PREFIX}${index}`,
      // Android's plugin reports a generic display language in `name`; voiceURI
      // preserves the real engine/voice identifier and distinguishes choices.
      name: voice.voiceURI || voice.name || `Voice ${index + 1}`,
      lang: voice.lang || 'en-US'
    }));
  }
};

class TtsManager {
  private isStopped = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  public async stop(): Promise<void> {
    this.isStopped = true;
    const hadBrowserUtterance = this.activeUtterance !== null;
    this.activeUtterance = null;
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.stop();
      } catch {
        // The native engine can be unavailable while it is still initialising.
      }
    }
    if (hadBrowserUtterance || !Capacitor.isNativePlatform()) window.speechSynthesis?.cancel();
  }

  public async speak(
    text: string,
    voiceName = '',
    rate = 1,
    pitch = 1,
    onDone?: () => void
  ): Promise<void> {
    this.isStopped = false;
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) {
      onDone?.();
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await this.speakNatively(cleanText, voiceName, rate, pitch);
        if (!this.isStopped) onDone?.();
        return;
      } catch (error) {
        // Android's Web Speech fallback is not guaranteed, but it is useful on
        // devices where the native engine is disabled or still being installed.
        console.warn('Native Android TTS failed; trying Web Speech fallback.', error);
      }
    }

    await this.speakInBrowser(cleanText, voiceName, rate, pitch, onDone);
  }

  private async speakNatively(text: string, voiceName: string, rate: number, pitch: number) {
    const selectedVoice = nativeVoiceIndex(voiceName);
    const voices = await nativeTts.getVoices();
    const selected = selectedVoice === undefined ? undefined : voices[selectedVoice];
    const options = {
      text,
      lang: selected?.lang || 'en-US',
      rate: Math.max(0.5, Math.min(rate, 2)),
      pitch: Math.max(0.5, Math.min(pitch, 2)),
      volume: 1,
      ...(selectedVoice === undefined ? {} : { voice: selectedVoice })
    };

    try {
      await TextToSpeech.speak(options);
    } catch (firstError) {
      // Android TTS commonly needs a moment after the WebView has loaded.
      await new Promise(resolve => window.setTimeout(resolve, 500));
      await TextToSpeech.speak(options).catch(() => { throw firstError; });
    }
  }

  private speakInBrowser(text: string, voiceName: string, rate: number, pitch: number, onDone?: () => void): Promise<void> {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      return Promise.reject(new Error('No text-to-speech engine is available on this device.'));
    }

    return new Promise(resolve => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn('Speech resume error:', err);
      }

      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;
      // Prevent Chromium V8 from garbage collecting active utterance mid-playback
      (window as unknown as { __activeUtterance?: SpeechSynthesisUtterance }).__activeUtterance = utterance;

      utterance.rate = Math.max(0.5, Math.min(rate, 2));
      utterance.pitch = Math.max(0.5, Math.min(pitch, 2));

      // Resolve voice robustly: prefer matching name, then any English voice, then system default
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice: SpeechSynthesisVoice | undefined;
      if (voiceName && voiceName !== 'en-US-Standard') {
        selectedVoice = voices.find(v => v.name === voiceName || v.voiceURI === voiceName);
      }
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en') && v.default) ||
                        voices.find(v => v.lang.toLowerCase().startsWith('en')) ||
                        voices.find(v => v.default) ||
                        voices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || 'en-US';
      } else {
        utterance.lang = 'en-US';
      }

      let completed = false;
      const done = () => {
        if (completed) return;
        completed = true;
        this.activeUtterance = null;
        (window as unknown as { __activeUtterance?: unknown }).__activeUtterance = null;
        if (!this.isStopped) onDone?.();
        resolve();
      };

      utterance.onend = done;
      utterance.onerror = (event) => {
        console.warn('Speech utterance error:', event);
        done();
      };

      try {
        window.speechSynthesis.speak(utterance);
        // Wake up Chromium engine if queued in paused state
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (speakError) {
        console.warn('speechSynthesis.speak failed:', speakError);
        done();
      }
    });
  }
}

export const edgeTts = new TtsManager();
