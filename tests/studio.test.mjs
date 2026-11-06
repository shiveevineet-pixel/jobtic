import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const memory = new Map();
const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
async function load(path) {
  const result = await build({ entryPoints: [path], write: false, bundle: true, platform: 'node', format: 'cjs', packages: 'external', define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, localStorage, console, Buffer, TextEncoder, TextDecoder });
  return module.exports;
}
test('Career Studio regressions', async (suite) => {
const metrics = await load('src/services/studioMetrics.ts');
const { storageService } = await load('src/services/storageService.ts');
const { createInterviewPdf } = await load('src/services/reportPdf.ts');
const question = (score, response = 'An evaluated response') => ({ questionId: 'q', questionText: 'Tell me about your approach.', userResponse: response, score, technicalScore: 0, communicationScore: 60, structureScore: 80, strengths: 'Clear example', weaknesses: 'Add evidence', feedback: 'Try a specific outcome', modelAnswer: 'Describe context, action, and result.' });
const session = (score, questions = [question(score)]) => ({ id: 'session_test', roleId: 'test', roleTitle: 'Test practice', difficulty: 'mid', type: 'technical', date: 'Test date', overallScore: score, questions });

await suite.test('new users have no invented average or latest score', () => {
  const result = metrics.getPracticeProgress([]);
  assert.equal(result.completed, 0); assert.equal(result.average, null); assert.equal(result.latest, null);
});
await suite.test('progress uses stored session data including valid zero scores', () => {
  const result = metrics.getPracticeProgress([session(0), session(80)]);
  assert.equal(result.average, 40); assert.equal(result.latest, 0);
});
await suite.test('a real zero category score is not replaced by the overall score', () => {
  const result = metrics.getQuestionMetrics([question(90)]);
  assert.equal(result.technical, 0); assert.equal(result.communication, 60);
});
await suite.test('partial feedback contains only evaluated answers and does not mutate the scaffold', () => {
  const questions = [question(80), question(0, '')];
  const result = metrics.summarizeEvaluatedQuestions(questions);
  assert.equal(result.questions.length, 1); assert.equal(result.overallScore, 80); assert.equal(questions.length, 2);
  assert.equal(metrics.summarizeEvaluatedQuestions([question(0, ' ')]), null);
});
await suite.test('account preferences and history never inherit unowned legacy data', () => {
  memory.clear();
  assert.equal(storageService.getSettings().theme, 'light');
  localStorage.setItem('ai_interviewer_settings_v2', JSON.stringify({ theme: 'dark', userName: 'Existing name', voiceRate: 1.2 }));
  storageService.saveSession(session(72));
  storageService.saveSettings({ voicePitch: 1.1 });
  assert.equal(storageService.getSettings().theme, 'light');
  assert.equal(storageService.getSettings().voiceRate, 1);
  assert.equal(storageService.getSettings().userName, 'Job Seeker');
  assert.equal(storageService.getSessions()[0].overallScore, 72);
  assert.equal(JSON.parse(localStorage.getItem('ai_interviewer_settings_v2')).userName, 'Existing name');
  assert.deepEqual([...storageService.getSessions('user:Y')], []);
  storageService.saveSettings({ theme: 'dark' }, 'user:X');
  assert.equal(storageService.getSettings('user:Y').theme, 'light');
});
await suite.test('report PDF paginates long feedback and exports the complete response', () => {
  const q = question(80);
  q.userResponse = ('A detailed response with an example and an outcome. ').repeat(450) + '\nTAIL_SENTINEL';
  const doc = createInterviewPdf(session(80, [q]));
  assert.ok(doc.getNumberOfPages() > 3);
  assert.ok(doc.output().includes('TAIL_SENTINEL'));
});
await suite.test('light and dark theme colors remain monochrome', async () => {
  const css = await readFile('src/index.css', 'utf8');
  const theme = css.slice(0, css.indexOf('* {'));
  const colors = [...theme.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)];
  assert.ok(colors.length > 30);
  for (const [, color] of colors) {
    assert.equal(color.slice(0, 2), color.slice(2, 4), color);
    assert.equal(color.slice(2, 4), color.slice(4, 6), color);
  }
});
await suite.test('companion blink has a three-second cycle and motion has an opt-out', async () => {
  const css = await readFile('src/App.css', 'utf8');
  const companion = await readFile('src/components/AIAvatar3D.tsx', 'utf8');
  const foundations = await readFile('src/index.css', 'utf8');
  assert.match(css, /animation: companion-blink 3s ease-in-out infinite/);
  assert.match(css, /@keyframes companion-blink/);
  assert.match(companion, /new THREE\.WebGLRenderer/);
  assert.match(companion, /time % 3/);
  assert.match(companion, /prefers-reduced-motion: reduce/);
  assert.match(foundations, /prefers-reduced-motion: reduce/);
});
});
