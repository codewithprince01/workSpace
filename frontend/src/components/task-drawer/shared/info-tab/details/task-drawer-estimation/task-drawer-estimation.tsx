import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { colors } from '@/styles/colors';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { Flex, Form, FormInstance, InputNumber, Typography } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

import { useEffect } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTaskEstimation } from '@/features/task-drawer/task-drawer.slice';

interface TaskDrawerEstimationProps {
  t: TFunction;
  task: ITaskViewModel;
  form: FormInstance<any>;
}

const TaskDrawerEstimation = ({ t, task, form }: TaskDrawerEstimationProps) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!socket) return;
    const eventName = SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString();
    const handler = (data: any) => {
      if (String(data?.id || '') === String(task?.id || '')) {
        dispatch(setTaskEstimation(data));
      }
    };
    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, task?.id, dispatch]);

  // Sync form with Redux task values
  useEffect(() => {
    if (!task) return;
    const hoursRaw = Number(task.total_hours || 0);
    const minutesRaw = Number(task.total_minutes || 0);
    const fallbackEstimated = Number((task as any).estimated_hours || 0);
    const fallbackHours = Math.floor(fallbackEstimated);
    const fallbackMinutes = Math.round((fallbackEstimated - fallbackHours) * 60);
    form.setFieldsValue({
        hours: hoursRaw || fallbackHours || 0,
        minutes: minutesRaw || fallbackMinutes || 0
    });
  }, [task?.total_hours, task?.total_minutes, (task as any)?.estimated_hours, form]);

  const handleTimeEstimationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!connected || !task?.id) return;

    // Get current form values
    const currentHours = form.getFieldValue('hours') || 0;
    const currentMinutes = form.getFieldValue('minutes') || 0;

    socket?.emit(
      SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString(),
      JSON.stringify({
        task_id: task?.id,
        total_hours: currentHours,
        total_minutes: currentMinutes,
        parent_task: task?.parent_task_id,
      })
    );
  };

  return (
    <Form.Item name="timeEstimation" label={t('taskInfoTab.details.time-estimation')}>
      <Flex gap={8}>
        <Form.Item
          name={'hours'}
          label={
            <Typography.Text style={{ color: colors.lightGray, fontSize: 12 }}>
              {t('taskInfoTab.details.hours')}
            </Typography.Text>
          }
          style={{ marginBottom: 36 }}
          labelCol={{ style: { paddingBlock: 0 } }}
          layout="vertical"
        >
          <InputNumber
            min={0}
            max={24}
            placeholder={t('taskInfoTab.details.hours')}
            onBlur={handleTimeEstimationBlur}
          />
        </Form.Item>
        <Form.Item
          name={'minutes'}
          label={
            <Typography.Text style={{ color: colors.lightGray, fontSize: 12 }}>
              {t('taskInfoTab.details.minutes')}
            </Typography.Text>
          }
          style={{ marginBottom: 36 }}
          labelCol={{ style: { paddingBlock: 0 } }}
          layout="vertical"
        >
          <InputNumber
            min={0}
            max={60}
            placeholder={t('taskInfoTab.details.minutes')}
            onBlur={handleTimeEstimationBlur}
          />
        </Form.Item>
      </Flex>
    </Form.Item>
  );
};

export default TaskDrawerEstimation;
