import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService, AppSettings } from '../services/storageService';
import { useAuth } from './AuthContext';
import { getAccountProfile } from '../services/accountProfile';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, mockUser } = useAuth();
  const scope = user ? `user:${user.id}` : mockUser ? 'guest' : 'signed-out';
  const profileName = getAccountProfile(user, mockUser).name;
  const [preferences, setSettingsState] = useState<AppSettings>(() => storageService.getSettings(scope));
  // Derive identity on every render; never trust names from device preferences.
  const settings = { ...preferences, userName: profileName };

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.classList.remove('light-theme');
    }
  }, [settings.theme]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = storageService.saveSettings(newSettings, scope);
    setSettingsState(updated);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
