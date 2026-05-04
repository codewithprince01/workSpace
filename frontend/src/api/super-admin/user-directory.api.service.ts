import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface IProvisionedUser {
  id: string;
  name: string;
  email: string;
  department: string;
  is_active: boolean;
  created_at: string;
  provisioned: boolean;
}

export interface IUserSearchResult {
  id: string;
  name: string;
  email: string;
  department: string;
  avatar_url: string | null;
}

export interface IBulkUploadResult {
  created: IProvisionedUser[];
  skipped: string[];
  errors: { row: any; reason: string }[];
}

const BASE = `${API_BASE_URL}/super-admin/user-directory`;


export const userDirectoryApiService = {
  /** List all users with optional search/pagination */
  list: (page = 1, limit = 20, search = '') =>
    apiClient.get<{ done: boolean; body: IProvisionedUser[]; total: number; pages: number }>(
      `${BASE}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    ),

  /** Create a single user */
  createUser: (name: string, email: string, department: string) =>
    apiClient.post<{ done: boolean; body: IProvisionedUser; message: string }>(
      `${BASE}/single`,
      { name, email, department }
    ),

  /** Bulk upload via FormData with Excel/CSV file */
  bulkUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ done: boolean; body: IBulkUploadResult; message: string }>(
      `${BASE}/bulk`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  /** Delete a user by ID */
  deleteUser: (userId: string) =>
    apiClient.delete<{ done: boolean; message: string }>(`${BASE}/${userId}`),

  /** Search users for invite auto-suggest */
  searchUsers: (q: string) =>
    apiClient.get<{ done: boolean; body: IUserSearchResult[] }>(
      `${BASE}/search?q=${encodeURIComponent(q)}`
    ),
};
