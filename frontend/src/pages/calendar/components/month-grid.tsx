import React, { useMemo } from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedEvent, setCurrentDate, openQuickCreate, openSlidePanel, deleteEvent
} from '@/features/calendar/calendarSlice';
import { ICalendarEvent } from '@/api/calendar/calendar.api.service';
import { canEditEvent, canDeleteEvent } from '@/utils/calendarPermissions';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENTS_SHOWN = 3;

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  meeting:       { bg: '#e6f4ff', text: '#1677ff', border: '#1677ff' },
  webinar:       { bg: '#f9f0ff', text: '#722ed1', border: '#722ed1' },
  reminder:      { bg: '#fff7e6', text: '#fa8c16', border: '#fa8c16' },
  task_deadline: { bg: '#fff1f0', text: '#f5222d', border: '#f5222d' },
  team_note:     { bg: '#f6ffed', text: '#52c41a', border: '#52c41a' },
  mood_entry:    { bg: '#fffbe6', text: '#faad14', border: '#faad14' },
};

const MOOD_EMOJI_MAP: Record<string, string> = {
  amazing:  '🤩',
  happy:    '😊',
  neutral:  '😐',
  sad:      '😞',
  stressed: '😤',
};

const getMoodEmoji = (mood?: string | null): string => {
  return mood ? (MOOD_EMOJI_MAP[mood] || '😊') : '😊';
};

// ── Event Preview Tooltip ──────────────────────────────────────

