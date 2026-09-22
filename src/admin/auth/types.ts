export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | string;
}

export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
}
