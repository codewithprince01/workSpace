import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface ICalendarEvent {
  _id: string;
  title: string;
  description: string;
  type: 'webinar' | 'meeting' | 'reminder' | 'task_deadline' | 'team_note' | 'mood_entry';
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  user_id: { _id: string; name: string; email: string; avatar_url?: string } | string;
  assigned_user_id?: { _id: string; name: string; email: string; avatar_url?: string } | string | null;
  assigned_user_ids?: ({ _id: string; name: string; email: string; avatar_url?: string } | string)[];
  external_assigned_emails?: string[];
  is_all_members?: boolean;
  team_id?: { _id: string; name: string } | string | null;
  project_id?: string | null;
  task_id?: string | null;
  priority: 'low' | 'medium' | 'high';
  event_scope: 'personal' | 'team';
  mood?: 'amazing' | 'happy' | 'neutral' | 'sad' | 'stressed' | null;
  mood?: 'amazing' | 'happy' | 'neutral' | 'sad' | 'stressed' | null;
  energy_level?: number;
  mood_tags?: string[];
  color?: string | null;
  reminder_minutes: number[];
  created_at: string;
  updated_at: string;
}

export interface ICreateEventPayload {
  title: string;
  description?: string;
  type: ICalendarEvent['type'];
  start_time: string;
  end_time?: string | null;
  all_day?: boolean;
  assigned_user_id?: string | null;
  assigned_user_ids?: string[];
  external_assigned_emails?: string[];
  is_all_members?: boolean;
  team_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  priority?: 'low' | 'medium' | 'high';
  event_scope: 'personal' | 'team';
  mood?: 'amazing' | 'happy' | 'neutral' | 'sad' | 'stressed' | null;
  mood?: 'amazing' | 'happy' | 'neutral' | 'sad' | 'stressed' | null;
  energy_level?: number;
  mood_tags?: string[];
  color?: string | null;
  reminder_minutes?: number[];
}

export interface ITeamMemberOption {
  _id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export const calendarApiService = {
  async getEvents(start: string, end: string, filters?: Record<string, string>) {
    const params = new URLSearchParams({ start, end, ...filters });
    const response = await apiClient.get(`${API_BASE_URL}/calendar/events?${params.toString()}`);
    return response.data;
  },

  async getEvent(id: string) {
    const response = await apiClient.get(`${API_BASE_URL}/calendar/events/${id}`);
    return response.data;
  },

  async createEvent(payload: ICreateEventPayload) {
    const response = await apiClient.post(`${API_BASE_URL}/calendar/events`, payload);
    return response.data;
  },

  async updateEvent(id: string, payload: Partial<ICreateEventPayload>) {
    const response = await apiClient.put(`${API_BASE_URL}/calendar/events/${id}`, payload);
    return response.data;
  },

  async deleteEvent(id: string) {
    const response = await apiClient.delete(`${API_BASE_URL}/calendar/events/${id}`);
    return response.data;
  },

  async getTeamMoods(date: string) {
    const response = await apiClient.get(`${API_BASE_URL}/calendar/moods?date=${date}`);
    return response.data;
  },

  async getTeamMembers() {
    const response = await apiClient.get(`${API_BASE_URL}/calendar/team-members`);
    return response.data;
  },
};
