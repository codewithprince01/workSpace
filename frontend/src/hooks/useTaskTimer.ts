import { useState, useEffect, useCallback, useRef } from 'react';
import { buildTimeString } from '@/utils/timeUtils';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskTimeTracking, updateTaskLoggedTime } from '@/features/tasks/tasks.slice';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectTaskById } from '@/features/task-management/task-management.slice';

export const useTaskTimer = (taskId: string, initialStartTime: number | null) => {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const DEFAULT_TIME_LEFT = buildTimeString(0, 0, 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false); // Track if we've initialized

  const activeTimers = useAppSelector(state => state.taskReducer.activeTimers);
  const task = useAppSelector(state => selectTaskById(state, taskId));
  
  // Check both the old slice (activeTimers) and new slice (task.timeTracking.activeTimer)
  const reduxStartTime = activeTimers[taskId] || task?.timeTracking?.activeTimer;
  const started = Boolean(reduxStartTime);

  const [timeString, setTimeString] = useState(DEFAULT_TIME_LEFT);
  const [localStarted, setLocalStarted] = useState(false);

  const timerTick = useCallback(() => {
    if (!reduxStartTime) return;
    const now = Date.now();
    const sessionDiff = Math.floor((now - reduxStartTime) / 1000);

    // Calculate total cumulative time
    let totalLoggedHours = 0;
    if (task?.total_logged_time) {
      totalLoggedHours = typeof task.total_logged_time === 'number' 
        ? task.total_logged_time 
        : parseFloat(task.total_logged_time);
    } else if (task?.timeTracking?.total) { // Fallback to timeTracking total
       totalLoggedHours = parseFloat(task.timeTracking.total);
    }

    const totalSeconds = Math.floor(totalLoggedHours * 3600) + sessionDiff;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    setTimeString(buildTimeString(hours, minutes, seconds));
  }, [reduxStartTime, task?.total_logged_time, task?.timeTracking?.total]);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [taskId]);

  const resetTimer = useCallback(() => {
    clearTimerInterval();
    setTimeString(DEFAULT_TIME_LEFT);
    setLocalStarted(false);
  }, [clearTimerInterval, taskId]);

  // Timer management effect
  useEffect(() => {
    if (started && reduxStartTime) {
      // Sync local state with Redux state
      if (!localStarted) {
        setLocalStarted(true);
      }
      clearTimerInterval();
      timerTick();
      intervalRef.current = setInterval(timerTick, 1000);
    } else {
      clearTimerInterval();
      setTimeString(DEFAULT_TIME_LEFT);
      if (started !== localStarted) {
        setLocalStarted(started);
      }
    }

    return () => {
      clearTimerInterval();
    };
  }, [reduxStartTime, started, localStarted, timerTick, clearTimerInterval, taskId]);

  // Initialize timer only on first mount if Redux is unset
  useEffect(() => {
    if (!hasInitialized.current && initialStartTime && reduxStartTime === undefined) {
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: initialStartTime }));
      setLocalStarted(true);
    } else if (reduxStartTime && !localStarted) {
      setLocalStarted(true);
    }
    hasInitialized.current = true; // Mark as initialized
  }, [initialStartTime, reduxStartTime, taskId, dispatch]);

  const handleStartTimer = useCallback(() => {
    if (started || !taskId) return;
    try {
      const now = Date.now();

      dispatch(updateTaskTimeTracking({ taskId, timeTracking: now }));
      setLocalStarted(true);
      socket?.emit(SocketEvents.TASK_TIMER_START.toString(), JSON.stringify({ task_id: taskId }));
    } catch (error) {
      logger.error('Error starting timer:', error);
    }
  }, [taskId, started, socket, dispatch]);

  const handleStopTimer = useCallback(() => {
    if (!taskId) return;

    resetTimer();
    socket?.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
    dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
  }, [taskId, socket, dispatch, resetTimer]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimerStop = (data: string | any) => {
      try {
        const dataObj = typeof data === 'string' ? JSON.parse(data) : data;
        const { task_id, duration_hours } = dataObj;
        
        if (task_id === taskId) {
          resetTimer();
          dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
          if (duration_hours) {
             dispatch(updateTaskLoggedTime({ taskId, addedHours: duration_hours }));
          }
        }
      } catch (error) {
        logger.error('Error parsing timer stop event:', error);
      }
    };

    const handleTimerStart = (data: string) => {
      try {
        const { task_id, start_time } = typeof data === 'string' ? JSON.parse(data) : data;
        if (task_id === taskId && start_time) {
          const time = typeof start_time === 'number' ? start_time : parseInt(start_time);

          dispatch(updateTaskTimeTracking({ taskId, timeTracking: time }));
          setLocalStarted(true);
        }
      } catch (error) {
        logger.error('Error parsing timer start event:', error);
      }
    };

    socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
    socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);

    return () => {
      socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
    };
  }, [socket, taskId, dispatch, resetTimer]);

  return {
    started,
    timeString,
    handleStartTimer,
    handleStopTimer,
  };
};
