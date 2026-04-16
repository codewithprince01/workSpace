import React, { useCallback } from 'react';
import { Button, Select, Segmented, Tooltip, Badge } from '@/shared/antd-imports';
import {
  LeftOutlined, RightOutlined, PlusOutlined, CalendarOutlined,
  FilterOutlined
} from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  setViewMode, setCurrentDate, openSlidePanel,
  setFilter, clearFilters,
} from '@/features/calendar/calendarSlice';

const EVENT_TYPES = [
  { value: 'meeting',       label: '🤝 Meeting' },
  { value: 'webinar',       label: '🎥 Webinar' },
  { value: 'reminder',      label: '🔔 Reminder' },
  { value: 'task_deadline', label: '⏰ Deadline' },
  { value: 'team_note',     label: '📝 Note' },
  { value: 'mood_entry',    label: '😊 Mood' },
];

const PRIORITIES = [
  { value: 'low',    label: '🟢 Low' },
  { value: 'medium', label: '🟠 Medium' },
  { value: 'high',   label: '🔴 High' },
];

const CalendarHeader: React.FC = () => {
  const dispatch = useAppDispatch();
  const { viewMode, currentDate, filters } = useAppSelector(
    state => state.calendarReducer
  );

  const d = dayjs(currentDate);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const navigate = useCallback((dir: -1 | 1) => {
    const unit = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day';
    dispatch(setCurrentDate(d.add(dir, unit).toISOString()));
  }, [d, viewMode, dispatch]);

  const goToday = () => dispatch(setCurrentDate(new Date().toISOString()));

  const titleText =
    viewMode === 'month'
      ? d.format('MMMM YYYY')
      : viewMode === 'week'
        ? `${d.startOf('week').format('MMM D')} – ${d.endOf('week').format('MMM D, YYYY')}`
        : d.format('dddd, MMMM D, YYYY');

  return (
    <div className="calendar-header">
      {/* ── Row 1: Navigation + Title + View Toggle + New Event ── */}
      <div className="ch-top-row">
        {/* Left: Nav */}
        <div className="ch-nav">
          <Button
            onClick={goToday}
            className="ch-today-btn"
            size="small"
          >
            Today
          </Button>
          <div className="ch-arrow-group">
            <Button
              shape="circle"
              icon={<LeftOutlined style={{ fontSize: 11 }} />}
              size="small"
              onClick={() => navigate(-1)}
              className="ch-nav-btn"
            />
            <Button
              shape="circle"
              icon={<RightOutlined style={{ fontSize: 11 }} />}
              size="small"
              onClick={() => navigate(1)}
              className="ch-nav-btn"
            />
          </div>
          <div className="ch-title">{titleText}</div>
        </div>

        {/* Right: View + New */}
        <div className="ch-right">

          {/* View toggle */}
          <Segmented
            value={viewMode}
            onChange={val => dispatch(setViewMode(val as any))}
            options={[
              { label: 'Month', value: 'month' },
              { label: 'Week', value: 'week' },
              { label: 'Day', value: 'day' },
            ]}
            className="ch-view-toggle"
          />

          {/* New Event */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => dispatch(openSlidePanel({ mode: 'create' }))}
            className="ch-new-btn"
          >
            New Event
          </Button>
        </div>
      </div>

      {/* ── Row 2: Filters ── */}
      <div className="ch-filter-row">
        <FilterOutlined style={{ color: '#6b7280', fontSize: 13 }} />
        <span className="ch-filter-label">Filter:</span>

        <Select
          placeholder="All types"
          allowClear
          size="small"
          style={{ minWidth: 130 }}
          options={EVENT_TYPES}
          value={filters.type}
          onChange={val => dispatch(setFilter({ key: 'type', value: val || null }))}
          className="ch-filter-select"
        />

        <Select
          placeholder="Priority"
          allowClear
          size="small"
          style={{ minWidth: 110 }}
          options={PRIORITIES}
          value={filters.priority}
          onChange={val => dispatch(setFilter({ key: 'priority', value: val || null }))}
          className="ch-filter-select"
        />

        {activeFilterCount > 0 && (
          <Button
            size="small"
            type="link"
            onClick={() => dispatch(clearFilters())}
            style={{ color: '#ef4444', padding: 0, fontWeight: 600 }}
          >
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>
    </div>
  );
};

export default CalendarHeader;
