import React, { useState, useEffect } from 'react';
import { Check, Eye, EyeOff, ArrowRight, ShieldAlert, Smartphone, Download } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import AIAvatar3D from './AIAvatar3D';

export const AuthView: React.FC = () => {
  const { isConfigured, signIn, signUp, signInMock, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const hash = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hash);
      const desc = hashParams.get('error_description') || url.searchParams.get('error_description');
      const err = hashParams.get('error') || url.searchParams.get('error');
      if (desc || err) {
        setErrorMsg(decodeURIComponent((desc || err || '').replace(/\+/g, ' ')));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // ignore
    }
  }, []);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const result = isSignUp ? await signUp(email, password, name.trim()) : await signIn(email, password);
      if (result.error) {
        const msg = result.error.message || '';
        if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('enotfound')) {
          setErrorMsg('Cannot reach database server. Your Supabase project may be paused or inactive.');
        } else {
          setErrorMsg(msg || 'Could not sign in. Please try again.');
        }
      }
      else if (isSignUp) {
        setSuccessMsg('If registration is available for this email, check your inbox for confirmation. Otherwise, sign in to your existing account.');
        setPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('enotfound')) {
        setErrorMsg('Cannot reach database server. Your Supabase project may be paused or inactive.');
      } else {
        setErrorMsg('Could not connect. Please check your connection and try again.');
      }
    }
    finally { setLoading(false); }
  };
  const handleGoogleSignIn = async () => {
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('enotfound')) {
          setErrorMsg('Cannot reach database server. Your Supabase project may be paused or inactive.');
        } else {
          setErrorMsg(msg || 'Google sign-in could not be completed.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('enotfound')) {
        setErrorMsg('Cannot reach database server. Your Supabase project may be paused or inactive.');
      } else {
        setErrorMsg('Google sign-in could not be completed. Please try again.');
      }
    }
    finally { setLoading(false); }
  };
  return (
    <div className="auth-container">
      <section className="auth-intro"><div className="brand"><span className="brand-mark"><Check size={22} /></span><div className="brand-name">jobtic<span className="brand-product">Career studio</span></div></div><span className="eyebrow">A thoughtful space to prepare</span><h1>Your next chapter<br />starts with practice.</h1><p>Find clearer answers with AI interview practice, useful feedback, and a resume that tells your story.</p><div className="auth-art" aria-hidden="true"><AIAvatar3D status="idle" /></div></section>
      <section className="auth-card" aria-label="Account access">
        <h2>{isSignUp ? 'Make room for what’s next.' : 'Welcome to your studio.'}</h2><p>{isSignUp ? 'Create an account to get started.' : 'Sign in, or explore with a guest workspace.'}</p>
        {errorMsg && <div className="alert alert-danger" role="alert"><ShieldAlert size={18} /><span>{errorMsg}</span></div>}
        {successMsg && <div className="alert alert-success" role="status"><Check size={18} /><span>{successMsg}</span></div>}
        {!isConfigured && <div className="notice" role="status">Account sign-in is currently unavailable. You can still explore as a guest.</div>}
        {isConfigured && <>
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && <div className="form-group"><label htmlFor="auth-name">Full name</label><input id="auth-name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" disabled={loading} /></div>}
            <div className="form-group"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} /></div>
            <div className="form-group"><label htmlFor="auth-password">Password</label><div className="password-field"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={isSignUp ? 6 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignUp ? 'At least 6 characters' : 'Enter your password'} disabled={loading} /><button type="button" className="icon-btn" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Connecting…' : isSignUp ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="auth-divider">or</div>
          <button type="button" className="btn-secondary auth-google" disabled={loading} onClick={handleGoogleSignIn}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>{loading ? 'Signing in with Google…' : 'Continue with Google'}</button>
          {errorMsg && <div className="alert alert-danger" role="alert" style={{ marginTop: '12px' }}><ShieldAlert size={18} /><span>{errorMsg}</span></div>}
          <div className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Jobtic?'} <button className="text-button" type="button" disabled={loading} onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }}>{isSignUp ? 'Sign in' : 'Create an account'}</button></div>
        </>}
        <div className="auth-guest-section"><button type="button" className="btn-secondary auth-guest" disabled={loading} onClick={() => signInMock('guest@jobtic.com', 'Guest')}>Explore as guest <ArrowRight size={16} /></button><p>Guest data stays separate on this device. Sign in for AI features and cloud-saved interviews.</p></div>
        {!Capacitor.isNativePlatform() && (
          <div className="auth-android-promo" role="region" aria-label="Android app download">
            <div className="android-promo-header">
              <span className="android-promo-icon" aria-hidden="true"><Smartphone size={16} /></span>
              <div className="android-promo-text">
                <strong>Try our Android App</strong>
                <span>Experience smooth mock interviews on mobile</span>
              </div>
            </div>
            <a href="/Jobtic.apk" download="Jobtic.apk" className="btn-android-download">
              <Download size={14} /> Download APK (v2.1)
            </a>
          </div>
        )}
      </section>
    </div>
  );
};
export default AuthView;
