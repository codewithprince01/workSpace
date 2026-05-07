import { TimePicker } from '@/shared/antd-imports';
import dayjs from 'dayjs';
import React from 'react';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const TaskListDueTimeCell = ({ task }: { task: IProjectTask }) => {
  // function to trigger time change
  const onTimeChange = (time: any, timeString: any) => {
    console.log(time, timeString);
  };

  const disabledTime = () => {
    const dueDate = task?.end_date ? dayjs(task.end_date) : null;
    const now = dayjs();
    if (!dueDate || !dueDate.isSame(now, 'day')) return {};

    const currentHour = now.hour();
    const currentMinute = now.minute();

    return {
      disabledHours: () => Array.from({ length: currentHour }, (_, i) => i),
      disabledMinutes: (selectedHour: number) =>
        selectedHour === currentHour ? Array.from({ length: currentMinute }, (_, i) => i) : [],
    };
  };

  return (
    <TimePicker
      format={'HH:mm'}
      changeOnScroll
      onChange={onTimeChange}
      disabledTime={disabledTime}
      style={{
        border: 'none',
        background: 'transparent',
      }}
    />
  );
};

export default TaskListDueTimeCell;
