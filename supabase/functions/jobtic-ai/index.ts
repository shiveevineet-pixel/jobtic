import { createClient } from 'npm:@supabase/supabase-js@2.78.0';

const allowedOrigins = new Set(['https://localhost', 'capacitor://localhost', 'https://jobtic.app']);
const cors = { 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const models: Record<string, string[]> = {
  gemini: ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
  groq: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
  nvidia: ['meta/llama-3.2-90b-vision-instruct']
};

Deno.serve(async req => {
  const origin = req.headers.get('Origin');
  const headers = { ...cors, ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
  const reply = (status: number, error: string) => Response.json({ error }, { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply(403, 'Origin not allowed');
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, 'Method not allowed');
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, 'Sign in to use AI features.');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return reply(401, 'Please sign in again.');
  try {
    // Bound the actual streamed body, not an untrusted Content-Length header.
    const reader = req.body?.getReader();
    if (!reader) return reply(400, 'Missing request');
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4_000_000) { await reader.cancel(); return reply(413, 'Resume or request is too large.'); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const { provider, model, body } = JSON.parse(new TextDecoder().decode(bytes));
    if (!models[provider]?.includes(model) || !body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'Unsupported AI request');
    const { data: permitted, error: quotaError } = await admin.rpc('jobtic_claim_ai_request', { owner: user.id });
    if (quotaError) return reply(503, 'AI quota check unavailable.');
    if (!permitted) return reply(429, 'AI request limit reached. Please try later.');
    const { data: stored, error: keyError } = await admin.rpc('jobtic_provider_keys', { provider });
    if (keyError || !stored) return reply(503, 'AI provider is not configured.');
    const keys = JSON.parse(stored) as string[];
    for (const key of keys) {
      const upstreamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      let url: string;
      let payload: Record<string, unknown>;
      if (provider === 'gemini') {
        upstreamHeaders['x-goog-api-key'] = key;
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        payload = { contents: body.contents, system_instruction: body.system_instruction, generationConfig: { ...body.generationConfig, maxOutputTokens: Math.min(6500, Math.max(1, Number(body.generationConfig?.maxOutputTokens) || 6500)) } };
      } else {
        upstreamHeaders.Authorization = `Bearer ${key}`;
        url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://integrate.api.nvidia.com/v1/chat/completions';
        payload = { model, messages: body.messages, temperature: Math.min(1, Math.max(0, Number(body.temperature) || 0.3)), response_format: body.response_format,
          ...(provider === 'groq' ? { reasoning_effort: 'low', max_completion_tokens: 6500 } : { max_tokens: 2048 }) };
      }
      const upstream = await fetch(url, { method: 'POST', headers: upstreamHeaders, body: JSON.stringify(payload), signal: AbortSignal.timeout(45_000) });
      if (upstream.ok) return new Response(await upstream.text(), { headers: { ...headers, 'Content-Type': 'application/json' } });
      // Never return upstream error text: it can include credentials or submitted personal data.
    }
    return reply(502, 'AI provider could not complete the request. Please retry.');
  } catch {
    return reply(502, 'AI request failed. Please retry.');
  }
});
