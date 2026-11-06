import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const memory = new Map();
const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const result = await build({ entryPoints: ['src/services/historyRepository.ts'], write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external', define: { 'import.meta.env': '{}' } });
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, localStorage, console });
const { createHistoryRepository } = module.exports;
const session = id => ({ id, questions: [], roleTitle: 'Regression fixture', overallScore: 70 });
const remote = new Map();
let offline = false;
const transport = {
  async list(owner) { if (offline) throw new Error('offline'); return [...(remote.get(owner) || new Map()).values()]; },
  async upsert(owner, value) { if (offline) throw new Error('offline'); if (!remote.has(owner)) remote.set(owner, new Map()); remote.get(owner).set(value.id, value); },
  async remove(owner, id) { if (offline) throw new Error('offline'); if (id) remote.get(owner)?.delete(id); else remote.set(owner, new Map()); }
};

test('account/cloud isolation and durable offline changes', async suite => {
  memory.clear(); remote.clear();
  const x = createHistoryRepository('X', transport), y = createHistoryRepository('Y', transport), guest = createHistoryRepository(null, transport);
  await suite.test('X records do not appear for Y or a guest', async () => {
    x.save(session('x')); await x.sync();
    assert.equal(x.list().length, 1); assert.equal(y.list().length, 0); assert.equal(guest.list().length, 0);
    await y.sync(); assert.equal(y.list().length, 0);
  });
  await suite.test('a fresh installation can restore only its authenticated owner history', async () => {
    memory.delete('ai_interviewer_sessions:user:X');
    const fresh = createHistoryRepository('X', transport);
    await fresh.sync(); assert.equal(fresh.list()[0].id, 'x');
  });
  await suite.test('offline saves survive provider destruction and retry', async () => {
    offline = true; x.save(session('offline')); await assert.rejects(x.sync());
    const reopened = createHistoryRepository('X', transport);
    assert.equal(reopened.pending(), true); assert.equal(reopened.list().length, 2);
    offline = false; await reopened.sync(); assert.equal(reopened.pending(), false); assert.equal(remote.get('X').size, 2);
  });
  await suite.test('offline deletion cannot resurrect a cloud record', async () => {
    offline = true; x.remove('x'); await assert.rejects(x.sync());
    offline = false; await x.sync(); assert.equal(x.list().some(value => value.id === 'x'), false);
  });
  await suite.test('clear plus a new save only clears X, preserving new work and Y', async () => {
    y.save(session('y')); await y.sync();
    offline = true; x.clear(); x.save(session('new')); await assert.rejects(x.sync());
    offline = false; await x.sync();
    assert.equal(x.list().length, 1); assert.equal(x.list()[0].id, 'new'); assert.equal(remote.get('Y').size, 1);
  });
  await suite.test('guest records are never uploaded or auto-assigned to an account', async () => {
    guest.save(session('guest')); await guest.sync();
    assert.equal(remote.has(null), false); assert.equal(x.list().some(value => value.id === 'guest'), false);
  });
  await suite.test('logout during an in-flight save never reassigns ownership to Y', async () => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const owners = [];
    const delayed = createHistoryRepository('X', { ...transport, async upsert(owner, value) { await gate; owners.push(owner); await transport.upsert(owner, value); } });
    delayed.save(session('delayed')); const pending = delayed.sync();
    const nextAccount = createHistoryRepository('Y', transport); await nextAccount.sync(); release(); await pending;
    assert.deepEqual(owners, ['X']); assert.equal(nextAccount.list().some(value => value.id === 'delayed'), false);
  });
  await suite.test('legacy unowned records remain untouched and hidden', async () => {
    memory.set('ai_interviewer_sessions', JSON.stringify([session('legacy')]));
    await x.sync(); assert.equal(x.list().some(value => value.id === 'legacy'), false);
    assert.equal(JSON.parse(memory.get('ai_interviewer_sessions'))[0].id, 'legacy');
  });
  await suite.test('two instances for the same account serialize a pending clear', async () => {
    let release; const gate = new Promise(resolve => { release = resolve; }); let clears = 0;
    const slow = { ...transport, async remove(owner, id) { if (!id) { clears++; await gate; } await transport.remove(owner, id); } };
    const first = createHistoryRepository('X', slow), second = createHistoryRepository('X', slow);
    first.clear(); const a = first.sync(); const b = second.sync();
    assert.equal(a, b); second.save(session('during-clear')); release(); await a;
    assert.equal(clears, 1); assert.equal(remote.get('X').has('during-clear'), true);
  });
});

test('workspace remounts on identity change and ignores late interview responses', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  const context = await readFile('src/context/InterviewContext.tsx', 'utf8');
  assert.match(app, /SettingsProvider key=\{identity\}/);
  assert.match(context, /mounted.current = false; operationRef.current \+= 1/);
  assert.match(context, /if \(operation !== operationRef.current\) return/);
  const dashboard = await readFile('src/components/DashboardView.tsx', 'utf8');
  assert.match(dashboard, /jobtic_resume_context:\$\{user/);
  assert.doesNotMatch(dashboard, /getItem\('jobtic_resume_context'\)/);
});

test('provider credentials are centralized in the explicitly requested private-test transport', async () => {
  for (const file of ['apiKeyPool', 'storageService', 'geminiService', 'groqService', 'resumeService']) {
    const source = await readFile(`src/services/${file}.ts`, 'utf8');
    assert.doesNotMatch(source, /VITE_(?:GEMINI|GROQ|NVIDIA)_API_KEY/);
    assert.doesNotMatch(source, /Authorization: `Bearer \$\{apiKey\}`/);
  }
  const proxy = await readFile('src/services/aiProxy.ts', 'utf8');
  assert.match(proxy, /VITE_GEMINI_API_KEYS/);
  assert.match(proxy, /CapacitorHttp.post/);
  assert.doesNotMatch(proxy, /functions.invoke/);
});
