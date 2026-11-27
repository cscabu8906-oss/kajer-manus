import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import { setDocumentLanguage } from '../i18n';
import type { AppLanguage, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  language: AppLanguage;
  switchLanguage: (lang: AppLanguage) => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithToken: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const language: AppLanguage = i18n.language === 'en' ? 'en' : 'bn';

  const refreshUser = async () => {
    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
      if (data.user.language_preference && data.user.language_preference !== i18n.language) {
        await setDocumentLanguage(data.user.language_preference);
      }
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (getStoredToken()) {
      refreshUser();
    } else {
      // Try HttpOnly cookie session
      refreshUser();
    }
  }, []);

  const switchLanguage = async (lang: AppLanguage) => {
    await setDocumentLanguage(lang);
    if (user) {
      try {
        const res = await apiRequest<{ user: User }>('/users/me/language', {
          method: 'PATCH',
          body: JSON.stringify({ languagePreference: lang })
        });
        setUser(res.user);
      } catch {
        // Keep local preference even if offline
      }
    }
  };

  const loginWithToken = async (token: string, nextUser: User) => {
    setStoredToken(token);
    setUser(nextUser);
    if (nextUser.language_preference) {
      await setDocumentLanguage(nextUser.language_preference);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    }
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, language, switchLanguage, refreshUser, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
