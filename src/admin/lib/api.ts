/**
 * Reusable HTTP API Client for the Portfolio CMS.
 * Handles automatic JWT attachment, response parsing, and transparent token refresh with 401 interception.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'portfolio_cms_access_token',
  REFRESH_TOKEN: 'portfolio_cms_refresh_token',
  USER_DATA: 'portfolio_cms_user',
};

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  _retry?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken: string | null) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

/**
 * Executes a token refresh request against the backend POST /api/auth/refresh endpoint.
 */
export async function performTokenRefresh(): Promise<string | null> {
  const currentRefreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
  if (!currentRefreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    if (!response.ok) {
      // Refresh token is invalid or expired
      localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return null;
    }

    const payload = await response.json();
    const newAccessToken = payload.data?.accessToken;
    const newRefreshToken = payload.data?.refreshToken;
    const user = payload.data?.user;

    if (newAccessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
      }
      if (user) {
        localStorage.setItem(TOKEN_STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      }
      return newAccessToken;
    }
    return null;
  } catch (err) {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_STORAGE_KEYS.USER_DATA);
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    return null;
  }
}

/**
 * Core request dispatcher with automatic token injection and single 401 retry.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Set default JSON Content-Type unless body is FormData (for uploads)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Authorization header if access token exists and not explicitly skipped
  if (!options.skipAuth) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized with token refresh if not already retried and not an auth endpoint
    if (response.status === 401 && !options._retry && !options.skipAuth && !endpoint.includes('/api/auth/')) {
      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise<ApiResponse<T>>((resolve) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              options.headers = {
                ...(options.headers || {}),
                Authorization: `Bearer ${newToken}`,
              };
              options._retry = true;
              resolve(apiRequest<T>(endpoint, options));
            } else {
              resolve({
                success: false,
                error: 'Session expired. Please log in again.',
              });
            }
          });
        });
      }

      isRefreshing = true;
      const newToken = await performTokenRefresh();
      isRefreshing = false;
      onRefreshed(newToken);

      if (newToken) {
        options.headers = {
          ...(options.headers || {}),
          Authorization: `Bearer ${newToken}`,
        };
        options._retry = true;
        return apiRequest<T>(endpoint, options);
      } else {
        return {
          success: false,
          error: 'Session expired. Please log in again.',
        };
      }
    }

    // Parse JSON response safely
    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `Request failed with status ${response.status}`,
        errors: data?.errors,
      };
    }

    return {
      success: true,
      message: data?.message,
      data: data?.data ?? data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error: Unable to reach the server.',
    };
  }
}

export const api = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
