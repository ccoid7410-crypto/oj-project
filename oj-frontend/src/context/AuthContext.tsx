import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string, studentId?: string) => Promise<{ message: string }>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('oj_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>('/users/me')
      .then((u) => {
        // 이 요청이 떠 있는 동안 login/signup-verify 등으로 토큰이 이미 바뀌었을 수 있다.
        // 그 사이 값이 바뀌었으면(=더 최신 로그인이 있었으면) 이 응답으로 덮어쓰지 않는다.
        if (localStorage.getItem('oj_token') === token) setUser(u);
      })
      .catch(() => {
        if (localStorage.getItem('oj_token') === token) localStorage.removeItem('oj_token');
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('oj_token', res.accessToken);
    setUser(res.user);
  }

  async function signup(email: string, username: string, password: string, studentId?: string) {
    // 이메일 인증 전에는 토큰이 발급되지 않는다. 안내 메시지만 반환하고 로그인 상태로 만들지 않는다.
    return api.post<{ requiresEmailVerification: true; message: string }>('/auth/signup', {
      email,
      username,
      password,
      studentId: studentId || undefined,
    });
  }

  async function verifyEmail(token: string) {
    const res = await api.post<{ accessToken: string; user: User }>('/auth/verify-email', { token });
    localStorage.setItem('oj_token', res.accessToken);
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem('oj_token');
    setUser(null);
  }

  async function refreshUser() {
    if (!localStorage.getItem('oj_token')) return;
    const me = await api.get<User>('/users/me');
    setUser(me);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, verifyEmail, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
