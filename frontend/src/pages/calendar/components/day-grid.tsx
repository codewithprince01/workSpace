import React, { useMemo } from 'react';
import { Empty, Tag } from '@/shared/antd-imports';
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

const MOOD_EMOJI: Record<string, string> = {
  amazing:  '🤩',
  happy:    '😊',
  neutral:  '😐',
  sad:      '😞',
  stressed: '😤',
};

const TYPE_LABEL: Record<string, string> = {
  meeting: '🤝', webinar: '🎥', reminder: '🔔',
  task_deadline: '⏰', team_note: '📝', mood_entry: '😊',
};

const DayGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, currentDate } = useAppSelector(state => state.calendarReducer);

  const day = dayjs(currentDate);
  const todayKey = dayjs().format('YYYY-MM-DD');
  const dayKey = day.format('YYYY-MM-DD');
  const isToday = dayKey === todayKey;

  // Events grouped by hour for this day
  const eventsByHour = useMemo(() => {
    const map: Record<number, ICalendarEvent[]> = {};
    events.forEach(ev => {
      const evDay = dayjs(ev.start_time);
      if (evDay.format('YYYY-MM-DD') !== dayKey) return;
      const hour = ev.all_day ? -1 : evDay.hour();
      if (!map[hour]) map[hour] = [];
      map[hour].push(ev);
    });
    return map;
  }, [events, dayKey]);

  const allDayEvents = eventsByHour[-1] || [];
  const currentHour = dayjs().hour();

  const handleCellClick = (hour: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch(openQuickCreate({
      date: day.hour(hour).minute(0).toISOString(),
      position: { x: rect.left + 100, y: rect.top + 10 },
    }));
  };

  return (
    <div className="day-grid">
      {/* Day header */}
      <div className="dg-header">
        <div className={`dg-date-bubble ${isToday ? 'today' : ''}`}>
          <span className="dg-dow">{day.format('ddd').toUpperCase()}</span>
          <span className="dg-num">{day.format('D')}</span>
        </div>
        <div className="dg-header-info">
          <span style={{ fontSize: 14, color: '#6b7280' }}>{day.format('MMMM YYYY')}</span>
          {isToday && <Tag color="blue" style={{ marginLeft: 8 }}>Today</Tag>}
        </div>
      </div>

      {/* All-day strip */}
      {allDayEvents.length > 0 && (
        <div className="dg-allday-strip">
          <div className="dg-allday-label">All Day</div>
          <div className="dg-allday-events">
            {allDayEvents.map(ev => {
              const cfg = TYPE_COLORS[ev.type] || TYPE_COLORS.meeting;
              return (
                <div
                  key={ev._id}
                  className="dg-allday-chip"
                  style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                  onClick={() => dispatch(setSelectedEvent(ev))}
                >
                  {TYPE_LABEL[ev.type]} {ev.title}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hour-by-hour timeline */}
      <div className="dg-timeline">
        {HOURS.map(hour => {
          const hourEvents = eventsByHour[hour] || [];
          const isCurrentHour = isToday && hour === currentHour;

          return (
            <div
              key={hour}
              className={`dg-hour-row ${isCurrentHour ? 'current-hour' : ''}`}
              onClick={e => handleCellClick(hour, e)}
            >
              {/* Time label */}
              <div className="dg-hour-label">
                <span className={`dg-hour-text ${isCurrentHour ? 'current' : ''}`}>
                  {hour === 0 ? '' : dayjs().hour(hour).format('h A')}
                </span>
              </div>

              {/* Events column */}
              <div className="dg-hour-content">
                {isCurrentHour && (
                  <div className="dg-current-time-bar">
                    <div className="dg-time-dot" />
                    <div className="dg-time-line" />
                    <span className="dg-live-time">{dayjs().format('h:mm A')}</span>
                  </div>
                )}

                {hourEvents.map(ev => {
                  const cfg = TYPE_COLORS[ev.type] || TYPE_COLORS.meeting;
                  const duration = ev.end_time
                    ? dayjs(ev.end_time).diff(dayjs(ev.start_time), 'minute')
                    : 60;

                  return (
                    <div
                      key={ev._id}
                      className="dg-event-block"
                      style={{
                        background: cfg.bg,
                        color: cfg.text,
                        borderLeftColor: cfg.border,
                        minHeight: Math.max(40, (duration / 60) * 60),
                      }}
                      onClick={e => { e.stopPropagation(); dispatch(setSelectedEvent(ev)); }}
                    >
                      <div className="dg-event-title">
                        {ev.type === 'mood_entry' ? (MOOD_EMOJI[ev.mood || ''] || '😊') : TYPE_LABEL[ev.type]} {ev.title}
                      </div>
                      <div className="dg-event-time">
                        {dayjs(ev.start_time).format('h:mm A')}
                        {ev.end_time && ` – ${dayjs(ev.end_time).format('h:mm A')}`}
                      </div>
                      {ev.description && (
                        <div className="dg-event-desc">
                          {ev.description.slice(0, 60)}{ev.description.length > 60 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}

                {hourEvents.length === 0 && (
                  <div className="dg-empty-slot">
                    <span className="dg-add-hint">+ Click to add</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayGrid;
