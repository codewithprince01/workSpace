import React from 'react';
import { Progress, Tooltip } from '@/shared/antd-imports';
import './task-list-progress-cell.css';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';

type TaskListProgressCellProps = {
  task: IProjectTask;
  groupBy?: string;
  groupName?: string;
};

const TaskListProgressCell = ({ task, groupBy, groupName }: TaskListProgressCellProps) => {
  const { status, statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const isManualProgressEnabled =
    task.project_use_manual_progress ||
    task.project_use_weighted_progress ||
    task.project_use_time_progress;
  const isSubtask = task.is_sub_task;
  const hasManualProgress = task.manual_progress;
  const normalizedStatusName = String(task.status_name || '').trim().toLowerCase();
  const normalizedStatusValue = String(task.status || '').trim().toLowerCase();

  const matchedStatus = status.find(
    s =>
      s.id === task.status_id ||
      s.name?.toLowerCase() === normalizedStatusValue
  );
  const matchedCategory = statusCategories.find(c => c.id === matchedStatus?.category_id);
  const categoryName = String(matchedCategory?.name || '').trim().toLowerCase();
  const normalizedGroupName = String(groupName || '')
    .trim()
    .toLowerCase();
  // Deep status resolution (stale-safe):
  // 1) Group (if grouped by status)
  // 2) Explicit UI labels from status_name (most reliable after done->todo flip)
  // 3) Explicit status value labels
  // 4) Canonical status category from status list
  const resolvedFlowState: 'todo' | 'doing' | 'done' = (() => {
    if (groupBy === 'status') {
      if (['to do', 'todo', 'to_do', 'pending'].includes(normalizedGroupName)) return 'todo';
      if (['in progress', 'in_progress', 'doing'].includes(normalizedGroupName)) return 'doing';
      if (['done', 'completed', 'complete'].includes(normalizedGroupName)) return 'done';
    }

    // Prefer human-readable status label first (prevents stale done check)
    if (['to do', 'todo', 'to_do', 'pending'].includes(normalizedStatusName)) return 'todo';
    if (['in progress', 'in_progress', 'doing'].includes(normalizedStatusName)) return 'doing';
    if (['done', 'completed', 'complete'].includes(normalizedStatusName)) return 'done';

    // Then raw status value label
    if (['to do', 'todo', 'to_do', 'pending'].includes(normalizedStatusValue)) return 'todo';
    if (['in progress', 'in_progress', 'doing'].includes(normalizedStatusValue)) return 'doing';
    if (['done', 'completed', 'complete'].includes(normalizedStatusValue)) return 'done';

    // Then category from status list
    if (categoryName === 'todo') return 'todo';
    if (categoryName === 'doing') return 'doing';
    if (categoryName === 'done') return 'done';

    return 'todo';
  })();
  const isDoneStatus = resolvedFlowState === 'done';
  const normalizePercent = (value: number | undefined | null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  };

  // Handle different cases:
  // 1. For subtasks when manual progress is enabled, show the progress
  // 2. For parent tasks, always show progress
  // 3. For subtasks when manual progress is not enabled, don't show progress (null)

  if (isSubtask && !isManualProgressEnabled) {
    return null; // Don't show progress for subtasks when manual progress is disabled
  }

  // For parent tasks, show completion ratio with task count tooltip
  if (!isSubtask) {
    const rawPercent = normalizePercent(task.complete_ratio ?? task.progress);
    // Prevent done-tick leakage for non-done statuses (common stale-data case from backend/socket).
    const percent = isDoneStatus ? 100 : rawPercent === 100 ? 0 : rawPercent;
    const isFullyCompleted = isDoneStatus && percent === 100;
    return (
      <Tooltip title={`${task.completed_count || 0} / ${task.total_tasks_count || 0}`}>
        <Progress
          percent={percent}
          status={isFullyCompleted ? 'success' : 'normal'}
          type="circle"
          size={24}
          style={{ cursor: 'default' }}
          strokeWidth={percent >= 100 ? 9 : 7}
        />
      </Tooltip>
    );
  }

  // For subtasks with manual progress enabled, show the progress
  const rawSubtaskPercent = isDoneStatus
    ? 100
    : hasManualProgress
      ? normalizePercent(task.progress_value)
      : normalizePercent(task.progress);
  const subtaskPercent = isDoneStatus ? 100 : rawSubtaskPercent === 100 ? 0 : rawSubtaskPercent;
  const isSubtaskFullyCompleted = isDoneStatus && subtaskPercent === 100;
  return (
    <Tooltip
      title={hasManualProgress ? `Manual: ${task.progress_value || 0}%` : `${task.progress || 0}%`}
    >
      <Progress
        percent={subtaskPercent}
        status={isSubtaskFullyCompleted ? 'success' : 'normal'}
        type="circle"
        size={22} // Slightly smaller for subtasks
        style={{ cursor: 'default' }}
        strokeWidth={subtaskPercent >= 100 ? 9 : 7}
      />
    </Tooltip>
  );
};

export default TaskListProgressCell;
