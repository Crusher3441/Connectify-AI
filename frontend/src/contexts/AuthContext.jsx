import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiClient } from '../utils/apiClient';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null; // corrupted storage → behave as logged out, never crash the boot
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(readStoredUser);

  const persist = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // written as code: NO credential is ever logged. The old project's
  // console.log(username, password) is the exact line this comment replaces.
  const register = useCallback(async ({ name, username, password }) => {
    const res = await apiClient.post('/users/register', { name, username, password });
    return res.data; // 201, no token — the user logs in explicitly (2I wires that step)
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const res = await apiClient.post('/users/login', { username, password });
    persist(res.data.token, res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await apiClient.get('/users/me/history');
    return res.data;
  }, []);

  const addMeetingToHistory = useCallback(async (meetingCode) => {
    const res = await apiClient.post('/users/me/history', { meetingCode });
    return res.data;
  }, []);

  const value = useMemo(
    () => ({ token, user, register, login, logout, fetchHistory, addMeetingToHistory }),
    [token, user, register, logout, fetchHistory, addMeetingToHistory]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}