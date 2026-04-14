import { IServerResponse } from '@/types/common.types';
import apiClient from '../api-client';
import { API_BASE_URL } from '@/shared/constants';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMember } from '@/types/teamMembers/teamMember.types';

const rootUrl = `${API_BASE_URL}/team-members`;
const TEAM_MEMBERS_CACHE_TTL_MS = 5000;

const inFlightRequests = new Map<string, Promise<any>>();
const responseCache = new Map<string, { timestamp: number; data: any }>();

const getCachedResponse = <T>(key: string): T | null => {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > TEAM_MEMBERS_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return cached.data as T;
};

const setCachedResponse = <T>(key: string, data: T): void => {
  responseCache.set(key, { timestamp: Date.now(), data });
};

const dedupedGet = async <T>(url: string): Promise<T> => {
  const cached = getCachedResponse<T>(url);
  if (cached) return cached;

  const inFlight = inFlightRequests.get(url);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const requestPromise = apiClient
    .get<T>(url)
    .then(res => {
      setCachedResponse(url, res.data);
      return res.data;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, requestPromise);
  return requestPromise;
};

const clearTeamMembersCache = () => {
  inFlightRequests.clear();
  responseCache.clear();
};

export const teamMembersApiService = {
  createTeamMember: async (
    body: ITeamMemberCreateRequest
  ): Promise<IServerResponse<ITeamMember>> => {
    const response = await apiClient.post<IServerResponse<ITeamMember>>(`${rootUrl}`, body);
    clearTeamMembersCache();
    return response.data;
  },

  get: async (
    index: number,
    size: number,
    field: string | null,
    order: string | null,
    search: string | null,
    all = false
  ): Promise<IServerResponse<ITeamMembersViewModel>> => {
    const trimmedSearch = (search || '').trim();
    const params = new URLSearchParams({
      index: index.toString(),
      size: size.toString(),
      ...(field && { field }),
      ...(order && { order }),
      ...(trimmedSearch && { search: trimmedSearch }),
      ...(all && { all: all.toString() }),
    });
    const url = `${rootUrl}?${params}`;
    return dedupedGet<IServerResponse<ITeamMembersViewModel>>(url);
  },

  getById: async (id: string): Promise<IServerResponse<ITeamMemberViewModel>> => {
    const response = await apiClient.get<IServerResponse<ITeamMemberViewModel>>(`${rootUrl}/${id}`);
    return response.data;
  },

  getAll: async (
    projectId: string | null = null
  ): Promise<IServerResponse<ITeamMemberViewModel[]>> => {
    const params = new URLSearchParams(projectId ? { project: projectId } : {});
    const url = `${rootUrl}/all${params.toString() ? '?' + params.toString() : ''}`;
    return dedupedGet<IServerResponse<ITeamMemberViewModel[]>>(url);
  },

  update: async (id: string, body: ITeamMemberCreateRequest): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/${id}`, body);
    clearTeamMembersCache();
    return response.data;
  },

  delete: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.delete<IServerResponse<any>>(`${rootUrl}/${id}`);
    clearTeamMembersCache();
    return response.data;
  },

  getTeamMembersByProjectId: async (projectId: string): Promise<IServerResponse<any[]>> => {
    const response = await apiClient.get<IServerResponse<any[]>>(`${rootUrl}/project/${projectId}`);
    return response.data;
  },

  resendInvitation: async (id: string): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/resend-invitation`, {
      id,
    });
    return response.data;
  },

  toggleMemberActiveStatus: async (
    id: string,
    active: boolean,
    email: string
  ): Promise<IServerResponse<any>> => {
    const params = new URLSearchParams({
      active: active.toString(),
      email,
    });
    const response = await apiClient.get<IServerResponse<any>>(
      `${rootUrl}/deactivate/${id}?${params}`
    );
    clearTeamMembersCache();
    return response.data;
  },

  addTeamMember: async (
    id: string,
    body: ITeamMemberCreateRequest
  ): Promise<IServerResponse<any>> => {
    const response = await apiClient.put<IServerResponse<any>>(`${rootUrl}/add-member/${id}`, body);
    clearTeamMembersCache();
    return response.data;
  },
};
