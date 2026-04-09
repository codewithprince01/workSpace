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
    const q = toQueryString(config);
    const response = await apiClient.get(`${rootUrl}/list/v2/${config.id}${q}`);
    return response.data;
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
    try {
      const response = await apiClient.get(`${rootUrl}/list/v3/${config.id}${q}`);
      return response.data;
    } catch (error) {
      // Backward compatibility: some running backends expose only v2.
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }

      const fallbackResponse = await apiClient.get(`${rootUrl}/list/v2/${config.id}${q}`);
      const fallbackData = fallbackResponse.data as IServerResponse<any>;

      if (fallbackData?.body && !Array.isArray(fallbackData.body) && fallbackData.body.groups) {
        return fallbackData as IServerResponse<ITaskListV3Response>;
      }

      const fallbackGroups = Array.isArray(fallbackData?.body) ? fallbackData.body : [];
      const normalizedGroups = fallbackGroups.map((group: any) => {
        const tasks = Array.isArray(group?.tasks) ? group.tasks : [];
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
