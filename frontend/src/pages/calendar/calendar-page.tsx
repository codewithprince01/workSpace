import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Spin } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { fetchEvents, fetchTeamMembers, setFilter } from '@/features/calendar/calendarSlice';

import CalendarHeader from './components/calendar-header';
import MonthGrid from './components/month-grid';
import WeekGrid from './components/week-grid';
import DayGrid from './components/day-grid';
import MoodPanel from './components/mood-panel';
import EventDetailPanel from './components/event-detail-panel';
import QuickCreatePopover from './components/quick-create-popover';
import EventSlidePanel from './components/event-slide-panel';

import './calendar.css';

const CalendarPage: React.FC = () => {
  useDocumentTitle('Calendar');
  const dispatch = useAppDispatch();
  const {
    viewMode, currentDate, loading,
    moodPanelOpen
  } = useAppSelector(state => state.calendarReducer);

  const dateRange = useMemo(() => {
    const d = dayjs(currentDate);
    if (viewMode === 'month') {
      return {
        start: d.startOf('month').subtract(7, 'day').toISOString(),
        end: d.endOf('month').add(7, 'day').toISOString(),
      };
    } else if (viewMode === 'week') {
      return {
        start: d.startOf('week').toISOString(),
        end: d.endOf('week').toISOString(),
      };
    } else {
      return {
        start: d.startOf('day').toISOString(),
        end: d.endOf('day').toISOString(),
      };
    }
  }, [viewMode, currentDate]);

  const project = useSelectedProject();
  const { calendarMode, filters } = useAppSelector(state => state.calendarReducer);

  useEffect(() => {
    dispatch(fetchEvents({
      start: dateRange.start,
      end: dateRange.end,
      calendar_mode: calendarMode || 'personal',
      project_id: filters.project_id,
    }));
  }, [dispatch, dateRange, calendarMode, filters.project_id, filters.type, filters.priority]);

  // Sync global project selection with calendar project filter
  useEffect(() => {
    if (project?.id) {
      dispatch(setFilter({ key: 'project_id', value: project.id }));
    } else {
      dispatch(setFilter({ key: 'project_id', value: null }));
    }
  }, [project?.id, dispatch]);

  useEffect(() => {
    dispatch(fetchTeamMembers());
  }, [dispatch]);

  const renderGrid = useCallback(() => {
    if (viewMode === 'month') return <MonthGrid />;
    if (viewMode === 'week') return <WeekGrid />;
    return <DayGrid />;
  }, [viewMode]);

  return (
    <div className="calendar-page">
      <div className="calendar-shell">
        <CalendarHeader />
        <div className="calendar-grid-wrapper">
          <Spin spinning={loading} tip="Loading events...">
            <div className="calendar-grid-inner">
              {renderGrid()}
            </div>
          </Spin>
        </div>
      </div>

      {/* All panels — Ant Design Drawers/Modals handle their own theme */}
      <QuickCreatePopover />
      <EventSlidePanel />
      <EventDetailPanel />
      {moodPanelOpen && <MoodPanel />}
    </div>
  );
};

export default CalendarPage;
