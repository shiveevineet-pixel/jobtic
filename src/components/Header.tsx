import React, { useState } from 'react';
import { Check, Settings, LogOut, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { getAccountProfile } from '../services/accountProfile';

export const Header: React.FC<{ onOpenSettings: () => void; beforeSignOut?: () => boolean | Promise<boolean> }> = ({ onOpenSettings, beforeSignOut }) => {
  const { signOut, user, mockUser } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const { name, email } = getAccountProfile(user, mockUser);
  return (
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Check size={20} /></span><div className="brand-name">jobtic<span className="brand-product">Career studio</span></div></div>
      <span className="header-context">Your personal preparation workspace</span>
      <div className="header-actions">
        {!Capacitor.isNativePlatform() && (
          <a href="/Jobtic.apk" download="Jobtic.apk" className="header-app-download" title="Download Android App (APK v2.1)">
            <Smartphone size={14} />
            <span>App</span>
          </a>
        )}
        {logoutError && <span role="alert">{logoutError}</span>}<span className="account-label" title={email || name}>{mockUser && !user ? 'Guest workspace' : <>{name}{email && <small className="account-email">{email}</small>}</>}</span><span className="account-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><button className="icon-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings"><Settings size={18} /></button><button className="icon-btn" disabled={signingOut} onClick={async () => { if (beforeSignOut && !await beforeSignOut()) return; setSigningOut(true); setLogoutError(''); try { await signOut(); } catch { setLogoutError('Sign-out failed. Please reconnect and try again.'); setSigningOut(false); } }} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button></div>
    </header>
  );
};
export default Header;
