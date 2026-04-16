import React, { useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, Select, Space, Typography } from '@/shared/antd-imports';
import { PlusOutlined, ArrowRightOutlined, ClockCircleOutlined } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import { closeQuickCreate, openSlidePanel, createEvent } from '@/features/calendar/calendarSlice';
import { ICreateEventPayload } from '@/api/calendar/calendar.api.service';

const { Text } = Typography;

const EVENT_TYPE_OPTIONS = [
  { value: 'meeting',       label: '🤝 Meeting' },
  { value: 'reminder',      label: '🔔 Reminder' },
  { value: 'team_note',     label: '📝 Note' },
  { value: 'mood_entry',    label: '😊 Mood' },
  { value: 'task_deadline', label: '⏰ Deadline' },
  { value: 'webinar',       label: '🎥 Webinar' },
];

const QuickCreatePopover: React.FC = () => {
  const dispatch = useAppDispatch();
  const { quickCreateOpen, quickCreateDate } = useAppSelector(s => s.calendarReducer);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<string>('meeting');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (quickCreateOpen) {
      setTitle('');
      setEventType('meeting');
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [quickCreateOpen]);

  const timeStr = quickCreateDate
    ? dayjs(quickCreateDate).format('ddd, MMM D, YYYY')
    : '';

  const projectFromUrl = useSelectedProject();
  const { calendarMode, filters } = useAppSelector(s => s.calendarReducer);
  const { teamId: activeTeamId } = useAppSelector(s => s.auth);
  const { projects } = useAppSelector(state => state.projectsReducer);

  // Determine actual project context
  const selectedCalendarProjectId = filters.project_id;
  const project = projectFromUrl || (projects.data || []).find(p => p.id === selectedCalendarProjectId);

  const handleQuickCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const startDate = dayjs(quickCreateDate).hour(9).minute(0).second(0);
      let finalTitle = title.trim();

      // For quick mood, default to happy
      if (eventType === 'mood_entry') {
        finalTitle = `😊 Happy · E:🌤 Moderate`;
      }

      const isTeamType = ['meeting', 'webinar', 'team_note', 'task_deadline'].includes(eventType);

      const payload: ICreateEventPayload = {
        title: finalTitle,
        type: eventType as any,
        start_time: startDate.toISOString(),
        end_time: startDate.add(1, 'hour').toISOString(),
        all_day: false,
        priority: 'medium',
        reminder_minutes: [60],
        mood: eventType === 'mood_entry' ? 'happy' : undefined,
        energy_level: eventType === 'mood_entry' ? 3 : undefined,

        // Contextual IDs - STRICT SEPARATION
        project_id: project?.id || null,
        team_id: calendarMode === 'team' ? (project?.team_id || activeTeamId || null) : null,
        event_scope: calendarMode,
        assigned_user_ids: [], // Default to empty (creator only)
      };
      await dispatch(createEvent(payload));
      dispatch(closeQuickCreate());
    } finally {
      setSaving(false);
    }
  };

  const handleMoreOptions = () => {
    dispatch(openSlidePanel({ mode: 'create' }));
    dispatch(closeQuickCreate());
  };

  return (
    <Modal
      open={quickCreateOpen}
      onCancel={() => dispatch(closeQuickCreate())}
      title={
        <Space>
          <ClockCircleOutlined style={{ color: '#1677ff' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>{timeStr}</Text>
        </Space>
      }
      footer={null}
      width={400}
      centered={false}
      styles={{
        content: { top: 200 },
      }}
      destroyOnClose
    >
      {/* Title Input */}
      <Input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Event title..."
        size="large"
        style={{ fontWeight: 600, marginBottom: 12 }}
        onPressEnter={handleQuickCreate}
        autoFocus
      />

      {/* Type selector */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Event type
        </Text>
        <div className="qcp-type-row">
          {EVENT_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`qcp-type-chip ${eventType === opt.value ? 'active' : ''}`}
              onClick={() => setEventType(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          type="link"
          icon={<ArrowRightOutlined />}
          onClick={handleMoreOptions}
          style={{ padding: 0, fontWeight: 600 }}
        >
          More options
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={saving}
          disabled={!title.trim()}
          onClick={handleQuickCreate}
          style={{ fontWeight: 600 }}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
};

export default QuickCreatePopover;
