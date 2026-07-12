import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getProfile, UserProfile } from '@/api/auth';
import { setAccessToken as setApiAccessToken, getAccessToken } from '@/api/client';
import { mqttClient } from '@/mqtt/mqtt.client';

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(getAccessToken());
  // Keep refreshToken in localStorage to survive F5
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('refresh_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      // If we have an access token, we can get the profile.
      // But on hard refresh, we only have refreshToken in localStorage.
      // The apiClient interceptor will try to use the refreshToken if an API call fails with 401.
      // However, to trigger that, we need to try getting the profile.
      if (refreshToken) {
        try {
          const profile = await getProfile();
          setUser(profile);
          // Sync state if interceptor fetched new token
          setAccessTokenState(getAccessToken());
          mqttClient.connect();
        } catch (error) {
          console.warn('Failed to restore session:', error);
          handleLogout();
        }
      }
      setIsLoading(false);
    };

    const handleAuthRefresh = (e: CustomEvent) => {
      setAccessTokenState(e.detail.accessToken);
    };
    const handleAuthLogout = () => {
      handleLogout();
    };

    window.addEventListener('auth:refresh', handleAuthRefresh as EventListener);
    window.addEventListener('auth:logout', handleAuthLogout);

    initSession();

    return () => {
      window.removeEventListener('auth:refresh', handleAuthRefresh as EventListener);
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [refreshToken]);

  const setTokens = useCallback((access: string, refresh: string) => {
    setApiAccessToken(access);
    setAccessTokenState(access);
    setRefreshToken(refresh);
    localStorage.setItem('refresh_token', refresh);
    
    // Fetch profile immediately after setting tokens if we don't have it
    getProfile()
      .then(profile => {
        setUser(profile);
        mqttClient.connect();
      })
      .catch(console.error);
  }, []);

  const handleLogout = useCallback(() => {
    setApiAccessToken(null);
    setAccessTokenState(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('refresh_token');
    mqttClient.disconnect();
  }, []);

  const value = {
    accessToken,
    refreshToken,
    user,
    isAuthenticated: !!accessToken || !!refreshToken,
    isLoading,
    setTokens,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
