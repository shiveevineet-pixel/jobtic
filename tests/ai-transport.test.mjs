import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

let session = { user: { id: 'X' } };
let native = false;
let calls = [];
let replies = [];
const request = async (url, options) => {
  calls.push({ url, ...options });
  return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: replies.shift() || 200 });
};
const bundle = await build({ entryPoints: ['src/services/aiProxy.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', define: {
  'import.meta.env': JSON.stringify({ VITE_GEMINI_API_KEYS: 'gemini-test', VITE_GROQ_API_KEYS: 'groq-one,groq-two', VITE_NVIDIA_API_KEY: 'nvidia-test' })
}, plugins: [{ name: 'mocks', setup(builder) {
  builder.onResolve({ filter: /supabaseClient|^@capacitor\/core$/ }, args => ({ path: args.path, namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path.includes('supabaseClient')
    ? 'export const supabase = globalThis.auth;'
    : 'export const Capacitor = globalThis.capacitor; export const CapacitorHttp = globalThis.http;' }));
} }] });
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, Response, DOMException, fetch: request,
  auth: { auth: { getSession: async () => ({ data: { session }, error: null }) } },
  capacitor: { isNativePlatform: () => native },
  http: { post: async options => { calls.push(options); return { status: 200, data: { native: true } }; } }
});
const { aiProxy } = module.exports;

test('direct AI requests use provider endpoints and headers, never the Supabase proxy', async () => {
  calls = [];
  const response = await aiProxy('gemini', 'gemini-3.5-flash', { contents: [] });
  assert.equal(response.ok, true);
  assert.match(calls[0].url, /^https:\/\/generativelanguage.googleapis.com/);
  assert.equal(calls[0].headers['x-goog-api-key'], 'gemini-test');
  replies = [429, 200]; calls = [];
  await aiProxy('groq', 'openai/gpt-oss-20b', { messages: [] });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].headers.Authorization, calls[1].headers.Authorization);
});
test('native AI requests use Capacitor HTTP with a bounded timeout and JSON response', async () => {
  native = true; calls = [];
  assert.deepEqual(await (await aiProxy('nvidia', 'vision', { messages: [] })).json(), { native: true });
  assert.equal(calls[0].readTimeout, 45_000);
  assert.match(calls[0].url, /integrate.api.nvidia.com/);
  native = false;
});
test('signed-out and cancelled requests cannot send an AI prompt', async () => {
  calls = []; session = null;
  await assert.rejects(aiProxy('groq', 'model', {}), /sign in/);
  session = { user: { id: 'Y' } };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(aiProxy('groq', 'model', {}, controller.signal), /cancelled/);
  assert.equal(calls.length, 0);
});
