import axios, { AxiosError } from 'axios';
import { config } from '../config/env';

const ACCESS_KEY = 'pouraccord_access_token';
const REFRESH_KEY = 'pouraccord_refresh_token';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((reqConfig) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config;
    if (err.response?.status === 401 && original && !(original as { _retry?: boolean })._retry) {
      (original as { _retry?: boolean })._retry = true;
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        try {
          const { data } = await axios.post<{ data: { access_token: string } }>(
            `${config.apiBaseUrl}/auth/refresh`,
            { refresh_token: refreshToken }
          );
          const newAccess = data.data.access_token;
          localStorage.setItem(ACCESS_KEY, newAccess);
          if (original.headers) original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          localStorage.removeItem(ACCESS_KEY);
          localStorage.removeItem(REFRESH_KEY);
          localStorage.removeItem('pouraccord_user');
        }
      }
    }
    return Promise.reject(err);
  }
);

export type RegisterPayload = {
  email: string;
  password: string;
  password_confirmation: string;
  accept_terms: boolean;
  accept_privacy: boolean;
};

export type LoginPayload = {
  email: string;
  password: string;
  totp_code?: string;
};

export type AuthResponse = {
  success: boolean;
  data: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id: number; email: string; role: string; is_2fa_enabled?: boolean };
    requires_2fa?: boolean;
  };
  message?: string;
};

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),
  verifyEmail: (token: string) =>
    api.post<AuthResponse>('/auth/verify-email', { token }),
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),
  logout: () =>
    api.post('/auth/logout', {}, {
      headers: localStorage.getItem(ACCESS_KEY)
        ? { Authorization: `Bearer ${localStorage.getItem(ACCESS_KEY)}` }
        : {},
    }),
  getMe: () => api.get('/users/me'),
};
