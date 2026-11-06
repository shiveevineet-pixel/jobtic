/**
 * Voice Transcription Service using Groq Whisper.
 * Provides instant (<400ms) high-accuracy speech-to-text fallback
 * across all browsers, including those with broken or blocked Web Speech API.
 */

const GROQ_KEYS = [
  ...new Set(
    String(
      (typeof import.meta !== 'undefined' &&
        (import.meta.env?.VITE_GROQ_API_KEYS || import.meta.env?.VITE_GROQ_API_KEY)) ||
        ''
    )
      .split(',')
      .map(k => k.trim().replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
  ),
];

let keyCursor = 0;

export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  if (blob.size < 1200) {
    return '';
  }

  const keys = GROQ_KEYS.length
    ? GROQ_KEYS
    : ['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'];

  const ext = blob.type.includes('mp4')
    ? 'mp4'
    : blob.type.includes('ogg')
      ? 'ogg'
      : blob.type.includes('wav')
        ? 'wav'
        : 'webm';

  const formData = new FormData();
  formData.append('file', blob, `recording.${ext}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');

  const startIndex = keyCursor++ % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(startIndex + attempt) % keys.length];
    try {
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          continue; // Try next available Groq key
        }
        break;
      }

      const result = (await response.json()) as { text?: string };
      return (result.text || '').trim();
    } catch (networkErr) {
      console.warn('Groq Whisper direct connection attempt failed:', networkErr);
    }
  }

  return '';
}

