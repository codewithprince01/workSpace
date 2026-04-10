import {
  ITaskListColumn,
  ITaskListGroup,
  ITaskListMemberFilter,
} from '@/types/tasks/taskList.types';
import axios from 'axios';
import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITaskFormViewModel, ITaskViewModel } from '@/types/tasks/task.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

const rootUrl = `${API_BASE_URL}/tasks`;
// This backend instance may not expose /list/v3 or /list/v2 consistently.
// Start from generic to avoid noisy 404 retries in console.
let preferredTaskListEndpoint: 'v3' | 'v2' | 'generic' = 'generic';

export interface ITaskListConfigV2 {
  id: string;
  field: string | null;
  order: string | null;
  search: string | null;
  statuses: string | null;
  members: string | null;
  projects: string | null;
  labels?: string | null;
  priorities?: string | null;
  archived?: boolean;
  count?: boolean;
  parent_task?: string;
  group?: string;
  isSubtasksInclude: boolean;
  include_empty?: string; // Include empty groups in response
  customColumns?: boolean; // Include custom column values in response
}

export interface ITaskListV3Response {
  groups: Array<{
    id: string;
    title: string;
    groupType: 'status' | 'priority' | 'phase';
    groupValue: string;
    collapsed: boolean;
    tasks: any[];
    taskIds: string[];
    color: string;
  }>;
  allTasks: any[];
  grouping: string;
  totalTasks: number;
}

