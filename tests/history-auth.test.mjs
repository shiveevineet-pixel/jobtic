import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let session = { user: { id: 'X' }, access_token: 'fixture-token-X' };
const clients = [];
const factory = (_url, _key, options) => {
  if (!options) return { auth: { getSession: async () => ({ data: { session }, error: null }) } };
  const client = { options }; clients.push(client); return client;
};
const source = await build({ entryPoints: ['src/services/supabaseClient.ts'], write: false, bundle: true, format: 'cjs', platform: 'node', packages: 'external', define: { 'import.meta.env': '{}' }, plugins: [{ name: 'client-fixture', setup(build) {
  build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'sdk', namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createClient = globalThis.clientFactory;' }));
} }] });
const module = { exports: {} };
vm.runInNewContext(source.outputFiles[0].text, { module, exports: module.exports, require, clientFactory: factory });
const { getHistoryClient } = module.exports;

test('history requests keep X authorization even after the shared session changes to Y', async () => {
  const x = await getHistoryClient('X');
  session = { user: { id: 'Y' }, access_token: 'fixture-token-Y' };
  assert.equal(x.options.global.headers.Authorization, 'Bearer fixture-token-X');
  assert.equal(x.options.auth.persistSession, false); assert.equal(x.options.auth.autoRefreshToken, false);
  await assert.rejects(getHistoryClient('X'), /account changed/);
  const y = await getHistoryClient('Y');
  assert.equal(y.options.global.headers.Authorization, 'Bearer fixture-token-Y');
  assert.notEqual(x.options.auth.storageKey, y.options.auth.storageKey);
});
test('signed-out history operations reject rather than acknowledge an empty RLS response', async () => {
  session = null; const count = clients.length;
  await assert.rejects(getHistoryClient('X'), /account changed/);
  assert.equal(clients.length, count);
});
