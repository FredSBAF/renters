import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi, type RegisterPayload, type LoginPayload } from '../services/api';

const ACCESS_KEY = 'pouraccord_access_token';
const REFRESH_KEY = 'pouraccord_refresh_token';
const USER_KEY = 'pouraccord_user';

function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}
function getStoredRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export type UserInfo = {
  id: number;
  email: string;
  role: string;
  tenant_profile?: 'employee_cdi' | 'employee_cdd' | 'student' | 'freelance' | 'retired' | 'other' | null;
  is_2fa_enabled?: boolean;
};

type AuthState = {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: (() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? (JSON.parse(s) as UserInfo) : null;
    } catch {
      return null;
    }
  })(),
  accessToken: getStoredToken(),
  refreshToken: getStoredRefresh(),
  loading: false,
  error: null,
};

export const register = createAsyncThunk(
  'auth/register',
  async (payload: RegisterPayload, { rejectWithValue }) => {
    try {
      const { data } = await authApi.register(payload);
      if (!data.success || !data.data.user) return rejectWithValue(data.message || 'Erreur');
      return data;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; errors?: string[] } } };
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0] || 'Erreur';
      return rejectWithValue(msg);
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string, { rejectWithValue }) => {
    try {
      const { data } = await authApi.verifyEmail(token);
      if (!data.success) return rejectWithValue(data.message || 'Erreur');
      return data;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Lien invalide ou expiré');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (payload: LoginPayload, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(payload);
      if (!data.success) return rejectWithValue(data.message || 'Erreur');
      if (data.data.requires_2fa) {
        return { requires2fa: true as const, data };
      }
      const access = data.data.access_token!;
      const refresh = data.data.refresh_token!;
      const user = data.data.user!;
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { requires2fa: false as const, accessToken: access, refreshToken: refresh, user, data };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Email ou mot de passe incorrect');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    await authApi.logout();
  } catch {
    // ignore
  }
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  dispatch(authSlice.actions.clear());
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string }>
    ) => {
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem(REFRESH_KEY, action.payload.refreshToken);
      }
      localStorage.setItem(ACCESS_KEY, action.payload.accessToken);
    },
    clear: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erreur inscription';
      })
      .addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Lien invalide';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        if (action.payload.requires2fa) return;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Erreur connexion';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = null;
      });
  },
});

export const { setTokens } = authSlice.actions;
export default authSlice.reducer;
