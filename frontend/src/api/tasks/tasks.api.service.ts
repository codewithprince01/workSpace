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
let preferredTaskListEndpoint: 'v3' | 'v2' | 'generic' = 'v3';

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
    let groups = (response?.body?.groups || []).map((group: any) => ({
      ...group,
      name: group?.title || group?.name || '',
    }));

    // Live-safe fallback: always show default status groups if backend returns empty status groups.
    if ((!groups || groups.length === 0) && (config.group || 'status') === 'status') {
      groups = [
        {
          id: 'default-status-todo',
          title: 'To Do',
          name: 'To Do',
          groupType: 'status',
          groupValue: 'todo',
          collapsed: false,
          tasks: [],
          taskIds: [],
          color: '#75c9c0',
        },
        {
          id: 'default-status-doing',
          title: 'In Progress',
          name: 'In Progress',
          groupType: 'status',
          groupValue: 'doing',
          collapsed: false,
          tasks: [],
          taskIds: [],
          color: '#3b7ad4',
        },
        {
          id: 'default-status-done',
          title: 'Done',
          name: 'Done',
          groupType: 'status',
          groupValue: 'done',
          collapsed: false,
          tasks: [],
          taskIds: [],
          color: '#70a6f3',
        },
      ] as any;
    }

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
    const q = toQueryString({
      ...config,
      group_by: config.group || 'status',
      include_empty: 'true',
    });
    const silentErrorConfig = { skipErrorAlert: true } as any;

    const normalizeTask = (task: any) => {
      const taskId = String(task?.id ?? task?._id ?? '');
      const rawParentTaskId = task?.parent_task_id ?? task?.parentTaskId ?? task?.parent_task ?? null;
      const normalizedParentTaskId =
        rawParentTaskId && typeof rawParentTaskId === 'object'
          ? String(rawParentTaskId?._id ?? rawParentTaskId?.id ?? '')
          : rawParentTaskId
            ? String(rawParentTaskId)
            : null;
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
      const toNumber = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        if (value && typeof value === 'object') {
          const hours = Number((value as any).hours || 0);
          const minutes = Number((value as any).minutes || 0);
          if (Number.isFinite(hours) || Number.isFinite(minutes)) {
            return (Number.isFinite(hours) ? hours : 0) + (Number.isFinite(minutes) ? minutes : 0) / 60;
          }
        }
        return 0;
      };

      const estimatedHours =
        toNumber(task?.timeTracking?.estimated) ||
        toNumber(task?.estimated_hours) ||
        toNumber(task?.total_time);
      const loggedHours =
        toNumber(task?.timeTracking?.logged) ||
        toNumber(task?.total_logged_time) ||
        toNumber(task?.time_spent) ||
        toNumber(task?.total_minutes_spent) / 60;
      const commentsCount = Number(
        task?.comments_count ?? task?.comment_count ?? task?.commentsCount ?? 0
      );
      const attachmentsCount = Number(
        task?.attachments_count ?? task?.attachment_count ?? task?.attachmentsCount ?? 0
      );
      const hasSubscribers = Boolean(
        task?.has_subscribers ??
          task?.hasSubscribers ??
          ((task?.subscribers_count ?? task?.subscribersCount ?? 0) > 0)
      );
      const hasDependencies = Boolean(
        task?.has_dependencies ??
          task?.hasDependencies ??
          ((task?.dependencies_count ?? task?.dependenciesCount ?? 0) > 0)
      );
      const scheduleId = task?.schedule_id ?? task?.scheduleId ?? null;

      return {
        ...task,
        id: taskId,
        parent_task_id: normalizedParentTaskId,
        parent_task: normalizedParentTaskId,
        title: task?.title || task?.name || 'Untitled Task',
        status: String(task?.status ?? statusObj?._id ?? task?.status_id ?? ''),
        status_id: String(task?.status_id?._id ?? task?.status_id ?? ''),
        status_name: task?.status_name || statusObj?.name || '',
        status_color: task?.status_color || statusObj?.color_code || '#cccccc',
        phase_id: String(task?.phase_id?._id ?? task?.phase_id ?? ''),
        phase_name: task?.phase_name || phaseObj?.name || '',
        phase_color: task?.phase_color || phaseObj?.color_code || '',
        task_key: task?.task_key || task?.key || '',
        dueDate: task?.dueDate || task?.due_date || task?.end_date || undefined,
        due_date: task?.due_date || task?.dueDate || task?.end_date || undefined,
        startDate: task?.startDate || task?.start_date || undefined,
        start_date: task?.start_date || task?.startDate || undefined,
        end_date: task?.end_date || task?.due_date || task?.dueDate || undefined,
        createdAt: task?.createdAt || task?.created_at || undefined,
        updatedAt: task?.updatedAt || task?.updated_at || undefined,
        created_at: task?.created_at || task?.createdAt || undefined,
        updated_at: task?.updated_at || task?.updatedAt || undefined,
        progress:
          typeof task?.progress === 'number'
            ? task.progress
            : typeof task?.complete_ratio === 'number'
              ? task.complete_ratio
              : 0,
        timer_start_time: task?.timer_start_time || null,
        timeTracking: {
          estimated: estimatedHours,
          logged: loggedHours,
          activeTimer: task?.timeTracking?.activeTimer ?? task?.timer_start_time ?? null,
        },
        assignees: normalizedAssignees,
        assignee_names: normalizedAssigneeNames,
        names: normalizedAssigneeNames,
        labels: labels.map((l: any) => ({
          ...l,
          id: String(l?.id ?? l?.label_id ?? l?._id ?? ''),
          name: l?.name || '',
          color: l?.color || l?.color_code || '#cccccc',
          color_code: l?.color_code || l?.color || '#cccccc',
        })),
        all_labels: labels.map((l: any) => ({
          id: String(l?.id ?? l?.label_id ?? l?._id ?? ''),
          name: l?.name || '',
          color_code: l?.color_code || l?.color || '#cccccc',
        })),
        reporter:
          task?.reporter ||
          task?.reporter_name ||
          task?.reporter_id?.name ||
          null,
        reporter_id:
          typeof task?.reporter_id === 'object'
            ? String(task?.reporter_id?._id ?? task?.reporter_id?.id ?? '')
            : task?.reporter_id
              ? String(task?.reporter_id)
              : null,
        comments_count: Number.isFinite(commentsCount) ? commentsCount : 0,
        attachments_count: Number.isFinite(attachmentsCount) ? attachmentsCount : 0,
        has_subscribers: hasSubscribers,
        has_dependencies: hasDependencies,
        schedule_id: scheduleId,
        completedAt: task?.completedAt || task?.completed_at || null,
        completed_at: task?.completed_at || task?.completedAt || null,
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

          const validStatusIds = new Set(ordered);
          const grouped = Array.from(map.values());
          const remappedGroups: typeof grouped = grouped.filter(group => validStatusIds.has(group.id));
          const primaryStatusId = ordered[0] || '';
          const primaryGroup = remappedGroups.find(group => group.id === primaryStatusId);

          // Move tasks from deleted/missing status groups into the first valid status,
          // so "Unmapped Status" group does not appear in task list.
          let fallbackGroup = grouped.find(group => group.id === 'unmapped-status');
          if (!fallbackGroup) {
            fallbackGroup = { id: 'unmapped-status', title: 'Unmapped Status', color: '#cccccc', tasks: [] };
          }

          grouped.forEach(group => {
            if (validStatusIds.has(group.id)) return;

            if (primaryGroup) {
              const remappedTasks = group.tasks.map((task: any) => ({
                ...task,
                status_id: primaryGroup.id,
                status: primaryGroup.id,
                status_name: primaryGroup.title,
                status_color: primaryGroup.color,
              }));
              primaryGroup.tasks.push(...remappedTasks);
            } else {
              fallbackGroup!.tasks.push(...group.tasks);
            }
          });

          if (!primaryGroup && fallbackGroup.tasks.length > 0) {
            remappedGroups.push(fallbackGroup);
          }

          remappedGroups.sort((a, b) => {
            const ai = ordered.indexOf(a.id);
            const bi = ordered.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });

          return remappedGroups.map(group => ({
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
        priorities: config.priorities,
        members: config.members,
        labels: config.labels,
        statuses: config.statuses,
        archived: Boolean(config.archived),
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

    const fetchV3 = async () => {
      const response = await apiClient.get(`/tasks/list/v3/${config.id}${q}`, silentErrorConfig);
      const data = response.data as IServerResponse<ITaskListV3Response>;
      const groups = Array.isArray(data?.body?.groups)
        ? data.body.groups.map((group: any) => {
            const tasks = Array.isArray(group?.tasks) ? group.tasks.map(normalizeTask) : [];
            return {
              ...group,
              title: group?.title || group?.name || '',
              name: group?.name || group?.title || '',
              tasks,
              taskIds: tasks.map((task: any) => String(task?.id ?? '')),
            };
          })
        : [];
      const allTasks = Array.isArray(data?.body?.allTasks)
        ? data.body.allTasks.map(normalizeTask)
        : groups.flatMap((group: any) => group.tasks || []);

      return {
        ...data,
        body: {
          ...(data?.body || {}),
          groups,
          allTasks,
          totalTasks:
            typeof data?.body?.totalTasks === 'number' ? data.body.totalTasks : allTasks.length,
        },
      } as IServerResponse<ITaskListV3Response>;
    };

    const fetchV2 = async () => {
      const response = await apiClient.get(`${rootUrl}/list/v2/${config.id}${q}`, silentErrorConfig);
      return normalizeFallbackListData(response.data as IServerResponse<any>);
    };

    if (preferredTaskListEndpoint === 'generic') {
      try {
        return await fetchGenericAndBuild();
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
        try {
          const v3 = await fetchV3();
          preferredTaskListEndpoint = 'v3';
          return v3;
        } catch (v3Error) {
          if (!axios.isAxiosError(v3Error) || v3Error.response?.status !== 404) throw v3Error;
          const v2 = await fetchV2();
          preferredTaskListEndpoint = 'v2';
          return v2;
        }
      }
    }

    if (preferredTaskListEndpoint === 'v2') {
      try {
        return await fetchV2();
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
        try {
          const generic = await fetchGenericAndBuild();
          preferredTaskListEndpoint = 'generic';
          return generic;
        } catch (genericError) {
          if (!axios.isAxiosError(genericError) || genericError.response?.status !== 404) {
            throw genericError;
          }
          const v3 = await fetchV3();
          preferredTaskListEndpoint = 'v3';
          return v3;
        }
      }
    }

    // Default path: try v3 first, then fallback and remember working endpoint.
    try {
      const response = await fetchV3();
      preferredTaskListEndpoint = 'v3';
      return response;
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        throw error;
      }
      try {
        const fallbackResponse = await fetchV2();
        preferredTaskListEndpoint = 'v2';
        return fallbackResponse;
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

  create: async (task: any): Promise<IServerResponse<any>> => {
    const response = await apiClient.post(rootUrl, task);
    return response.data;
  },
};
