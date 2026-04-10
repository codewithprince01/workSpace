import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { ITaskViewModel } from '@/types/tasks/task.types';
import logger from '@/utils/errorLogger';
import { Switch } from 'antd/es';

import { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTaskBillable } from '@/features/task-drawer/task-drawer.slice';

interface TaskDrawerBillableProps {
  task?: ITaskViewModel | null;
}

const TaskDrawerBillable = ({ task = null }: TaskDrawerBillableProps) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket) return;
    const eventName = SocketEvents.TASK_BILLABLE_CHANGE.toString();
    const handler = (data: any) => {
      if (String(data?.id || '') === String(task?.id || '')) {
        dispatch(setTaskBillable(data));
      }
    };
    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, task?.id, dispatch]);

  const handleBillableChange = (checked: boolean) => {
    if (!connected) return;

    try {
      socket?.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
        task_id: task?.id,
        billable: checked,
      });
    } catch (error) {
      logger.error('Error updating billable status', error);
    }
  };

  return <Switch checked={task?.billable} onChange={handleBillableChange} />;
};

export default TaskDrawerBillable;
