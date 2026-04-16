import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { calendarApiService, ICalendarEvent, ICreateEventPayload, ITeamMemberOption } from '@/api/calendar/calendar.api.service';

export type ViewMode = 'month' | 'week' | 'day';
export type CalendarMode = 'personal' | 'team';
export type SlidePanelMode = 'create' | 'edit';

export interface CalendarState {
  events: ICalendarEvent[];
  selectedEvent: ICalendarEvent | null;
  teamMembers: ITeamMemberOption[];
  viewMode: ViewMode;
  currentDate: string;
  loading: boolean;
  error: string | null;

  // Quick create popover (click on date)
  quickCreateOpen: boolean;
  quickCreateDate: string | null;
  quickCreatePosition: { x: number; y: number } | null;

  // Right-side slide panel (full form)
  slidePanelOpen: boolean;
  slidePanelMode: SlidePanelMode;

  // Detail preview panel (click event)
  detailPanelOpen: boolean;

  // Mood panel (legacy, kept for mood tracking)
  moodPanelOpen: boolean;
  moodPanelDate: string | null;

  // Personal vs Team toggle
  calendarMode: CalendarMode;
  selectedTeamId: string | null;

  filters: {
    type: string | null;
    priority: string | null;
    team_id: string | null;
    assigned_user_id: string | null;
    project_id: string | null;
  };
}

const STORAGE_KEY_TEAM = 'worklenz_calendar_team_id';
const savedTeamId = localStorage.getItem(STORAGE_KEY_TEAM) as string | null;

const initialState: CalendarState = {
  events: [],
  selectedEvent: null,
  teamMembers: [],
  viewMode: 'month',
  currentDate: new Date().toISOString(),
  loading: false,
  error: null,

  quickCreateOpen: false,
  quickCreateDate: null,
  quickCreatePosition: null,

  slidePanelOpen: false,
  slidePanelMode: 'create',

  detailPanelOpen: false,

  moodPanelOpen: false,
  moodPanelDate: null,

  calendarMode: 'personal',
  selectedTeamId: savedTeamId,

  filters: {
    type: null,
    priority: null,
    team_id: null,
    assigned_user_id: null,
    project_id: null,
  },
};

// ──── ASYNC THUNKS ────

export const fetchEvents = createAsyncThunk(
  'calendar/fetchEvents',
  async ({
    start, end, calendar_mode
  }: {
    start: string; end: string; calendar_mode?: CalendarMode
  }, { getState }) => {
    const state = (getState() as any).calendarReducer as CalendarState;
    const filters: Record<string, string> = {};

    if (state.filters.type) filters.type = state.filters.type;
    if (state.filters.priority) filters.priority = state.filters.priority;
    if (state.filters.assigned_user_id) filters.assigned_user_id = state.filters.assigned_user_id;
    if (state.filters.project_id) filters.project_id = state.filters.project_id;

    // Use selectedTeamId from state for team mode
    const mode = calendar_mode || state.calendarMode;
    if (mode === 'team' && state.selectedTeamId) {
      filters.team_id = state.selectedTeamId;
    }

    filters.calendar_mode = mode;

    const response = await calendarApiService.getEvents(start, end, filters);
    return response.body as ICalendarEvent[];
  }
);

export const createEvent = createAsyncThunk(
  'calendar/createEvent',
  async (payload: ICreateEventPayload) => {
    const response = await calendarApiService.createEvent(payload);
    return response.body as ICalendarEvent;
  }
);

export const updateEvent = createAsyncThunk(
  'calendar/updateEvent',
  async ({ id, payload }: { id: string; payload: Partial<ICreateEventPayload> }) => {
    const response = await calendarApiService.updateEvent(id, payload);
    return response.body as ICalendarEvent;
  }
);

export const deleteEvent = createAsyncThunk(
  'calendar/deleteEvent',
  async (id: string) => {
    await calendarApiService.deleteEvent(id);
    return id;
  }
);

export const fetchTeamMembers = createAsyncThunk(
  'calendar/fetchTeamMembers',
  async () => {
    const response = await calendarApiService.getTeamMembers();
    return response.body as ITeamMemberOption[];
  }
);

