import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginCredentials, AuthContextType } from './types.ts';
import { api, TOKEN_STORAGE_KEYS, performTokenRefresh } from '../lib/api.ts';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedAccess = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefresh = localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
        const storedUser = localStorage.getItem(TOKEN_STORAGE_KEYS.USER_DATA);

        if (storedAccess && storedUser) {
          try {
            const parsedUser: User = JSON.parse(storedUser);
            if (parsedUser.role === 'admin') {
              setUser(parsedUser);
              setAccessToken(storedAccess);
              setRefreshToken(storedRefresh);
            } else {
              // Clear non-admin cached tokens
              localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
              localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
              localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);
            }
          } catch {
            localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Listen to session expiry events dispatched by API client
    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/login', credentials, { skipAuth: true });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed. Please check your credentials.');
      }

      const { accessToken: newAccess, refreshToken: newRefresh, user: loggedInUser } = response.data;

      // Ensure user has administrative privileges
      if (loggedInUser.role !== 'admin') {
        throw new Error('Access denied: You do not have administrative privileges for this CMS.');
      }

      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, newAccess);
      localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, newRefresh);
      localStorage.setItem(TOKEN_STORAGE_KEYS.USER_DATA, JSON.stringify(loggedInUser));

      setUser(loggedInUser);
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const newAccess = await performTokenRefresh();
    if (newAccess) {
      setAccessToken(newAccess);
      const storedUser = localStorage.getItem(TOKEN_STORAGE_KEYS.USER_DATA);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore
        }
      }
      return true;
    }
    logout();
    return false;
  }, [logout]);

  const isAuthenticated = !!(user && accessToken && user.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
