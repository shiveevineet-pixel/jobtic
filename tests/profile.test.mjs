import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
const memory = new Map();
const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
let current = null, listener = null;
const refreshes = [];
let updateResolve;
const api = { auth: {
  getSession: async () => ({ data: { session: current }, error: null }),
  onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { listener = null; } } } }; },
  getUser(token) { return new Promise(resolve => refreshes.push({ token, resolve })); },
  updateUser() { return new Promise(resolve => { updateResolve = resolve; }); },
  async signOut() { current = null; listener?.('SIGNED_OUT', null); return { error: null }; },
  async signInWithIdToken() { listener?.('SIGNED_IN', current); return { data: { user: current.user, session: current }, error: null }; }
} };
const source = await build({
  stdin: { contents: "export * from './src/context/AuthContext'; export * from './src/context/SettingsContext'; export * from './src/services/accountProfile';", resolveDir: process.cwd(), sourcefile: 'profile-harness.ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'authenticated-fixture', setup(build) {
    build.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'auth-api', namespace: 'fixture' }));
    build.onResolve({ filter: /nativeGoogleAuth$/ }, () => ({ path: 'native', namespace: 'fixture' }));
    build.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'capacitor', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'auth-api'
      ? 'export const supabase = globalThis.authApi; export const isSupabaseConfigured = () => true;'
      : path === 'native' ? 'export const NativeGoogleAuth = {signIn:async()=>({idToken:"fixture",nonce:"fixture"}),signOut:async()=>{}};export const isNativeAndroid=()=>true;export const hasNativeGoogleAuth=()=>true;'
      : 'export const Capacitor = {isNativePlatform:()=>true};' }));
  } }]
});
const module = { exports: {} };
vm.runInNewContext(source.outputFiles[0].text, { module, exports: module.exports, require, localStorage, sessionStorage: localStorage, console, queueMicrotask, authApi: api, document: { documentElement: { classList: { add() {}, remove() {} } } } });
const { AuthProvider, useAuth, SettingsProvider, useSettings, getAccountProfile, createAccountGuard } = module.exports;
const user = (id, email, name, googleName) => ({ id, email, user_metadata: { full_name: name }, app_metadata: { provider: googleName === undefined ? 'email' : 'google' }, identities: googleName === undefined ? [] : [{ provider: 'google', user_id: id, identity_data: { email, name: googleName } }] });
const x = user('X', 'x@example.test', 'Preet');
const y = user('Y', 'y@example.test', 'Preet', 'Google Y');
const session = value => ({ user: value, access_token: `fixture-${value.id}` });

test('profile names are current-account only', () => {
  assert.equal(getAccountProfile(y, { name: 'Old guest', email: 'guest' }).name, 'Google Y');
  assert.equal(getAccountProfile({ ...y, app_metadata: { provider: 'email', providers: ['email', 'google'] } }).name, 'Google Y');
  const missing = { ...y, identities: [] };
  assert.equal(getAccountProfile(missing).name, 'y');
  assert.equal(getAccountProfile({ ...y, identities: [{ provider: 'google', user_id: 'X', identity_data: { name: 'Wrong owner' } }] }).name, 'y');
  assert.equal(getAccountProfile({ ...y, user_metadata: { jobtic_display_name: 'X custom', jobtic_display_name_owner: 'X' } }).name, 'Google Y');
  assert.equal(getAccountProfile({ ...y, user_metadata: { jobtic_display_name: 'Y custom', jobtic_display_name_owner: 'Y' } }).name, 'Y custom');
  assert.equal(getAccountProfile(null, { name: 'Guest', email: 'guest' }).name, 'Guest');
  assert.equal(getAccountProfile(null).name, 'Job Seeker');
});

test('account guard rejects late X response even after X→Y→X', () => {
  const guard = createAccountGuard(); guard.setOwner('X'); const before = guard.capture();
  assert.equal(guard.accepts(before, 'X'), true);
  guard.setOwner('Y'); assert.equal(guard.accepts(before, 'X'), false);
  guard.setOwner('X'); assert.equal(guard.accepts(before, 'X'), false);
});

