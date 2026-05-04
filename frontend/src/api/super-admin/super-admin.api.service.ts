import apiClient from '@/api/api-client';
import { API_BASE_URL } from '@/shared/constants';

export interface ISuperAdminContext {
  is_super_admin: boolean;
  active_team_id: string | null;
  active_team_name: string | null;
  active_team_color: string | null;
  own_team_id: string | null;
  manage_mode: boolean;
}

export interface ISuperAdminTeam {
  id: string;
  name: string;
  color_code: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  owner_avatar: string | null;
}

export interface IAuditLog {
  _id: string;
  super_admin_name: string;
  target_team_name: string | null;
  action: string;
  resource_type: string | null;
  mode: 'view' | 'manage';
  created_at: string;
}

const BASE = `${API_BASE_URL}/super-admin`;

export const superAdminApiService = {
  /**
   * Get super admin's current context (active team, mode)
   */
  getContext: async (): Promise<{ done: boolean; body: ISuperAdminContext }> => {
    const res = await apiClient.get(`${BASE}/context`);
    return res.data;
  },

  /**
   * List all teams in the system
   */
  getAllTeams: async (): Promise<{ done: boolean; body: ISuperAdminTeam[] }> => {
    const res = await apiClient.get(`${BASE}/teams`);
    return res.data;
  },

  /**
   * Switch into a specific organization
   */
  switchOrg: async (teamId: string): Promise<{ done: boolean; body: { active_team_id: string; active_team_name: string } }> => {
    const res = await apiClient.post(`${BASE}/switch-org`, { team_id: teamId });
    return res.data;
  },

  /**
   * Exit org context and return to own workspace
   */
  exitOrg: async (): Promise<{ done: boolean; message: string }> => {
    const res = await apiClient.post(`${BASE}/exit-org`, {});
    return res.data;
  },

  /**
   * Toggle view/manage mode
   */
  toggleMode: async (manageMode: boolean): Promise<{ done: boolean; body: { manage_mode: boolean } }> => {
    const res = await apiClient.post(`${BASE}/toggle-mode`, { manage_mode: manageMode });
    return res.data;
  },

  /**
   * Get all users in the system
   */
  getAllUsers: async (page = 1, limit = 50): Promise<{ done: boolean; body: any[]; total: number }> => {
    const res = await apiClient.get(`${BASE}/users`, { params: { page, limit } });
    return res.data;
  },

  /**
   * Update a user's global role
   */
  updateUserRole: async (userId: string, role: 'user' | 'super_admin'): Promise<{ done: boolean; body: any }> => {
    const res = await apiClient.put(`${BASE}/users/${userId}/role`, { role });
    return res.data;
  },

  /**
   * Get audit logs
   */
  getAuditLogs: async (params?: { team_id?: string; action?: string; page?: number; limit?: number }): Promise<{
    done: boolean; body: IAuditLog[]; total: number; page: number; pages: number;
  }> => {
    const res = await apiClient.get(`${BASE}/audit-logs`, { params });
    return res.data;
  },
};
