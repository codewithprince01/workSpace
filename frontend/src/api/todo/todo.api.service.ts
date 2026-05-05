import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface ITodoUser {
  _id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface ITodo {
  id: string;
  _id: string;
  title: string;
  description: string;
  created_by: ITodoUser;
  assigned_to: ITodoUser[];
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  labels: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_overdue: boolean;
  days_overdue: number;
  performance?: {
    on_time: boolean;
    days_taken: number;
    overdue_days: number;
  };
}

const BASE = `${API_BASE_URL}/todos`;

export const todoApiService = {
  getTodos: async (params?: { view?: string; status?: string; priority?: string; search?: string }): Promise<{ done: boolean; body: ITodo[] }> => {
    const res = await apiClient.get(BASE, { params });
    return res.data;
  },

  createTodo: async (data: Partial<ITodo>): Promise<{ done: boolean; body: ITodo }> => {
    const res = await apiClient.post(BASE, data);
    return res.data;
  },

  updateTodo: async (id: string, data: Partial<ITodo>): Promise<{ done: boolean; body: ITodo }> => {
    const res = await apiClient.put(`${BASE}/${id}`, data);
    return res.data;
  },

  deleteTodo: async (id: string): Promise<{ done: boolean; message: string }> => {
    const res = await apiClient.delete(`${BASE}/${id}`);
    return res.data;
  },

  bulkDelete: async (ids: string[]): Promise<{ done: boolean; message: string }> => {
    const res = await apiClient.post(`${BASE}/bulk-delete`, { ids });
    return res.data;
  },

  bulkUpdate: async (ids: string[], data: Partial<ITodo>): Promise<{ done: boolean; message: string }> => {
    const res = await apiClient.post(`${BASE}/bulk-update`, { ids, data });
    return res.data;
  },

  searchUsers: async (q?: string): Promise<{ done: boolean; body: ITodoUser[] }> => {
    const res = await apiClient.get(`${BASE}/member-search`, { 
      params: { q, _t: Date.now(), v: 'force-fresh' } 
    });
    return res.data;
  }
};