test('React auth/profile switching rejects stale responses and keeps all names synchronized', async suite => {
  let auth, settings, root;
  function Probe() { auth = useAuth(); settings = useSettings().settings; return React.createElement('span', null, settings.userName); }
  await act(async () => { root = Renderer.create(React.createElement(AuthProvider, null, React.createElement(SettingsProvider, null, React.createElement(Probe)))); });
  await suite.test('switch from named email X to Google Y without reusing preferences', async () => {
    await act(async () => { current = session(x); listener('SIGNED_IN', current); });
    assert.equal(settings.userName, 'Preet');
    await act(async () => { current = session(y); listener('SIGNED_IN', current); });
    assert.equal(auth.user.id, 'Y'); assert.equal(settings.userName, 'Google Y');
  });
  await suite.test('late profile refresh for X cannot replace Y', async () => {
    const old = refreshes.find(request => request.token === 'fixture-X');
    await act(async () => { old.resolve({ data: { user: x }, error: null }); });
    assert.equal(auth.user.id, 'Y'); assert.equal(settings.userName, 'Google Y');
  });
  await suite.test('late USER_UPDATED event for X cannot revert current account', async () => {
    await act(async () => { listener('USER_UPDATED', session(x)); });
    assert.equal(auth.user.id, 'Y'); assert.equal(auth.session.user.id, 'Y');
  });
  await suite.test('fresh Google identity response updates the same account immediately', async () => {
    const fresh = user('Y', 'y@example.test', 'Preet', 'Fresh Google Y');
    const pending = refreshes.find(request => request.token === 'fixture-Y');
    await act(async () => { pending.resolve({ data: { user: fresh }, error: null }); });
    assert.equal(settings.userName, 'Fresh Google Y'); assert.equal(auth.session.user.id, 'Y');
  });
  await suite.test('older same-account refresh cannot undo a saved custom name', async () => {
    await act(async () => { current = session(y); listener('SIGNED_IN', current); });
    const stale = refreshes.at(-1);
    const chosen = { ...y, user_metadata: { jobtic_display_name: 'Y chosen', jobtic_display_name_owner: 'Y' } };
    await act(async () => { current = session(chosen); listener('USER_UPDATED', current); });
    await act(async () => { stale.resolve({ data: { user: y }, error: null }); });
    assert.equal(settings.userName, 'Y chosen');
  });
  await suite.test('overlapping logout is rejected while profile save is active', async () => {
    let pending;
    await act(async () => { pending = auth.updateProfileName('Y chosen'); });
    await assert.rejects(auth.signOut(), /Another account operation/);
    const chosen = { ...y, user_metadata: { jobtic_display_name: 'Y chosen', jobtic_display_name_owner: 'Y' } };
    await act(async () => { updateResolve({ data: { user: chosen }, error: null }); await pending; });
    assert.equal(auth.user.id, 'Y'); assert.equal(settings.userName, 'Y chosen');
  });
  await suite.test('profile-save response from another account is rejected', async () => {
    let pending;
    await act(async () => { pending = auth.updateProfileName('Y chosen'); });
    const rejected = assert.rejects(pending, /Account changed/);
    await act(async () => { current = session(x); listener('SIGNED_IN', current); updateResolve({ data: { user: y }, error: null }); await rejected; });
    assert.equal(auth.user.id, 'X'); assert.equal(settings.userName, 'Preet');
  });
  await suite.test('logout clears name/session, then guest cannot inherit X', async () => {
    await act(async () => { await auth.signOut(); });
    assert.equal(auth.user, null); assert.equal(auth.session, null); assert.equal(settings.userName, 'Job Seeker');
    await act(async () => { auth.signInMock('guest@example.test', 'Guest'); });
    assert.equal(settings.userName, 'Guest'); assert.equal(getAccountProfile(auth.user, auth.mockUser).email, '');
  });
  await act(async () => { root.unmount(); });
});
