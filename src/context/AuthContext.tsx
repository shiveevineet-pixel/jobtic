import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { NativeGoogleAuth, hasNativeGoogleAuth, isNativeAndroid } from '../services/nativeGoogleAuth';
import { createAccountGuard } from '../services/accountProfile';

type AuthResultError = AuthError | Error | { message?: string } | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  mockUser: { email: string; name: string } | null;
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthResultError }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthResultError }>;
  signOut: () => Promise<void>;
  signInMock: (email: string, name: string) => void;
  updateProfileName: (name: string) => Promise<void>;
  signInWithGoogle: () => Promise<{ error: AuthResultError }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getWebOAuthRedirectUrl = (): string => {
  const configuredRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (configuredRedirectUrl) {
    return configuredRedirectUrl;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://jobtic.app';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mockUser, setMockUser] = useState<{ email: string; name: string } | null>(null);
  const isConfigured = isSupabaseConfigured();
  const previousAccount = useRef<string | null>(null);
  const accountGuard = useRef(createAccountGuard());
  const authAction = useRef(false);
  const profileRevision = useRef(0);

  const runAuthAction = async <T,>(action: () => Promise<T>): Promise<T> => {
    if (authAction.current) throw new Error('Another account operation is running. Please wait and try again.');
    authAction.current = true;
    try { return await action(); } finally { authAction.current = false; }
  };

  useEffect(() => {
    const guard = accountGuard.current;
    let alive = true;
    let authRevision = 0;
    const applySession = (next: Session | null) => {
      if (!alive) return;
      profileRevision.current += 1;
      if (previousAccount.current !== (next?.user.id ?? null)) {
        if (previousAccount.current) sessionStorage.removeItem(`jobtic_resume_context:user:${previousAccount.current}`);
        sessionStorage.removeItem('jobtic_resume_context:guest');
        sessionStorage.removeItem('jobtic_resume_context');
        previousAccount.current = next?.user.id ?? null;
      }
      setSession(next);
      setUser(next?.user ?? null);
      accountGuard.current.setOwner(next?.user.id ?? null);
      if (next) { setMockUser(null); localStorage.removeItem('jobtic_mock_user'); }
      setIsLoading(false);
    };
    // Check local storage for mock session first
    const storedMock = localStorage.getItem('jobtic_mock_user');
    if (storedMock) {
      try {
        setMockUser(JSON.parse(storedMock));
      } catch (err) {
        console.warn("Failed to parse mock user:", err);
      }
    }

    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    // Process OAuth PKCE return code if present in URL
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          supabase.auth.exchangeCodeForSession(code)
            .then(({ data, error }) => {
              if (error) {
                console.warn('PKCE exchange error:', error);
              } else if (data?.session && alive) {
                applySession(data.session);
              }
              window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
              console.warn('PKCE exchange failed:', err);
            });
        }
      } catch {
        // window.location parsing fallback
      }
    }

    // Get active session with network failure safeguard
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!alive || authRevision > 0) return;
        if (error) throw error;
        applySession(session);
      })
      .catch(err => {
        console.warn("Supabase getSession failed:", err);
        if (alive && authRevision === 0) setIsLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') && session?.user.id !== previousAccount.current) return;
      authRevision += 1;
      applySession(session);
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        const snapshot = accountGuard.current.capture();
        const revision = profileRevision.current;
        // Never await a Supabase request inside the auth callback (SDK lock).
        queueMicrotask(() => { void supabase.auth.getUser(session.access_token).then(({ data, error }) => {
          if (!alive || revision !== profileRevision.current || error || !data.user || !accountGuard.current.accepts(snapshot, data.user.id)) return;
          setUser(data.user);
          setSession(current => current?.user.id === data.user!.id ? { ...current, user: data.user! } : current);
        }).catch(() => { /* Offline: retain only this account's authenticated snapshot. */ }); });
      }
    });

    return () => {
      alive = false;
      guard.setOwner(null);
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signUp = async (email: string, password: string, name: string) => runAuthAction(async () => {
    if (!isConfigured) {
      return { error: new Error("Supabase is not configured yet.") };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });
    return { error };
  });

  const signIn = async (email: string, password: string) => runAuthAction(async () => {
    if (!isConfigured) {
      return { error: new Error("Supabase is not configured yet.") };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) return { error };
    if (!data.session) return { error: new Error('Sign-in did not create an authenticated session.') };
    setMockUser(null);
    localStorage.removeItem('jobtic_mock_user');
    return { error: null };
  });

  const signOut = async () => runAuthAction(async () => {
      if (isConfigured && user) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        // Never claim logout succeeded while the provider retains its session.
        if (error) throw error;
      }
      if (isNativeAndroid() && hasNativeGoogleAuth()) {
        try {
          await NativeGoogleAuth.signOut();
        } catch {
          // Supabase logout still succeeds if Google Play Services is unavailable.
          console.warn('Could not clear native Google account selection.');
        }
      }
      setMockUser(null);
      setUser(null);
      setSession(null);
      accountGuard.current.setOwner(null);
      previousAccount.current = null;
      localStorage.removeItem('jobtic_mock_user');
      sessionStorage.removeItem('jobtic_resume_context');
      sessionStorage.removeItem(`jobtic_resume_context:${user ? `user:${user.id}` : 'guest'}`);
  });

  const signInMock = (email: string, name: string) => {
    if (user || session) throw new Error('Sign out before entering the guest workspace.');
    if (authAction.current) throw new Error('Please wait for the current account operation.');
    const userObj = { email, name };
    setMockUser(userObj);
    localStorage.setItem('jobtic_mock_user', JSON.stringify(userObj));
  };

  const updateProfileName = async (newName: string) => runAuthAction(async () => {
    if (isConfigured && user) {
      const snapshot = accountGuard.current.capture();
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim(), jobtic_display_name: newName.trim(), jobtic_display_name_owner: user.id }
      });
      if (error) {
        console.error("Failed to update Supabase profile name:", error);
        throw error;
      } else if (data?.user) {
        if (!accountGuard.current.accepts(snapshot, data.user.id)) throw new Error('Account changed before the profile update finished.');
        profileRevision.current += 1;
        setUser(data.user);
        setSession(current => current?.user.id === data.user!.id ? { ...current, user: data.user! } : current);
      }
    } else if (mockUser) {
      const updated = { ...mockUser, name: newName };
      setMockUser(updated);
      localStorage.setItem('jobtic_mock_user', JSON.stringify(updated));
    }
  });

  const signInWithGoogle = async () => runAuthAction(async () => {
    if (!isConfigured) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    if (Capacitor.isNativePlatform()) {
      // Never fall back to browser OAuth inside the APK.
      if (!isNativeAndroid() || !hasNativeGoogleAuth()) {
        return { error: new Error('Native Google sign-in is unavailable. Install the latest Jobtic APK.') };
      }
      try {
        const { idToken, nonce } = await NativeGoogleAuth.signIn();
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce,
        });
        if (error) return { error };
        if (!data.session) return { error: new Error('Google sign-in did not create a session. Please try again.') };
        setSession(data.session);
        setUser(data.user);
        accountGuard.current.setOwner(data.user.id);
        setMockUser(null);
        localStorage.removeItem('jobtic_mock_user');
        return { error: null };
      } catch (error) {
        const nativeError = error as { code?: string; message?: string };
        if (nativeError.code === 'SIGN_IN_CANCELLED') return { error: null };
        return { error: new Error(nativeError.message || 'Google sign-in failed. Please try again.') };
      }
    }

    // The separate website uses standard web OAuth; Android never reaches this branch.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getWebOAuthRedirectUrl() },
    });
    return { error };
  });

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isConfigured,
      mockUser,
      signUp,
      signIn,
      signOut,
      signInMock,
      updateProfileName,
      signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
