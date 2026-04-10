import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { ITaskFormViewModel } from '@/types/tasks/task.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

interface ITaskDrawerState {
  selectedTaskId: string | null;
  showTaskDrawer: boolean;
  taskFormViewModel: ITaskFormViewModel | null;
  subscribers: InlineMember[];
  loadingTask: boolean;
  timeLogEditing: {
    isEditing: boolean;
    logBeingEdited: ITaskLogViewModel | null;
  };
}

const initialState: ITaskDrawerState = {
  selectedTaskId: null,
  showTaskDrawer: false,
  taskFormViewModel: null,
  subscribers: [],
  loadingTask: false,
  timeLogEditing: {
    isEditing: false,
    logBeingEdited: null,
  },
};

export const fetchTask = createAsyncThunk(
  'tasks/fetchTask',
  async ({ taskId, projectId }: { taskId: string; projectId: string }, { rejectWithValue }) => {
    const response = await tasksApiService.getFormViewModel(taskId, projectId);
    return response.body;
  }
);

const taskDrawerSlice = createSlice({
  name: 'taskDrawer',
  initialState,
  reducers: {
    setSelectedTaskId: (state, action) => {
      state.selectedTaskId = action.payload;
    },
    setShowTaskDrawer: (state, action) => {
      state.showTaskDrawer = action.payload;
    },
    setTaskFormViewModel: (state, action) => {
      state.taskFormViewModel = action.payload;
    },
    setLoadingTask: (state, action) => {
      state.loadingTask = action.payload;
    },
    setTaskStatus: (state, action: PayloadAction<ITaskListStatusChangeResponse>) => {
      const { status_id, color_code, id: taskId, color_code_dark } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.status_id = status_id;
        state.taskFormViewModel.task.status_color = color_code;
        state.taskFormViewModel.task.status_color_dark = color_code_dark;
      }
    },
    setStartDate: (state, action: PayloadAction<IProjectTask>) => {
      const { start_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.start_date = start_date;
      }
    },
    setTaskEndDate: (state, action: PayloadAction<IProjectTask>) => {
      const { end_date, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.end_date = end_date;
      }
    },
    setTaskAssignee: (state, action: PayloadAction<IProjectTask>) => {
      const { assignees, id: taskId, names } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.assignees = (assignees || []).map(m => m.team_member_id);
        state.taskFormViewModel.task.names = names;
      }
    },
    setTaskPriority: (state, action: PayloadAction<ITaskListPriorityChangeResponse>) => {
      const { priority_id, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.priority_id = priority_id;
      }
    },
    setTaskLabels: (state, action: PayloadAction<ILabelsChangeResponse>) => {
      const { all_labels, labels, id: taskId } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.labels = all_labels || labels || [];
      }
    },
    setTaskSubscribers: (state, action: PayloadAction<InlineMember[]>) => {
      state.subscribers = action.payload;
    },
    setTaskPhase: (state, action: PayloadAction<{ id: string; phase_id: string; phase_name: string; phase_color: string }>) => {
      const { id: taskId, phase_id, phase_name, phase_color } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.phase_id = phase_id;
        state.taskFormViewModel.task.phase_name = phase_name;
        state.taskFormViewModel.task.phase_color = phase_color;
      }
    },
    setTaskDescription: (state, action: PayloadAction<{ id: string; description: string }>) => {
      const { id: taskId, description } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.description = description;
      }
    },
    setTaskBillable: (state, action: PayloadAction<{ id: string; billable: boolean }>) => {
      const { id: taskId, billable } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.billable = billable;
      }
    },
    setTaskEstimation: (state, action: PayloadAction<{ id: string; total_hours: number; total_minutes: number }>) => {
      const { id: taskId, total_hours, total_minutes } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === taskId) {
        state.taskFormViewModel.task.total_hours = total_hours;
        state.taskFormViewModel.task.total_minutes = total_minutes;
      }
    },
    setTaskProgress: (state, action: PayloadAction<{ task_id: string; progress_value: number }>) => {
      const { task_id, progress_value } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === task_id) {
        state.taskFormViewModel.task.progress_value = progress_value;
      }
    },
    setTimeLogEditing: (
      state,
      action: PayloadAction<{
        isEditing: boolean;
        logBeingEdited: ITaskLogViewModel | null;
      }>
    ) => {
      state.timeLogEditing = action.payload;
    },
    setTaskRecurringSchedule: (
      state,
      action: PayloadAction<{
        schedule_id: string;
        task_id: string;
      }>
    ) => {
      const { schedule_id, task_id } = action.payload;
      if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === task_id) {
        state.taskFormViewModel.task.schedule_id = schedule_id;
      }
    },
    resetTaskDrawer: state => {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchTask.pending, state => {
      state.loadingTask = true;
    }),
      builder.addCase(fetchTask.fulfilled, (state, action) => {
        state.loadingTask = false;
        state.taskFormViewModel = action.payload;
      }),
      builder.addCase(fetchTask.rejected, (state, action) => {
        state.loadingTask = false;
      });
  },
});

export const {
  setSelectedTaskId,
  setShowTaskDrawer,
  setTaskFormViewModel,
  setLoadingTask,
  setTaskStatus,
  setStartDate,
  setTaskEndDate,
  setTaskAssignee,
  setTaskPriority,
  setTaskLabels,
  setTaskSubscribers,
  setTimeLogEditing,
  setTaskRecurringSchedule,
  resetTaskDrawer,
  setConvertToSubtaskDrawerOpen,
  setTaskPhase,
  setTaskDescription,
  setTaskBillable,
  setTaskEstimation,
  setTaskProgress,
} = taskDrawerSlice.actions;
export default taskDrawerSlice.reducer;
