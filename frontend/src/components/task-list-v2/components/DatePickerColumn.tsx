import React, { memo, useCallback } from 'react';
import { DatePicker, TimePicker } from '@/shared/antd-imports';
import { CloseOutlined } from '@/shared/antd-imports';
import { dayjs, taskManagementAntdConfig } from '@/shared/antd-imports';
import { Task } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';

interface DatePickerColumnProps {
  width: string;
  task: Task;
  field: 'dueDate' | 'startDate' | 'dueTime';
  formattedDate: string | null;
  dateValue: dayjs.Dayjs | undefined;
  isDarkMode: boolean;
  activeDatePicker: string | null;
  onActiveDatePickerChange: (field: string | null) => void;
}

export const DatePickerColumn: React.FC<DatePickerColumnProps> = memo(({
  width,
  task,
  field,
  formattedDate,
  dateValue,
  isDarkMode,
  activeDatePicker,
  onActiveDatePickerChange
}) => {
  const { socket, connected } = useSocket();
  const { t } = useTranslation('task-list-table');

  const emitDateChange = useCallback(
    (value: dayjs.Dayjs | null) => {
      if (!connected || !socket) return;

      const eventType =
        field === 'startDate'
          ? SocketEvents.TASK_START_DATE_CHANGE
          : SocketEvents.TASK_END_DATE_CHANGE;
      const dateField = field === 'startDate' ? 'start_date' : 'end_date';

      socket.emit(
        eventType.toString(),
        JSON.stringify({
          task_id: task.id,
          [dateField]: value ? value.toISOString() : null,
          parent_task: null,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );
    },
    [connected, socket, task.id, field]
  );

  // Handle date change
  const handleDateChange = useCallback(
    (date: dayjs.Dayjs | null) => {
      if (field === 'startDate' && date && date.startOf('day').isBefore(dayjs().startOf('day'))) {
        onActiveDatePickerChange(null);
        return;
      }
      emitDateChange(date);

      // Close the date picker after selection
      onActiveDatePickerChange(null);
    },
    [field, emitDateChange, onActiveDatePickerChange]
  );

  const handleTimeChange = useCallback(
    (time: dayjs.Dayjs | null) => {
      const baseDate = dateValue || dayjs(task.dueDate || task.due_date);
      if (!baseDate || !baseDate.isValid()) {
        onActiveDatePickerChange(null);
        return;
      }

      if (!time) {
        emitDateChange(baseDate.startOf('day'));
        onActiveDatePickerChange(null);
        return;
      }

      const merged = baseDate
        .hour(time.hour())
        .minute(time.minute())
        .second(0)
        .millisecond(0);
      emitDateChange(merged);
      onActiveDatePickerChange(null);
    },
    [dateValue, task.dueDate, task.due_date, emitDateChange, onActiveDatePickerChange]
  );

  // Handle clear date
  const handleClearDate = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDateChange(null);
  }, [handleDateChange]);

  // Handle open date picker
  const handleOpenDatePicker = useCallback(() => {
    onActiveDatePickerChange(field);
  }, [field, onActiveDatePickerChange]);

  const isActive = activeDatePicker === field;
  const startDateValue = task.startDate || task.start_date;
  const dueDateValue = task.dueDate || task.due_date;
  const startDay = startDateValue ? dayjs(startDateValue) : null;
  const dueDay = dueDateValue ? dayjs(dueDateValue) : null;

  const disabledDate = (current: dayjs.Dayjs) => {
    if (!current) return false;
    const today = dayjs().startOf('day');
    const currentDay = current.startOf('day');

    // Never allow selecting past dates.
    if (currentDay.isBefore(today)) return true;

    // Keep start/due relation valid.
    if (field === 'dueDate' && startDay && currentDay.isBefore(startDay.startOf('day'))) return true;

    return false;
  };

  const disabledDueTime = () => {
    const now = dayjs();
    const taskDue = dateValue || dueDay;
    if (!taskDue || !taskDue.isValid() || !taskDue.isSame(now, 'day')) return {};

    const currentHour = now.hour();
    const currentMinute = now.minute();

    return {
      disabledHours: () => Array.from({ length: currentHour }, (_, i) => i),
      disabledMinutes: (selectedHour: number) =>
        selectedHour === currentHour ? Array.from({ length: currentMinute }, (_, i) => i) : [],
    };
  };
  const placeholder =
    field === 'dueDate'
      ? t('dueDatePlaceholder')
      : field === 'dueTime'
        ? t('dueTimeColumn')
        : t('startDatePlaceholder');
  const clearTitle =
    field === 'dueDate'
      ? t('clearDueDate')
      : field === 'dueTime'
        ? t('dueTimeColumn')
        : t('clearStartDate');
  const setTitle =
    field === 'dueDate'
      ? t('setDueDate')
      : field === 'dueTime'
        ? t('dueTimeColumn')
        : t('setStartDate');

  return (
    <div className="flex items-center justify-center px-2 relative group border-r border-gray-200 dark:border-gray-700" style={{ width }}>
      {isActive ? (
        <div className="w-full relative">
          {field === 'dueTime' ? (
            <TimePicker
              className="w-full bg-transparent border-none shadow-none"
              value={dateValue}
              onChange={handleTimeChange}
              format="hh:mm A"
              use12Hours
              disabledTime={disabledDueTime}
              allowClear={false}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  onActiveDatePickerChange(null);
                }
              }}
              autoFocus
            />
          ) : (
            <DatePicker
              {...taskManagementAntdConfig.datePickerDefaults}
              className="w-full bg-transparent border-none shadow-none"
              value={dateValue}
              onChange={handleDateChange}
              disabledDate={disabledDate}
              placeholder={placeholder}
              allowClear={false}
              suffixIcon={null}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  onActiveDatePickerChange(null);
                }
              }}
              autoFocus
            />
          )}
          {/* Custom clear button */}
          {dateValue && (
            <button
              onClick={handleClearDate}
              className={`absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={clearTitle}
            >
              <CloseOutlined style={{ fontSize: '10px' }} />
            </button>
          )}
        </div>
      ) : (
        <div 
          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors text-center"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDatePicker();
          }}
        >
          {formattedDate ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formattedDate}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {setTitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

DatePickerColumn.displayName = 'DatePickerColumn'; 
