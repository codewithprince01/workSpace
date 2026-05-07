import { DatePicker } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import dayjs, { Dayjs } from 'dayjs';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { getUserSession } from '@/utils/session-helper';
import logger from '@/utils/errorLogger';

const TaskListDueDateCell = ({ task }: { task: IProjectTask }) => {
  const { socket } = useSocket();
  const dueDayjs = task.end_date ? dayjs(task.end_date) : null;
  const startDayjs = task.start_date ? dayjs(task.start_date) : null;
  const completedDayjs = task.completed_at ? dayjs(task.completed_at) : null;

  const handleEndDateChange = (date: Dayjs | null) => {
    try {
      socket?.emit(
        SocketEvents.TASK_END_DATE_CHANGE.toString(),
        JSON.stringify({
          task_id: task.id,
          end_date: date?.format('YYYY-MM-DD'),
          parent_task: task.parent_task_id,
          time_zone: getUserSession()?.timezone_name
            ? getUserSession()?.timezone_name
            : Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );
    } catch (error) {
      logger.error('Failed to update due date:', error);
    }
  };

  const disabledEndDate = (current: Dayjs) => {
    if (!current) return false;
    const today = dayjs().startOf('day');
    if (current.startOf('day').isBefore(today)) return true;
    if (startDayjs && current.startOf('day').isBefore(startDayjs.startOf('day'))) return true;
    return false;
  };

  const getDueStatusLabel = () => {
    if (!dueDayjs) return null;

    if (completedDayjs) {
      const lateDays = completedDayjs.startOf('day').diff(dueDayjs.startOf('day'), 'day');
      if (lateDays > 0) return `Completed ${lateDays}d late`;
      return null;
    }

    const overdueDays = dayjs().startOf('day').diff(dueDayjs.startOf('day'), 'day');
    if (overdueDays > 0) return `${overdueDays}d overdue`;
    return null;
  };

  const dueStatusLabel = getDueStatusLabel();

  return (
    <div className="flex flex-col">
      <DatePicker
        placeholder="Set Date"
        value={dueDayjs}
        format={'MMM DD, YYYY'}
        suffixIcon={null}
        onChange={handleEndDateChange}
        disabledDate={disabledEndDate}
        style={{
          backgroundColor: colors.transparent,
          border: 'none',
          boxShadow: 'none',
        }}
      />
      {dueStatusLabel ? (
        <span className="text-[11px] leading-4 text-red-500 mt-0.5">{dueStatusLabel}</span>
      ) : null}
    </div>
  );
};

export default TaskListDueDateCell;
