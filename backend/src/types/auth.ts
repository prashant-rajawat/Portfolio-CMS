export interface JwtUserPayload {
  id: string;
  role: string;
  tokenType: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  role: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}
