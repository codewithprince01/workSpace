import { ClockCircleOutlined, StopOutlined, PlayCircleFilled } from '@/shared/antd-imports';
import { Badge, Button, Dropdown, List, Tooltip, Typography, Divider, theme } from '@/shared/antd-imports';
import React, { useEffect, useState, useCallback } from 'react';
import { taskTimeLogsApiService, IRunningTimer, IRecentTimeLog } from '@/api/tasks/task-time-logs.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { updateTaskTimeTracking, updateTaskLoggedTime } from '@/features/tasks/tasks.slice';
import { format, differenceInSeconds, formatDistanceToNow, isValid, parseISO } from 'date-fns';

const { Text } = Typography;
const { useToken } = theme;

const formatElapsedTime = (totalSeconds: number) => {
  const seconds = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `0m ${remainingSeconds}s`;
};

const TimerButton = () => {
  const [runningTimers, setRunningTimers] = useState<IRunningTimer[]>([]);
  const [recentLogs, setRecentLogs] = useState<IRecentTimeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTimes, setCurrentTimes] = useState<Record<string, string>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useToken();
  const dispatch = useAppDispatch();
  const { socket } = useSocket();

  const logError = (message: string, error?: any) => {
    // Production-safe error logging
    console.error(`[TimerButton] ${message}`, error);
    setError(message);
  };

  const fetchRunningTimers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await taskTimeLogsApiService.getRunningTimers();

      if (response && response.done) {
        const timers = Array.isArray(response.body) ? response.body : [];
        setRunningTimers(timers);
      } else {
        logError('Invalid response from getRunningTimers API');
        setRunningTimers([]);
      }
    } catch (error) {
      logError('Error fetching running timers', error);
      setRunningTimers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentLogs = useCallback(async () => {
    try {
      const response = await taskTimeLogsApiService.getRecentLogs(8);
      if (response?.done) {
        setRecentLogs(Array.isArray(response.body) ? response.body : []);
      } else {
        setRecentLogs([]);
      }
    } catch (error) {
      logError('Error fetching recent time logs', error);
      setRecentLogs([]);
    }
  }, []);

  const updateCurrentTimes = useCallback(() => {
    try {
      if (!Array.isArray(runningTimers) || runningTimers.length === 0) return;

      const newTimes: Record<string, string> = {};
      runningTimers.forEach(timer => {
        try {
          if (!timer || !timer.task_id || !timer.start_time) return;

          const startTime = parseISO(timer.start_time);
          if (!isValid(startTime)) {
            logError(`Invalid start time for timer ${timer.task_id}: ${timer.start_time}`);
            return;
          }

          const now = new Date();
          const totalSeconds = differenceInSeconds(now, startTime);
          newTimes[timer.task_id] = formatElapsedTime(totalSeconds);
        } catch (error) {
          logError(`Error updating time for timer ${timer?.task_id}`, error);
        }
      });
      setCurrentTimes(newTimes);
    } catch (error) {
      logError('Error in updateCurrentTimes', error);
    }
  }, [runningTimers]);

  useEffect(() => {
    fetchRunningTimers();
    fetchRecentLogs();

    // Removed periodic polling - rely on socket events for real-time updates
  }, [fetchRunningTimers, fetchRecentLogs]);

  useEffect(() => {
    if (runningTimers.length > 0) {
      updateCurrentTimes();
      const interval = setInterval(updateCurrentTimes, 1000);
      return () => clearInterval(interval);
    }
  }, [runningTimers, updateCurrentTimes]);

  // Listen for timer start/stop events and project updates to refresh the count
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleTimerStart = (data: string) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const { id, task_id } = parsed || {};
        const timerTaskId = id || task_id;
        if (timerTaskId) {
          // Refresh the running timers list when a new timer is started
          fetchRunningTimers();
        }
      } catch (error) {
        logError('Error parsing timer start event', error);
      }
    };

    const handleTimerStop = (data: string | any) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const { id, task_id, duration_hours } = parsed || {};
        const taskId = id || task_id; // Handle inconsistent ID naming if any
        
        if (taskId) {
          // Refresh the running timers list when a timer is stopped
          fetchRunningTimers();
          fetchRecentLogs();
          
          // Also update the task log if we have duration
          if (duration_hours) {
             dispatch(updateTaskLoggedTime({ taskId, addedHours: duration_hours }));
          }
        }
      } catch (error) {
        logError('Error parsing timer stop event', error);
      }
    };

    const handleProjectUpdates = () => {
      try {
        // Refresh timers when project updates are available
        fetchRunningTimers();
      } catch (error) {
        logError('Error handling project updates', error);
      }
    };

    try {
      socket.on(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
      socket.on(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
      socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);

      return () => {
        try {
          socket.off(SocketEvents.TASK_TIMER_START.toString(), handleTimerStart);
          socket.off(SocketEvents.TASK_TIMER_STOP.toString(), handleTimerStop);
          socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleProjectUpdates);
        } catch (error) {
          logError('Error cleaning up socket listeners', error);
        }
      };
    } catch (error) {
      logError('Error setting up socket listeners', error);
    }
  }, [socket, fetchRunningTimers, fetchRecentLogs]);

  const hasRunningTimers = () => {
    return Array.isArray(runningTimers) && runningTimers.length > 0;
  };

  const timerCount = () => {
    return Array.isArray(runningTimers) ? runningTimers.length : 0;
  };

  const handleStopTimer = (taskId: string) => {
    if (!socket) {
      logError('Socket not available for stopping timer');
      return;
    }

    if (!taskId) {
      logError('Invalid task ID for stopping timer');
      return;
    }

    try {
      socket.emit(SocketEvents.TASK_TIMER_STOP.toString(), JSON.stringify({ task_id: taskId }));
      dispatch(updateTaskTimeTracking({ taskId, timeTracking: null }));
    } catch (error) {
      logError(`Error stopping timer for task ${taskId}`, error);
    }
  };

  const renderDropdownContent = () => {
    try {
      if (error) {
        return (
          <div style={{ padding: 16, textAlign: 'center', width: 350 }}>
            <Text type="danger">Error loading timers</Text>
          </div>
        );
      }

      return (
        <div
          style={{
            width: 430,
            maxHeight: 520,
            overflow: 'auto',
            backgroundColor: token.colorBgElevated,
            borderRadius: token.borderRadius,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ padding: '10px 14px', fontWeight: 700, color: token.colorTextSecondary }}>
            RUNNING TIMERS
          </div>
          {!Array.isArray(runningTimers) || runningTimers.length === 0 ? (
            <div style={{ padding: '0 14px 12px' }}>
              <Text type="secondary">No running timers</Text>
            </div>
          ) : (
            <List
              dataSource={runningTimers}
              renderItem={timer => {
                if (!timer || !timer.task_id) return null;

                return (
                  <List.Item
                    style={{
                      padding: '12px 14px',
                      borderTop: `1px solid ${token.colorBorderSecondary}`,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text strong style={{ fontSize: 14, color: token.colorText }}>
                          {timer.task_name || 'Unnamed Task'}
                        </Text>
                        <div
                          style={{
                            display: 'inline-block',
                            backgroundColor: token.colorFillSecondary,
                            color: token.colorTextSecondary,
                            padding: '2px 8px',
                            borderRadius: token.borderRadiusSM,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {timer.project_name || 'Unnamed Project'}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Started: {timer.start_time ? format(parseISO(timer.start_time), 'HH:mm') : '--:--'}
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Button
                            size="small"
                            type="text"
                            icon={<StopOutlined style={{ fontSize: 11 }} />}
                            onClick={e => {
                              e.stopPropagation();
                              handleStopTimer(timer.task_id);
                            }}
                            style={{ width: 20, height: 20, padding: 0 }}
                          />
                          <Text strong style={{ fontSize: 14, color: token.colorText }}>
                            {currentTimes[timer.task_id] || '00:00:00'}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          )}

          <div
            style={{
              padding: '10px 14px',
              fontWeight: 700,
              color: token.colorTextSecondary,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            RECENT TIME LOGS
          </div>
          {!recentLogs.length ? (
            <div style={{ padding: '0 14px 14px' }}>
              <Text type="secondary">No recent time logs</Text>
            </div>
          ) : (
            <List
              dataSource={recentLogs}
              renderItem={log => (
                <List.Item
                  style={{
                    padding: '12px 14px',
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    backgroundColor: 'transparent',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text strong style={{ fontSize: 14, color: token.colorText }}>
                        {log.task_name}
                      </Text>
                      <div
                        style={{
                          display: 'inline-block',
                          backgroundColor: token.colorFillSecondary,
                          color: token.colorTextSecondary,
                          padding: '2px 8px',
                          borderRadius: token.borderRadiusSM,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {log.project_name}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {log.logged_date ? formatDistanceToNow(parseISO(log.logged_date), { addSuffix: true }) : '--'}
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlayCircleFilled style={{ color: token.colorPrimary }} />
                        <Text strong style={{ fontSize: 14, color: token.colorText }}>
                          {log.time_spent_text || '0s'}
                        </Text>
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}

          <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />
          <div
            style={{
              padding: '8px 16px',
              textAlign: 'center',
              backgroundColor: token.colorFillQuaternary,
              borderBottomLeftRadius: token.borderRadius,
              borderBottomRightRadius: token.borderRadius,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11 }}>
              {timerCount()} timer{timerCount() !== 1 ? 's' : ''} running
            </Text>
          </div>
        </div>
      );
    } catch (error) {
      logError('Error rendering dropdown content', error);
      return (
        <div style={{ padding: 16, textAlign: 'center', width: 350 }}>
          <Text type="danger">Error rendering timers</Text>
        </div>
      );
    }
  };

  const handleDropdownOpenChange = (open: boolean) => {
    try {
      setDropdownOpen(open);
      if (open) {
        fetchRunningTimers();
        fetchRecentLogs();
      }
    } catch (error) {
      logError('Error handling dropdown open change', error);
    }
  };

  try {
    return (
      <Dropdown
        popupRender={() => renderDropdownContent()}
        trigger={['click']}
        placement="bottomRight"
        open={dropdownOpen}
        onOpenChange={handleDropdownOpenChange}
      >
        <Tooltip title="Running Timers">
          <Button
            style={{ height: '62px', width: '60px' }}
            type="text"
            icon={
              hasRunningTimers() ? (
                <Badge count={timerCount()}>
                  <ClockCircleOutlined style={{ fontSize: 20 }} />
                </Badge>
              ) : (
                <ClockCircleOutlined style={{ fontSize: 20 }} />
              )
            }
            loading={loading}
          />
        </Tooltip>
      </Dropdown>
    );
  } catch (error) {
    logError('Error rendering TimerButton', error);
    return (
      <Tooltip title="Timer Error">
        <Button
          style={{ height: '62px', width: '60px' }}
          type="text"
          icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
          disabled
        />
      </Tooltip>
    );
  }
};

export default TimerButton;
