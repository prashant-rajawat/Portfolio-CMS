import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginCredentials, AuthContextType } from './types.ts';
import { api, TOKEN_STORAGE_KEYS, performTokenRefresh } from '../lib/api.ts';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to safely decode JWT payload on client side
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedAccess = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefresh = localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
        const storedUser = localStorage.getItem(TOKEN_STORAGE_KEYS.USER_DATA);

        // If no access or refresh token exists, immediately mark unauthenticated
        if (!storedAccess && !storedRefresh) {
          if (isMounted) {
            setUser(null);
            setAccessToken(null);
            setRefreshToken(null);
          }
          return;
        }

        let parsedUser: User | null = null;
        if (storedUser) {
          try {
            parsedUser = JSON.parse(storedUser);
          } catch {
            parsedUser = null;
          }
        }

        // 1. Check if existing access token is still valid
        if (storedAccess) {
          const payload = decodeJwtPayload(storedAccess);
          const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;

          if (!isExpired) {
            const resolved: User = parsedUser && parsedUser.role === 'admin'
              ? parsedUser
              : {
                  id: payload?.id || 'admin',
                  name: payload?.name || 'Administrator',
                  email: payload?.email || 'admin@portfolio',
                  role: payload?.role || 'admin',
                };

            if (resolved.role === 'admin' && isMounted) {
              setUser(resolved);
              setAccessToken(storedAccess);
              setRefreshToken(storedRefresh);
              return;
            }
          }
        }

        // 2. If access token is expired or invalid, attempt refresh exactly once if refresh token exists
        if (storedRefresh) {
          const newAccess = await performTokenRefresh();
          if (newAccess && isMounted) {
            const newPayload = decodeJwtPayload(newAccess);
            const freshUserStr = localStorage.getItem(TOKEN_STORAGE_KEYS.USER_DATA);
            let freshUser: User | null = null;
            if (freshUserStr) {
              try { freshUser = JSON.parse(freshUserStr); } catch {}
            }
            const resolvedUser: User = (freshUser && freshUser.role === 'admin')
              ? freshUser
              : {
                  id: newPayload?.id || 'admin',
                  name: newPayload?.name || 'Administrator',
                  email: newPayload?.email || 'admin@portfolio',
                  role: newPayload?.role || 'admin',
                };

            if (resolvedUser.role === 'admin') {
              setUser(resolvedUser);
              setAccessToken(newAccess);
              setRefreshToken(localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN));
              return;
            }
          }
        }

        // 3. If session restoration failed, clear stale tokens
        if (isMounted) {
          localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    // Listen to session expiry events dispatched by API client
    const handleSessionExpired = () => {
      if (isMounted) {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    const response = await api.post('/api/auth/login', credentials, { skipAuth: true });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed. Please check your credentials.');
    }

    const rawData = response.data?.data || response.data || {};
    const newAccess: string =
      rawData.accessToken ||
      rawData.token ||
      (typeof rawData === 'string' ? rawData : '');
    const newRefresh: string =
      rawData.refreshToken || '';

    const jwtPayload = newAccess ? decodeJwtPayload(newAccess) : null;

    // Resolve user object with high resilience
    const resolvedUser: User =
      rawData.user ||
      (rawData.id && rawData.role ? { id: rawData.id, name: rawData.name || 'Administrator', email: rawData.email || credentials.email, role: rawData.role } : null) ||
      (jwtPayload && jwtPayload.role
        ? {
            id: jwtPayload.id || 'admin',
            name: jwtPayload.name || 'Administrator',
            email: jwtPayload.email || credentials.email,
            role: jwtPayload.role,
          }
        : {
            id: 'bootstrap-admin-id',
            name: 'Bootstrap Administrator',
            email: credentials.email,
            role: 'admin',
          });

    // Ensure user has administrative privileges
    if (!resolvedUser || resolvedUser.role !== 'admin') {
      throw new Error('Access denied: You do not have administrative privileges for this CMS.');
    }

    if (newAccess) {
      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, newAccess);
    }
    if (newRefresh) {
      localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, newRefresh);
    }
    localStorage.setItem(TOKEN_STORAGE_KEYS.USER_DATA, JSON.stringify(resolvedUser));

    setUser(resolvedUser);
    setAccessToken(newAccess);
    setRefreshToken(newRefresh);
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
