import React from 'react';
import TaskTimer from '@/components/taskListCommon/task-timer/task-timer';
import { useTaskTimerWithConflictCheck } from '@/hooks/useTaskTimerWithConflictCheck';

interface TaskTimeTrackingProps {
  taskId: string;
  timerStartTime?: string | number | null;
  isDarkMode: boolean;
}

const TaskTimeTracking: React.FC<TaskTimeTrackingProps> = React.memo(({ taskId, timerStartTime = null, isDarkMode }) => {
  const { started, timeString, handleStartTimer, handleStopTimer } = useTaskTimerWithConflictCheck(
    taskId,
    timerStartTime !== undefined && timerStartTime !== null ? String(timerStartTime) : null
  );

  return (
    <TaskTimer
      taskId={taskId}
      started={started}
      handleStartTimer={handleStartTimer}
      handleStopTimer={handleStopTimer}
      timeString={timeString}
    />
  );
});

TaskTimeTracking.displayName = 'TaskTimeTracking';

export default TaskTimeTracking; 