// ──── SLICE ────

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload;
    },
    setCurrentDate(state, action: PayloadAction<string>) {
      state.currentDate = action.payload;
    },
    setCalendarMode(state, action: PayloadAction<CalendarMode>) {
      state.calendarMode = action.payload;
      state.events = [];
    },
    setSelectedTeamId(state, action: PayloadAction<string | null>) {
      state.selectedTeamId = action.payload;
      if (action.payload) {
        localStorage.setItem(STORAGE_KEY_TEAM, action.payload);
      } else {
        localStorage.removeItem(STORAGE_KEY_TEAM);
      }
    },

    // ── Quick Create Popover ──
    openQuickCreate(state, action: PayloadAction<{ date: string; position?: { x: number; y: number } }>) {
      state.quickCreateOpen = true;
      state.quickCreateDate = action.payload.date;
      state.quickCreatePosition = action.payload.position || null;
      state.slidePanelOpen = false;
      state.detailPanelOpen = false;
    },
    closeQuickCreate(state) {
      state.quickCreateOpen = false;
      state.quickCreateDate = null;
      state.quickCreatePosition = null;
    },

    // ── Slide Panel ──
    openSlidePanel(state, action: PayloadAction<{ mode: SlidePanelMode; event?: ICalendarEvent | null }>) {
      state.slidePanelOpen = true;
      state.slidePanelMode = action.payload.mode;
      if (action.payload.event) {
        state.selectedEvent = action.payload.event;
      } else if (action.payload.mode === 'create') {
        state.selectedEvent = null;
      }
      state.quickCreateOpen = false;
      state.detailPanelOpen = false;
    },
    closeSlidePanel(state) {
      state.slidePanelOpen = false;
      if (state.slidePanelMode === 'create') {
        state.selectedEvent = null;
      }
    },

    // ── Detail Panel ──
    setSelectedEvent(state, action: PayloadAction<ICalendarEvent | null>) {
      state.selectedEvent = action.payload;
      state.detailPanelOpen = !!action.payload;
      state.slidePanelOpen = false;
      state.quickCreateOpen = false;
    },
    setDetailPanelOpen(state, action: PayloadAction<boolean>) {
      state.detailPanelOpen = action.payload;
      if (!action.payload) state.selectedEvent = null;
    },

    // ── Mood Panel (legacy) ──
    setMoodPanelOpen(state, action: PayloadAction<{ open: boolean; date?: string }>) {
      state.moodPanelOpen = action.payload.open;
      state.moodPanelDate = action.payload.date || null;
    },

    // ── Legacy compatibility ──
    setEventModalOpen(state, action: PayloadAction<boolean>) {
      // Redirect to slide panel
      if (action.payload) {
        state.slidePanelOpen = true;
        state.slidePanelMode = state.selectedEvent ? 'edit' : 'create';
      } else {
        state.slidePanelOpen = false;
      }
    },

    // ── Filters ──
    setFilter(state, action: PayloadAction<{ key: keyof CalendarState['filters']; value: string | null }>) {
      state.filters[action.payload.key] = action.payload.value;
    },
    clearFilters(state) {
      state.filters = { type: null, priority: null, team_id: null, assigned_user_id: null };
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchEvents.pending, state => { state.loading = true; state.error = null; })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch events';
      })

      .addCase(createEvent.fulfilled, (state, action) => {
        // ROOT CAUSE FIX #3: Only add the event to the visible list if its
        // scope matches the current calendar mode. Without this check, a newly
        // created "team" event would appear in the "My Calendar" events array
        // until the next fetchEvents call replaces the list.
        if (action.payload.event_scope === state.calendarMode) {
          state.events.push(action.payload);
        }
        state.slidePanelOpen = false;
        state.quickCreateOpen = false;
        state.selectedEvent = null;
      })

      .addCase(updateEvent.fulfilled, (state, action) => {
        const idx = state.events.findIndex(e => e._id === action.payload._id);
        if (idx !== -1) state.events[idx] = action.payload;
        if (state.selectedEvent?._id === action.payload._id) {
          state.selectedEvent = action.payload;
        }
        state.slidePanelOpen = false;
      })

      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.events = state.events.filter(e => e._id !== action.payload);
        if (state.selectedEvent?._id === action.payload) {
          state.selectedEvent = null;
          state.detailPanelOpen = false;
          state.slidePanelOpen = false;
        }
      })

      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.teamMembers = action.payload;
      });
  },
});

export const {
  setViewMode,
  setCurrentDate,
  setCalendarMode,
  setSelectedTeamId,
  openQuickCreate,
  closeQuickCreate,
  openSlidePanel,
  closeSlidePanel,
  setSelectedEvent,
  setDetailPanelOpen,
  setMoodPanelOpen,
  setEventModalOpen,
  setFilter,
  clearFilters,
} = calendarSlice.actions;

export default calendarSlice.reducer;
