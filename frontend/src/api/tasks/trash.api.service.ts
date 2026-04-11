import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';

const rootUrl = `${API_BASE_URL}/tasks`;

export type TrashTask = {
  id?: string;
  _id?: string;
  name?: string;
  task_key?: string;
  project_id?: { id?: string; _id?: string; name?: string } | string;
  reporter_id?: { id?: string; _id?: string; name?: string };
  updated_at?: string;
};

export const trashApiService = {
  getTrashTasks: async (search = ''): Promise<IServerResponse<TrashTask[]>> => {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const response = await apiClient.get(`${rootUrl}/trash${query}`);
    return response.data;
  },

  restoreTasks: async (taskIds: string[]): Promise<IServerResponse<{ matched: number; modified: number }>> => {
    const response = await apiClient.put(`${rootUrl}/trash/restore`, { task_ids: taskIds });
    return response.data;
  },

  permanentlyDeleteTasks: async (taskIds: string[]): Promise<IServerResponse<{ deleted: number }>> => {
    const response = await apiClient.delete(`${rootUrl}/trash`, { data: { task_ids: taskIds } });
    return response.data;
  },
};

