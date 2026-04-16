import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedEvent, openQuickCreate } from '@/features/calendar/calendarSlice';
import { ICalendarEvent } from '@/api/calendar/calendar.api.service';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  meeting:       { bg: '#e6f4ff', text: '#1677ff', border: '#1677ff' },
  webinar:       { bg: '#f9f0ff', text: '#722ed1', border: '#722ed1' },
  reminder:      { bg: '#fff7e6', text: '#fa8c16', border: '#fa8c16' },
  task_deadline: { bg: '#fff1f0', text: '#f5222d', border: '#f5222d' },
  team_note:     { bg: '#f6ffed', text: '#52c41a', border: '#52c41a' },
  mood_entry:    { bg: '#fffbe6', text: '#faad14', border: '#faad14' },
};

const WeekGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, currentDate } = useAppSelector(state => state.calendarReducer);

  const today = dayjs().format('YYYY-MM-DD');
  const weekStart = dayjs(currentDate).startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  // Map events to (day, hour) buckets
  const eventMap = useMemo(() => {
    const map: Record<string, ICalendarEvent[]> = {};
    events.forEach(ev => {
      const key = dayjs(ev.start_time).format('YYYY-MM-DD-HH');
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const handleCellClick = (day: dayjs.Dayjs, hour: number, e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dispatch(openQuickCreate({
      date: day.hour(hour).minute(0).toISOString(),
      position: { x: rect.left + 10, y: rect.top + 10 },
    }));
  };

  const handleEventClick = (e: React.MouseEvent, event: ICalendarEvent) => {
    e.stopPropagation();
    dispatch(setSelectedEvent(event));
  };

  return (
    <div className="week-grid">
      {/* Header: day labels */}
      <div className="week-grid-header">
        <div className="wg-time-gutter" />
        {weekDays.map(day => {
          const key = day.format('YYYY-MM-DD');
          const isToday = key === today;
          return (
            <div key={key} className={`week-header-cell ${isToday ? 'today' : ''}`}>
              <div className="week-header-dow">{day.format('ddd')}</div>
              <div className={`week-header-date ${isToday ? 'today-bubble' : ''}`}>
                {day.format('D')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="week-time-grid-scroll">
        <div className="week-time-grid">
          {HOURS.map(hour => (
            <div key={hour} className="week-hour-row">
              {/* Time label */}
              <div className="wg-time-gutter">
                <span className="time-label-text">
                  {hour === 0 ? '' : dayjs().hour(hour).format('h A')}
                </span>
              </div>

              {/* Day columns */}
              {weekDays.map(day => {
                const key = `${day.format('YYYY-MM-DD')}-${String(hour).padStart(2, '0')}`;
                const cellEvents = eventMap[key] || [];
                const isToday = day.format('YYYY-MM-DD') === today;

                return (
                  <div
                    key={key}
                    className={`week-time-cell ${isToday ? 'today' : ''} ${hour === dayjs().hour() && isToday ? 'current-hour' : ''}`}
                    onClick={e => handleCellClick(day, hour, e)}
                  >
                    {cellEvents.map(ev => {
                      const cfg = TYPE_COLORS[ev.type] || TYPE_COLORS.meeting;
                      return (
                        <div
                          key={ev._id}
                          className="week-event-block"
                          style={{ background: cfg.bg, color: cfg.text, borderLeftColor: cfg.border }}
                          onClick={e => handleEventClick(e, ev)}
                        >
                          <span className="web-time">{dayjs(ev.start_time).format('HH:mm')}</span>
                          <span className="web-title">{ev.title}</span>
                        </div>
                      );
                    })}
                    {/* Current time indicator */}
                    {isToday && hour === dayjs().hour() && (
                      <div className="current-time-line" style={{ top: `${(dayjs().minute() / 60) * 100}%` }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekGrid;
