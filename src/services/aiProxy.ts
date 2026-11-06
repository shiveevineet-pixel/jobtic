import { supabase } from './supabaseClient';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Explicitly requested private testing mode. These provider keys are extractable
// from the APK; this is not a suitable public-production credential strategy.
const providerKeys = {
  gemini: import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEYS || import.meta.env.VITE_GROQ_API_KEY || '',
  nvidia: import.meta.env.VITE_NVIDIA_API_KEY || ''
};
const cursors = { gemini: 0, groq: 0, nvidia: 0 };

async function send(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  if (!Capacitor.isNativePlatform()) return fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  // Native HTTP avoids WebView CORS limitations. Cancellation discards the
  // result; Capacitor's bounded native request can finish in the background.
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Request cancelled', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    CapacitorHttp.post({ url, headers, data: body, connectTimeout: 15_000, readTimeout: 45_000, responseType: 'json' })
      .then(result => resolve(new Response(typeof result.data === 'string' ? result.data : JSON.stringify(result.data), {
        status: result.status, headers: { 'Content-Type': 'application/json' }
      })))
      .catch(() => reject(new Error('AI connection failed. Check your internet connection and retry.')))
      .finally(() => signal?.removeEventListener('abort', abort));
  });
}

export async function aiProxy(provider: 'gemini' | 'groq' | 'nvidia', model: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const { data: { session }, error } = await supabase.auth.getSession();
  const hasGuestAccess = typeof localStorage !== 'undefined' && !!localStorage.getItem('jobtic_mock_user');
  if (error || (!session && !hasGuestAccess)) throw new Error('Please sign in to use AI practice and resume features.');
  const keys = [...new Set<string>(
    String(providerKeys[provider])
      .split(',')
      .map(key => key.trim().replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
  )];
  if (!keys.length) throw new Error(`${provider.toUpperCase()} is not configured in this test build.`);
  const start = cursors[provider]++ % keys.length;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(start + attempt) % keys.length];
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let url: string;
    if (provider === 'gemini') {
      headers['x-goog-api-key'] = key;
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    } else {
      headers.Authorization = `Bearer ${key}`;
      url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://integrate.api.nvidia.com/v1/chat/completions';
    }
    const response = await send(url, headers, body, signal);
    if (response.ok) return response;
    // Do not expose upstream error bodies (they can include secrets or prompts).
    if (![401, 403, 429].includes(response.status) && response.status < 500) {
      throw new Error(`AI provider rejected this request (${response.status}). Please retry or choose another model.`);
    }
  }
  throw new Error('AI provider keys are unavailable or rate-limited. Please try again shortly.');
}
