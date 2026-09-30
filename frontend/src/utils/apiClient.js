import axios from 'axios';
import { BACKEND_URL } from '../environment';

// THE axios instance — every authenticated call in the app goes through here, so the Bearer header is attached in exactly ONE place
export const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// One 401 behavior app-wide: an expired/rotated token means the session is dead → clear storage and land on /auth.
apiClient.interceptors.response.use((res) => res,(err) => {
    const url = err.config?.url || '';
    const isAuthCall = url.includes('/login') || url.includes('/register');
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth'; // outside React — full navigation is correct here
      }
    }
    return Promise.reject(err);
  }
);
