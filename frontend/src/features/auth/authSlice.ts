import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApiService } from '@/api/auth/auth.api.service';
import { IAuthState, IUserLoginRequest } from '@/types/auth/login.types';
import { IUserSignUpRequest } from '@/types/auth/signup.types';
import logger from '@/utils/errorLogger';
import { setSession } from '@/utils/session-helper';

// Initial state
const initialState: IAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  teamId: undefined,
  projectId: undefined,
};

// Helper function for error handling
const handleAuthError = (error: any, action: string) => {
  logger.error(action, error);
  return error.response?.data?.message || 'An unknown error has occurred';
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: IUserLoginRequest, { rejectWithValue }) => {
    try {
      const response = await authApiService.login(credentials);
      
      if (!response.authenticated && !response.user && !response.data?.user) {
        return rejectWithValue(response.auth_error || 'Authorization failed');
      }

      return response;
    } catch (error: any) {
      return rejectWithValue(handleAuthError(error, 'Login'));
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signup',
  async (credentials: IUserSignUpRequest, { rejectWithValue }) => {
    try {
      const signupResponse = await authApiService.signUp(credentials);
      // Store token if returned from signup
      const signupToken = (signupResponse as any).token || (signupResponse as any).data?.token;
      if (signupToken) {
        localStorage.setItem('worklenz_token', signupToken);
      }
      
      const authorizeResponse = await authApiService.verify();

      if (!authorizeResponse.authenticated) {
        return rejectWithValue(authorizeResponse.auth_error || 'Authorization failed');
      }

      if (authorizeResponse.authenticated) {
        // Handle nested user object if present
        const user = authorizeResponse.user || (authorizeResponse as any).data?.user;
        const token = (authorizeResponse as any).token || (authorizeResponse as any).data?.token;
        if (user) {
          localStorage.setItem('session', JSON.stringify(user));
        }
        if (token) {
          localStorage.setItem('worklenz_token', token);
        }
      }

      return authorizeResponse;
    } catch (error: any) {
      return rejectWithValue(handleAuthError(error, 'SignUp'));
    }
  }
);

export const logout = createAsyncThunk('secure/logout', async (_, { rejectWithValue }) => {
  try {
    const response = await authApiService.logout();
    // Clear token from localStorage
    localStorage.removeItem('worklenz_token');
    if (!response.done) {
      return rejectWithValue(response.message || 'Logout failed');
    }
    return response;
  } catch (error: any) {
    // Still clear token even if logout API fails
    localStorage.removeItem('worklenz_token');
    return rejectWithValue(handleAuthError(error, 'Logout'));
  }
});

export const verifyAuthentication = createAsyncThunk('secure/verify', async () => {
  return await authApiService.verify();
});

export const resetPassword = createAsyncThunk('auth/resetPassword', async (email: string) => {
  return await authApiService.resetPassword(email);
});

export const updatePassword = createAsyncThunk('auth/updatePassword', async (values: any) => {
  return await authApiService.updatePassword(values);
});

// Common state updates
const setPending = (state: IAuthState) => {
  state.isLoading = true;
  state.error = null;
};

const setRejected = (state: IAuthState, action: any) => {
  state.isLoading = false;
  state.error = action.payload as string;
};

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTeamAndProject: (state, action: { payload: { teamId?: string; projectId?: string } }) => {
      state.teamId = action.payload.teamId;
      state.projectId = action.payload.projectId;
    },
  },
  extraReducers: builder => {
    builder
      // Login cases
      .addCase(login.pending, setPending)
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        // Access user from data property if available, or direct property
        state.user = (action.payload as any).data?.user || action.payload.user;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        setRejected(state, action);
        state.isAuthenticated = false;
      })

      // SignUp cases
      .addCase(signUp.pending, setPending)
      .addCase(signUp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = (action.payload as any).data?.user || action.payload.user;
        state.error = null;
      })
      .addCase(signUp.rejected, (state, action) => {
        setRejected(state, action);
        state.isAuthenticated = false;
      })

      // Logout cases
      .addCase(logout.pending, setPending)
      .addCase(logout.fulfilled, state => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
        state.teamId = undefined;
        state.projectId = undefined;
      })
      .addCase(logout.rejected, setRejected)

      // Verify authentication cases
      .addCase(verifyAuthentication.pending, state => {
        state.isLoading = true;
      })
      .addCase(verifyAuthentication.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = !!action.payload && ((action.payload as any).authenticated || !!(action.payload as any).success);
        state.user = (action.payload as any).data?.user || action.payload.user;
        if (state.user) {
          setSession(state.user);
        }
      })
      .addCase(verifyAuthentication.rejected, state => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { setTeamAndProject } = authSlice.actions;
export default authSlice.reducer;
