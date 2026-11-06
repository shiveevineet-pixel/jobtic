// Explicit manual smoke test: submits synthetic fixtures only, never a user's resume.
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => /^VITE_/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const fixtures = [
  ['gemini', 'gemini-3.5-flash', { contents: [{ role: 'user', parts: [{ text: 'Return JSON only: {"ready":true}' }] }], generationConfig: { responseMimeType: 'application/json' } }],
  ['groq', 'openai/gpt-oss-20b', { model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'Return JSON only: {"ready":true}' }], reasoning_effort: 'low', response_format: { type: 'json_object' }, max_completion_tokens: 512 }],
  ['nvidia', 'meta/llama-3.2-90b-vision-instruct', { model: 'meta/llama-3.2-90b-vision-instruct', messages: [{ role: 'user', content: 'Return JSON only: {"ready":true}' }], max_tokens: 128 }]
];
let failures = 0;
await Promise.all(fixtures.map(async ([provider, model, body]) => {
  const keys = (env[`VITE_${provider.toUpperCase()}_API_KEYS`] || env[`VITE_${provider.toUpperCase()}_API_KEY`] || '').split(',').map(key => key.trim()).filter(Boolean);
  let success = false;
  for (const key of keys) {
    const headers = { 'Content-Type': 'application/json' };
    const url = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` : provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://integrate.api.nvidia.com/v1/chat/completions';
    if (provider === 'gemini') headers['x-goog-api-key'] = key; else headers.Authorization = `Bearer ${key}`;
    try {
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
      const data = await response.json();
      const text = provider === 'gemini' ? data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') : data.choices?.[0]?.message?.content;
      if (response.ok && text?.trim()) { console.log(`${provider}: live response PASS`); success = true; break; }
      console.log(`${provider}: HTTP ${response.status}; trying next configured key`);
    } catch { console.log(`${provider}: request could not complete`); }
  }
  if (!success) { console.log(`${provider}: live response FAILED`); failures++; }
}));
process.exitCode = failures ? 1 : 0;
