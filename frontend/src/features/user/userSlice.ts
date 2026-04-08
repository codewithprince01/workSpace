import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ILocalSession } from '@/types/auth/local-session.types';
import { getUserSession } from '@/utils/session-helper';

const sessionData = getUserSession();

const initialState: ILocalSession = {
  id: sessionData?.id || '',
  name: sessionData?.name || '',
  email: sessionData?.email || '',
  avatar_url: sessionData?.avatar_url || '',
  owner: sessionData?.owner,
  is_admin: sessionData?.is_admin,
  team_id: sessionData?.team_id,
  team_name: sessionData?.team_name,
};

const userSlice = createSlice({
  name: 'userReducer',
  initialState,
  reducers: {
    changeUserName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
    },
    setUser: (state, action: PayloadAction<ILocalSession>) => {
      // Update state properties individually to ensure mutation
      state.id = action.payload.id;
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.avatar_url = action.payload.avatar_url;
      state.owner = action.payload.owner;
      state.is_admin = action.payload.is_admin;
      state.team_id = action.payload.team_id;
      state.team_name = action.payload.team_name;
    },
  },
});

export const { changeUserName, setUser } = userSlice.actions;
export default userSlice.reducer;