export const tasksApiService = {
  getTaskList: async (config: ITaskListConfigV2): Promise<IServerResponse<ITaskListGroup[]>> => {
    const response = await tasksApiService.getTaskListV3(config);
    const groups = (response?.body?.groups || []).map((group: any) => ({
      ...group,
      name: group?.title || group?.name || '',
    }));

    return {
      done: Boolean(response?.done ?? true),
      title: response?.title,
      message: response?.message,
      body: groups,
    } as IServerResponse<ITaskListGroup[]>;
  },

  fetchTaskAssignees: async (
    projectId: string
  ): Promise<IServerResponse<ITeamMemberViewModel[]>> => {
    const response = await apiClient.get(`${rootUrl}/assignees/${projectId}`);
    return response.data;
  },

  fetchTaskListColumns: async (projectId: string): Promise<IServerResponse<ITaskListColumn[]>> => {
    const response = await apiClient.get(`${rootUrl}/list/columns/${projectId}`);
    return response.data;
  },

  getFormViewModel: async (
    taskId: string | null,
    projectId: string | null
  ): Promise<IServerResponse<ITaskFormViewModel>> => {
    const params = [];
    if (taskId) params.push(`task_id=${taskId}`);
    if (projectId) params.push(`project_id=${projectId}`);
    const q = params.length ? `?${params.join('&')}` : '';
    const response = await apiClient.get(`${rootUrl}/info${q}`);
    return response.data;
  },

  deleteTask: async (taskId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.delete(`${rootUrl}/${taskId}`);
    return response.data;
  },

  toggleColumnVisibility: async (
    projectId: string,
    item: ITaskListColumn
  ): Promise<IServerResponse<ITaskListColumn>> => {
    const response = await apiClient.put(`${rootUrl}/list/columns/${projectId}`, item);
    return response.data;
  },

  getSubscribers: async (taskId: string): Promise<IServerResponse<InlineMember[]>> => {
    const response = await apiClient.get(`${rootUrl}/subscribers/${taskId}`);
    return response.data;
  },

  convertToSubtask: async (
    taskId: string,
    projectId: string,
    parentTaskId: string,
    groupBy: string,
    toGroupId: string
  ): Promise<IServerResponse<void>> => {
    const response = await apiClient.post(`${rootUrl}/convert-to-subtask`, {
      id: taskId,
      project_id: projectId,
      parent_task_id: parentTaskId,
      group_by: groupBy,
      to_group_id: toGroupId,
    });
    return response.data;
  },

  convertToTask: async (taskId: string, projectId: string): Promise<IServerResponse<void>> => {
    const response = await apiClient.post(`${rootUrl}/convert`, {
      id: taskId,
      project_id: projectId,
    });
    return response.data;
  },

  searchTask: async (
    taskId: string,
    projectId: string,
    searchQuery: string
  ): Promise<IServerResponse<{ label: string; value: string }[]>> => {
    const q = toQueryString({ taskId, projectId, searchQuery });
    const response = await apiClient.get(`${rootUrl}/search${q}`);
    return response.data;
  },

  getTaskDependencyStatus: async (
    taskId: string,
    statusId: string
  ): Promise<IServerResponse<{ can_continue: boolean }>> => {
    const q = toQueryString({ taskId, statusId });
    const response = await apiClient.get(`${rootUrl}/dependency-status${q}`);
    return response.data;
  },

  getTaskListV3: async (
    config: ITaskListConfigV2
  ): Promise<IServerResponse<ITaskListV3Response>> => {
    const q = toQueryString({ ...config, include_empty: 'true' });
    const silentErrorConfig = { headers: { 'X-Skip-Error-Alert': 'true' } };

    const normalizeTask = (task: any) => {
      const taskId = String(task?.id ?? task?._id ?? '');
      const statusObj =
        task?.status_id && typeof task.status_id === 'object' ? task.status_id : undefined;
      const phaseObj =
        task?.phase_id && typeof task.phase_id === 'object' ? task.phase_id : undefined;
      const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
      const normalizedAssignees = assignees.map((a: any) => ({
        ...a,
        id: String(a?.id ?? a?._id ?? a?.team_member_id ?? ''),
        team_member_id: String(a?.team_member_id ?? a?.id ?? a?._id ?? ''),
        name: a?.name || '',
        avatar_url: a?.avatar_url || '',
      }));
      const normalizedAssigneeNames = (Array.isArray(task?.assignee_names) && task.assignee_names.length
        ? task.assignee_names
        : normalizedAssignees
      ).map((a: any) => ({
        team_member_id: String(a?.team_member_id ?? a?.id ?? a?._id ?? ''),
        id: String(a?.id ?? a?._id ?? a?.team_member_id ?? ''),
        name: a?.name || '',
        avatar_url: a?.avatar_url || '',
      }));
      const labels = Array.isArray(task?.labels) ? task.labels : [];

      return {
        ...task,
        id: taskId,
        title: task?.title || task?.name || 'Untitled Task',
        status: String(task?.status ?? statusObj?._id ?? task?.status_id ?? ''),
        status_id: String(task?.status_id?._id ?? task?.status_id ?? ''),
        status_name: task?.status_name || statusObj?.name || '',
        status_color: task?.status_color || statusObj?.color_code || '#cccccc',
        phase_id: String(task?.phase_id?._id ?? task?.phase_id ?? ''),
        phase_name: task?.phase_name || phaseObj?.name || '',
        phase_color: task?.phase_color || phaseObj?.color_code || '',
        assignees: normalizedAssignees,
        assignee_names: normalizedAssigneeNames,
        names: normalizedAssigneeNames,
        labels: labels.map((l: any) => ({
          ...l,
          id: String(l?.id ?? l?._id ?? ''),
          name: l?.name || '',
          color: l?.color || l?.color_code || '#cccccc',
          color_code: l?.color_code || l?.color || '#cccccc',
        })),
        all_labels: labels.map((l: any) => ({
          id: String(l?.id ?? l?._id ?? ''),
          name: l?.name || '',
          color_code: l?.color_code || l?.color || '#cccccc',
        })),
      };
    };

    const buildGroupsFromTasks = async (tasks: any[]) => {
      const grouping = config.group || 'status';
      const normalizedTasks = tasks.map(normalizeTask);
      const map = new Map<string, { id: string; title: string; color: string; tasks: any[] }>();

      const ensureGroup = (id: string, title: string, color: string) => {
        if (!map.has(id)) {
          map.set(id, { id, title, color, tasks: [] });
        }
        return map.get(id)!;
      };

      normalizedTasks.forEach(task => {
        if (grouping === 'priority') {
          const id = String(task?.priority || 'medium');
          const title = id.charAt(0).toUpperCase() + id.slice(1);
          const color =
            id === 'urgent'
              ? '#f50'
              : id === 'high'
                ? '#ff9800'
                : id === 'medium'
                  ? '#2db7f5'
                  : '#87d068';
          ensureGroup(id, title, color).tasks.push(task);
          return;
        }

        if (grouping === 'phase') {
          const id = String(task?.phase_id || 'no-phase');
          const title = task?.phase_name || 'No Phase';
          const color = task?.phase_color || '#cccccc';
          ensureGroup(id, title, color).tasks.push(task);
          return;
        }

        if (grouping === 'members') {
          if (!task.assignees?.length) {
            ensureGroup('unassigned', 'Unassigned', '#cccccc').tasks.push(task);
            return;
          }

          task.assignees.forEach((a: any) => {
            const id = String(a?.id || a?.team_member_id || 'unknown-member');
            const title = a?.name || 'Unknown Member';
            ensureGroup(id, title, '#1890ff').tasks.push(task);
          });
          return;
        }

        const id = String(task?.status_id || task?.status || 'unmapped-status');
        const title = task?.status_name || 'Unmapped Status';
        const color = task?.status_color || '#cccccc';
        ensureGroup(id, title, color).tasks.push(task);
      });

      // When grouped by status, include all project statuses even if they have no tasks.
      if (grouping === 'status') {
        try {
          const statusesResponse = await apiClient.get(
            `${API_BASE_URL}/project-statuses?project_id=${encodeURIComponent(config.id)}`,
            silentErrorConfig
          );
          const statuses = Array.isArray(statusesResponse?.data?.body)
            ? statusesResponse.data.body
            : [];

          statuses.forEach((status: any) => {
            const statusId = String(status?.id ?? status?._id ?? '');
            if (!statusId) return;
            const statusTitle = String(status?.name ?? 'Untitled Status');
            const statusColor = String(status?.color_code ?? '#cccccc');
            ensureGroup(statusId, statusTitle, statusColor);
          });

          const ordered = [...statuses]
            .sort(
              (a: any, b: any) =>
                Number(a?.sort_order ?? Number.MAX_SAFE_INTEGER) -
                Number(b?.sort_order ?? Number.MAX_SAFE_INTEGER)
            )
            .map((s: any) => String(s?.id ?? s?._id ?? ''))
            .filter(Boolean);

          const grouped = Array.from(map.values());
          grouped.sort((a, b) => {
            const ai = ordered.indexOf(a.id);
            const bi = ordered.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });

          return grouped.map(group => ({
            id: group.id,
            title: group.title,
            groupType: grouping as 'status' | 'priority' | 'phase',
            groupValue: group.id,
            collapsed: false,
            tasks: group.tasks,
            taskIds: group.tasks.map((task: any) => String(task?.id ?? '')),
            color: group.color,
          }));
        } catch {
          // If statuses lookup fails, keep task-derived grouping.
        }
      }

      return Array.from(map.values()).map(group => ({
        id: group.id,
        title: group.title,
        groupType: grouping as 'status' | 'priority' | 'phase',
        groupValue: group.id,
        collapsed: false,
        tasks: group.tasks,
        taskIds: group.tasks.map((task: any) => String(task?.id ?? '')),
        color: group.color,
      }));
    };

    const normalizeFallbackListData = (fallbackData: IServerResponse<any>) => {
      if (fallbackData?.body && !Array.isArray(fallbackData.body) && fallbackData.body.groups) {
        return fallbackData as IServerResponse<ITaskListV3Response>;
      }

      const fallbackGroups = Array.isArray(fallbackData?.body) ? fallbackData.body : [];
      const normalizedGroups = fallbackGroups.map((group: any) => {
        const tasks = Array.isArray(group?.tasks) ? group.tasks.map(normalizeTask) : [];
        return {
          id: String(group?.id ?? group?._id ?? ''),
          title: String(group?.title ?? group?.name ?? 'Tasks'),
          groupType: (config.group as 'status' | 'priority' | 'phase') || 'status',
          groupValue: String(group?.id ?? group?._id ?? ''),
          collapsed: false,
          tasks,
          taskIds: tasks.map((task: any) => String(task?.id ?? task?._id ?? '')),
          color: String(group?.color ?? group?.color_code ?? '#cccccc'),
        };
      });

      const allTasks = normalizedGroups.flatMap((group: any) => group.tasks || []);

      return {
        done: Boolean(fallbackData?.done ?? true),
        title: fallbackData?.title,
        message: fallbackData?.message,
        body: {
          groups: normalizedGroups,
          allTasks,
          grouping: config.group || 'status',
          totalTasks: allTasks.length,
        },
      };
    };

    const fetchGenericAndBuild = async () => {
      const genericQuery = toQueryString({
        project_id: config.id,
        search: config.search || '',
        parent_task_id: config.parent_task || '',
      });
      const genericResponse = await apiClient.get(`${rootUrl}${genericQuery}`, silentErrorConfig);
      const genericData = genericResponse.data as IServerResponse<any[]>;
      const tasks = Array.isArray(genericData?.body) ? genericData.body : [];
      const groups = await buildGroupsFromTasks(tasks);
      const allTasks = groups.flatMap(group => group.tasks);

      return {
        done: Boolean(genericData?.done ?? true),
        title: genericData?.title,
        message: genericData?.message,
        body: {
          groups,
          allTasks,
          grouping: config.group || 'status',
          totalTasks: allTasks.length,
        },
      };
    };

    // Force generic endpoint in this environment to avoid repeated v3/v2 404 noise.
    return fetchGenericAndBuild();

    if (preferredTaskListEndpoint === 'generic') {
      return fetchGenericAndBuild();
    }

    if (preferredTaskListEndpoint === 'v2') {
      try {
        const response = await apiClient.get(`${rootUrl}/list/v2/${config.id}${q}`, silentErrorConfig);
        return normalizeFallbackListData(response.data as IServerResponse<any>);
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
        preferredTaskListEndpoint = 'generic';
        return fetchGenericAndBuild();
      }
    }

    // Default path: try v3 first, then fallback and remember working endpoint.
    try {
      const response = await apiClient.get(`${rootUrl}/list/v3/${config.id}${q}`, silentErrorConfig);
      preferredTaskListEndpoint = 'v3';
      return response.data;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
      try {
        const fallbackResponse = await apiClient.get(
          `${rootUrl}/list/v2/${config.id}${q}`,
          silentErrorConfig
        );
        preferredTaskListEndpoint = 'v2';
        return normalizeFallbackListData(fallbackResponse.data as IServerResponse<any>);
      } catch (v2Error) {
        if (!axios.isAxiosError(v2Error) || v2Error.response?.status !== 404) {
          throw v2Error;
        }
        preferredTaskListEndpoint = 'generic';
        return fetchGenericAndBuild();
      }
    }
  },

  refreshTaskProgress: async (projectId: string): Promise<IServerResponse<{ message: string }>> => {
    const response = await apiClient.post(`${rootUrl}/refresh-progress/${projectId}`);
    return response.data;
  },

  getTaskProgressStatus: async (
    projectId: string
  ): Promise<
    IServerResponse<{
      projectId: string;
      totalTasks: number;
      completedTasks: number;
      avgProgress: number;
      lastUpdated: string;
      completionPercentage: number;
    }>
  > => {
    const response = await apiClient.get(`${rootUrl}/progress-status/${projectId}`);
    return response.data;
  },

  // API method to reorder tasks
  reorderTasks: async (params: {
    taskIds: string[];
    newOrder: number[];
    projectId: string;
  }): Promise<IServerResponse<{ done: boolean }>> => {
    const response = await apiClient.post(`${rootUrl}/reorder`, {
      task_ids: params.taskIds,
      new_order: params.newOrder,
      project_id: params.projectId,
    });
    return response.data;
  },

  // API method to update task group (status, priority, phase)
  updateTaskGroup: async (params: {
    taskId: string;
    groupType: 'status' | 'priority' | 'phase';
    groupValue: string;
    projectId: string;
  }): Promise<IServerResponse<{ done: boolean }>> => {
    const response = await apiClient.put(`${rootUrl}/${params.taskId}/group`, {
      group_type: params.groupType,
      group_value: params.groupValue,
      project_id: params.projectId,
    });
    return response.data;
  },
};