const EventPreviewTooltip: React.FC<{ event: ICalendarEvent; children: React.ReactNode }> = ({
  event, children
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const { selectedTeamId } = useAppSelector(state => state.calendarReducer);
  const cfg = TYPE_COLORS[event.type] || TYPE_COLORS.meeting;

  const canEdit = canEditEvent(user, event, selectedTeamId);
  const canDelete = canDeleteEvent(user, event, selectedTeamId);

  const tooltipContent = (
    <div className="event-tooltip-content" onClick={e => e.stopPropagation()}>
      <div className="etc-type" style={{ color: cfg.text }}>{
        { meeting: '🤝 Meeting', webinar: '🎥 Webinar', reminder: '🔔 Reminder',
          task_deadline: '⏰ Deadline', team_note: '📝 Note', mood_entry: '😊 Mood' }[event.type]
      }</div>
      <div className="etc-title">{event.title}</div>
      <div className="etc-time">
        {event.all_day
          ? dayjs(event.start_time).format('MMM D')
          : dayjs(event.start_time).format('MMM D · HH:mm')}
        {event.end_time && !event.all_day && ` – ${dayjs(event.end_time).format('HH:mm')}`}
      </div>
      {event.description && (
        <div className="etc-desc">{event.description.slice(0, 80)}{event.description.length > 80 ? '…' : ''}</div>
      )}
      <div className="etc-actions">
        {canEdit && (
          <button
            className="etc-btn etc-edit"
            onClick={() => dispatch(openSlidePanel({ mode: 'edit', event }))}
          >
            <EditOutlined /> Edit
          </button>
        )}
        {canDelete && (
          <button
            className="etc-btn etc-delete"
            onClick={() => { if (window.confirm('Delete this event?')) dispatch(deleteEvent(event._id)); }}
          >
            <DeleteOutlined /> Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Tooltip
      title={tooltipContent}
      trigger="hover"
      placement="right"
      overlayClassName="event-preview-tooltip"
      mouseEnterDelay={0.3}
      mouseLeaveDelay={0.1}
    >
      <>{children}</>
    </Tooltip>
  );
};

// ── Month Grid ─────────────────────────────────────────────────

const MonthGrid: React.FC = () => {
  const dispatch = useAppDispatch();
  const { events, currentDate } = useAppSelector(state => state.calendarReducer);

  const today = dayjs().format('YYYY-MM-DD');
  const current = dayjs(currentDate);
  const startOfMonth = current.startOf('month');
  const startOfGrid = startOfMonth.startOf('week');

  const days = useMemo(() => {
    const result: dayjs.Dayjs[] = [];
    for (let i = 0; i < 42; i++) result.push(startOfGrid.add(i, 'day'));
    return result;
  }, [startOfGrid.format('YYYY-MM-DD')]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ICalendarEvent[]> = {};
    events.forEach(event => {
      const key = dayjs(event.start_time).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [events]);

  const handleCellClick = (e: React.MouseEvent, day: dayjs.Dayjs) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dispatch(openQuickCreate({
      date: day.toISOString(),
      position: { x: rect.left + 20, y: rect.top + 20 },
    }));
    dispatch(setCurrentDate(day.toISOString()));
  };

  const handleEventClick = (e: React.MouseEvent, event: ICalendarEvent) => {
    e.stopPropagation();
    dispatch(setSelectedEvent(event));
  };

  return (
    <div className="month-grid">
      {/* Header row */}
      {WEEKDAYS.map(day => (
        <div key={day} className="month-grid-header">{day}</div>
      ))}

      {/* Day cells */}
      {days.map(day => {
        const key = day.format('YYYY-MM-DD');
        const isToday = key === today;
        const isOtherMonth = day.month() !== current.month();
        const dayEvents = eventsByDate[key] || [];
        const moodEvents = dayEvents.filter(e => e.type === 'mood_entry');
        const regularEvents = dayEvents.filter(e => e.type !== 'mood_entry');
        // Show mood first, then other events
        const allVisibleEvents = [
          ...moodEvents.slice(0, 1), // max 1 mood chip
          ...regularEvents,
        ].slice(0, MAX_EVENTS_SHOWN + 1);
        const hiddenCount = Math.max(0, regularEvents.length + Math.min(1, moodEvents.length) - allVisibleEvents.length);

        return (
          <div
            key={key}
            className={`day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
            onClick={(e) => handleCellClick(e, day)}
          >
            {/* Day number row */}
            <div className="day-cell-header">
              <span className={`day-number ${isToday ? 'today-badge' : ''}`}>
                {day.date()}
              </span>
              {!isOtherMonth && moodEvents.length === 0 && (
                <span className="add-event-hint">+ Add</span>
              )}
            </div>

            {/* Events (including mood chips inline) */}
            <div className="day-events">
              {allVisibleEvents.map(event => {
                const cfg = TYPE_COLORS[event.type] || TYPE_COLORS.meeting;

                // ── Mood chip — rich card style ──
                if (event.type === 'mood_entry') {
                  const emoji = getMoodEmoji(event.mood);
                  // Extract note preview from title (auto-generated) or description
                  const notePreview = event.description
                    ? event.description.slice(0, 30) + (event.description.length > 30 ? '…' : '')
                    : null;
                  return (
                    <EventPreviewTooltip key={event._id} event={event}>
                      <div
                        className="event-chip type-mood_entry mood-chip-card"
                        style={{ background: cfg.bg, color: cfg.text, borderLeftColor: cfg.border }}
                        onClick={e => handleEventClick(e, event)}
                      >
                        <span className="mood-chip-emoji">{emoji}</span>
                        <div className="mood-chip-content">
                          <span className="mood-chip-label">{event.mood || 'Mood'}</span>
                          {notePreview && <span className="mood-chip-note">{notePreview}</span>}
                        </div>
                      </div>
                    </EventPreviewTooltip>
                  );
                }

                // ── Regular event chip ──
                return (
                  <EventPreviewTooltip key={event._id} event={event}>
                    <div
                      className={`event-chip type-${event.type}`}
                      style={{ background: cfg.bg, color: cfg.text, borderLeftColor: cfg.border }}
                      onClick={e => handleEventClick(e, event)}
                    >
                      {!event.all_day && (
                        <span className="event-chip-time">
                          {dayjs(event.start_time).format('HH:mm')}
                        </span>
                      )}
                      <span className="event-chip-title">{event.title}</span>
                      {event.priority === 'high' && (
                        <span className="priority-dot high" title="High priority" />
                      )}
                    </div>
                  </EventPreviewTooltip>
                );
              })}

              {hiddenCount > 0 && (
                <button
                  className="more-events-btn"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch(setCurrentDate(day.toISOString()));
                  }}
                >
                  +{hiddenCount} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MonthGrid;
