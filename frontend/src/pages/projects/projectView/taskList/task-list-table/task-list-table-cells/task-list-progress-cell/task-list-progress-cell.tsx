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
      s.id === task.status ||
      s.name?.toLowerCase() === normalizedStatusValue
  );
  const matchedCategory = statusCategories.find(c => c.id === matchedStatus?.category_id);
  const categoryName = String(matchedCategory?.name || '').trim().toLowerCase();
  const normalizedGroupName = String(groupName || '')
    .trim()
    .toLowerCase();
  const isDoneGroup = groupBy === 'status' && ['done', 'completed', 'complete'].includes(normalizedGroupName);
  // Prefer real status/category identifiers over status_name to avoid stale done labels.
  const isDoneStatus =
    isDoneGroup ||
    Boolean(task.status_category?.is_done) ||
    categoryName === 'done' ||
    ['done', 'completed', 'complete'].includes(normalizedStatusValue) ||
    (
      !task.status &&
      ['done', 'completed', 'complete'].includes(normalizedStatusName)
    );
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
    return (
      <Tooltip title={`${task.completed_count || 0} / ${task.total_tasks_count || 0}`}>
        <Progress
          percent={percent}
          status={isDoneStatus ? 'success' : 'normal'}
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
  return (
    <Tooltip
      title={hasManualProgress ? `Manual: ${task.progress_value || 0}%` : `${task.progress || 0}%`}
    >
      <Progress
        percent={subtaskPercent}
        status={isDoneStatus ? 'success' : 'normal'}
        type="circle"
        size={22} // Slightly smaller for subtasks
        style={{ cursor: 'default' }}
        strokeWidth={subtaskPercent >= 100 ? 9 : 7}
      />
    </Tooltip>
  );
};

export default TaskListProgressCell;
