import { useSocket } from '@/socket/socketContext';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Select } from '@/shared/antd-imports';

import { Form } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTaskPhase } from '@/features/task-drawer/task-drawer.slice';
import { useEffect } from 'react';

interface TaskDrawerPhaseSelectorProps {
  phases: ITaskPhase[];
  task: ITaskViewModel;
}

const TaskDrawerPhaseSelector = ({ phases, task }: TaskDrawerPhaseSelectorProps) => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket) return;
    const eventName = SocketEvents.TASK_PHASE_CHANGE.toString();
    const handler = (data: any) => {
      if (String(data?.id || '') === String(task?.id || '')) {
        dispatch(setTaskPhase(data));
      }
    };
    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, task?.id, dispatch]);

  const phaseMenuItems = phases?.map(phase => ({
    key: phase.id,
    value: phase.id,
    label: phase.name,
  }));

  const handlePhaseChange = (value: string | null) => {
    socket?.emit(
      SocketEvents.TASK_PHASE_CHANGE.toString(),
      JSON.stringify({
        task_id: task?.id,
        phase_id: value || null,
        parent_task: task?.parent_task_id || null,
      })
    );
  };

  return (
    <Form.Item name="phase" label="Phase">
      <Select
        allowClear
        placeholder="Select Phase"
        options={phaseMenuItems}
        styles={{
          root: {
            width: 'fit-content',
          },
        }}
        onChange={handlePhaseChange}
        value={task?.phase_id}
      />
    </Form.Item>
  );
};

export default TaskDrawerPhaseSelector;
