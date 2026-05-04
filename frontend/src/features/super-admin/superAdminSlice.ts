import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { superAdminApiService, ISuperAdminContext, ISuperAdminTeam } from '@/api/super-admin/super-admin.api.service';

// ─────────────────────────────────────────────────────────────────────────────
// State Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface SuperAdminState {
  /** Is the current user a super admin? */
  isSuperAdmin: boolean;

  /** All teams in the system (fetched when org switcher is opened) */
  allTeams: ISuperAdminTeam[];
  allTeamsLoading: boolean;

  /** Current active context (which org the super admin is viewing) */
  context: ISuperAdminContext | null;
  contextLoading: boolean;

  /** Manage mode: false = read-only, true = can edit/delete/create */
  manageMode: boolean;

  /** Whether the org switcher modal is open */
  orgSwitcherOpen: boolean;

  /** Whether a switch operation is in progress */
  switching: boolean;

  error: string | null;
}

const initialState: SuperAdminState = {
  isSuperAdmin: false,
  allTeams: [],
  allTeamsLoading: false,
  context: null,
  contextLoading: false,
  manageMode: false,
  orgSwitcherOpen: false,
  switching: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSuperAdminContext = createAsyncThunk(
  'superAdmin/fetchContext',
  async (_, { rejectWithValue }) => {
    try {
      const res = await superAdminApiService.getContext();
      return res.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch context');
    }
  }
);

export const fetchAllTeams = createAsyncThunk(
  'superAdmin/fetchAllTeams',
  async (_, { rejectWithValue }) => {
    try {
      const res = await superAdminApiService.getAllTeams();
      return res.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch teams');
    }
  }
);

export const switchOrg = createAsyncThunk(
  'superAdmin/switchOrg',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const res = await superAdminApiService.switchOrg(teamId);
      return res.body;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to switch organization');
    }
  }
);

export const exitOrg = createAsyncThunk(
  'superAdmin/exitOrg',
  async (_, { rejectWithValue }) => {
    try {
      await superAdminApiService.exitOrg();
      return true;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to exit organization');
    }
  }
);

export const toggleManageMode = createAsyncThunk(
  'superAdmin/toggleManageMode',
  async (manageMode: boolean, { rejectWithValue }) => {
    try {
      const res = await superAdminApiService.toggleMode(manageMode);
      return res.body.manage_mode;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to toggle mode');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const superAdminSlice = createSlice({
  name: 'superAdmin',
  initialState,
  reducers: {
    setIsSuperAdmin: (state, action: PayloadAction<boolean>) => {
      state.isSuperAdmin = action.payload;
    },
    openOrgSwitcher: (state) => {
      state.orgSwitcherOpen = true;
    },
    closeOrgSwitcher: (state) => {
      state.orgSwitcherOpen = false;
    },
    clearSuperAdminState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── fetchSuperAdminContext ──────────────────────────────────────────────
      .addCase(fetchSuperAdminContext.pending, (state) => {
        state.contextLoading = true;
        state.error = null;
      })
      .addCase(fetchSuperAdminContext.fulfilled, (state, action) => {
        state.contextLoading = false;
        state.context = action.payload;
        state.manageMode = action.payload.manage_mode;
      })
      .addCase(fetchSuperAdminContext.rejected, (state, action) => {
        state.contextLoading = false;
        state.error = action.payload as string;
      })

      // ── fetchAllTeams ──────────────────────────────────────────────────────
      .addCase(fetchAllTeams.pending, (state) => {
        state.allTeamsLoading = true;
      })
      .addCase(fetchAllTeams.fulfilled, (state, action) => {
        state.allTeamsLoading = false;
        state.allTeams = action.payload;
      })
      .addCase(fetchAllTeams.rejected, (state, action) => {
        state.allTeamsLoading = false;
        state.error = action.payload as string;
      })

      // ── switchOrg ──────────────────────────────────────────────────────────
      .addCase(switchOrg.pending, (state) => {
        state.switching = true;
        state.error = null;
      })
      .addCase(switchOrg.fulfilled, (state, action) => {
        state.switching = false;
        state.orgSwitcherOpen = false;
        if (state.context) {
          state.context.active_team_id = action.payload.active_team_id;
          state.context.active_team_name = action.payload.active_team_name;
        }
      })
      .addCase(switchOrg.rejected, (state, action) => {
        state.switching = false;
        state.error = action.payload as string;
      })

      // ── exitOrg ────────────────────────────────────────────────────────────
      .addCase(exitOrg.fulfilled, (state) => {
        if (state.context) {
          state.context.active_team_id = null;
          state.context.active_team_name = null;
        }
        state.manageMode = false;
      })

      // ── toggleManageMode ───────────────────────────────────────────────────
      .addCase(toggleManageMode.fulfilled, (state, action) => {
        state.manageMode = action.payload;
        if (state.context) {
          state.context.manage_mode = action.payload;
        }
      });
  },
});

export const { setIsSuperAdmin, openOrgSwitcher, closeOrgSwitcher, clearSuperAdminState } = superAdminSlice.actions;
export default superAdminSlice.reducer;
