// Manual live validation with fictional public fixtures; no personal content.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => /^VITE_/.test(line)).map(line => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const bundle = await build({ stdin: { contents: 'export {geminiService} from "./src/services/geminiService.ts"; export {resumeService} from "./src/services/resumeService.ts";', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', define: { 'import.meta.env': JSON.stringify(env), 'import.meta.url': '"file:///synthetic-test.js"' }, plugins: [{ name: 'fixtures', setup(builder) {
  builder.onResolve({ filter: /supabaseClient|^@capacitor\/core$|^pdfjs-dist$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('supabaseClient')
    ? 'export const supabase = {auth:{getSession:async()=>({data:{session:{user:{id:"synthetic-test"}}},error:null})}};'
    : args.path === 'pdfjs-dist' ? 'export const GlobalWorkerOptions = {};'
    : 'export const Capacitor = {isNativePlatform:()=>false}; export const CapacitorHttp = {};' }));
} }] });
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, Response, DOMException, AbortController, URL, fetch, setTimeout, clearTimeout, window: { setTimeout, clearTimeout }, console: { warn() {}, log() {}, error() {} } });
const { geminiService: service } = module.exports;
await Promise.all([
  (async () => { const questions = await service.generateQuestions('Frontend Developer', 'junior', 'technical', '', 2); assert.equal(questions.length, 2); assert.ok(questions.every(question => question.text)); console.log('Interview question generation: PASS'); })(),
  (async () => { const result = await service.evaluateResponse('How do you prevent SQL injection?', 'I use parameterized queries rather than concatenating user input into SQL statements. I validate input types and use least privilege database accounts to limit damage.'); assert.ok(Number.isFinite(result.score)); assert.ok(result.feedback); console.log('Interview answer evaluation: PASS'); })(),
  (async () => { const result = await service.analyzeResume('Fictional Candidate\nFrontend Developer\nSkills: React, TypeScript, HTML, CSS.\nExperience: Built an accessible task-tracking interface for a university project, wrote component tests and documented keyboard navigation.\nEducation: Bachelor of Computer Science, 2024.\nProjects: A weather dashboard using public API data and responsive layouts.', 'Frontend Developer'); assert.ok(Number.isFinite(result.overallScore)); assert.ok(result.summary); console.log('Resume rating: PASS'); })(),
  (async () => { const result = await service.generateChatResponse('Frontend Developer', 'junior', 'technical', '', []); assert.ok(result.trim()); console.log('Conversational interview: PASS'); })(),
  (async () => { const result = await module.exports.resumeService.enhanceResume('Fictional Candidate\nFrontend Developer\nEmail: fictional@example.com\nSkills: React, TypeScript, HTML, CSS.\nExperience: Built an accessible task-tracking interface for a university project, wrote component tests and documented keyboard navigation.\nEducation: Bachelor of Computer Science, Fictional University, 2024.\nProjects: A weather dashboard using public API data and responsive layouts. Created reusable components and documented setup instructions. Worked with classmates to review pull requests and fix layout bugs.', 'Frontend Developer', ['Clarify project descriptions']); assert.ok(result.data.personalInfo.name); assert.ok(result.data.personalInfo.email); console.log('Resume enhancement: PASS'); })()
]);
