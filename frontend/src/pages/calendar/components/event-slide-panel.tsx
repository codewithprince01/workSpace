import React, { useEffect, useCallback, useState } from 'react';
import {
  Drawer, Form, Input, Button, Select, DatePicker, Space, Typography,
  Divider, Switch, Popconfirm, Tag, Slider, Rate, Tooltip
} from '@/shared/antd-imports';
import {
  CalendarOutlined, UserOutlined, BellOutlined, FlagOutlined,
  DeleteOutlined, SaveOutlined, ClockCircleOutlined, SmileOutlined,
  ThunderboltOutlined
} from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  closeSlidePanel, createEvent, updateEvent, deleteEvent,
} from '@/features/calendar/calendarSlice';
import { ICreateEventPayload } from '@/api/calendar/calendar.api.service';
import { canEditEvent, canDeleteEvent } from '@/utils/calendarPermissions';
import MemberMultiSelect from './member-multi-select';

const { TextArea } = Input;
const { Text } = Typography;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Constants ────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'meeting',       label: '🤝 Meeting',       color: '#1677ff' },
  { value: 'webinar',       label: '🎥 Webinar',       color: '#722ed1' },
  { value: 'reminder',      label: '🔔 Reminder',      color: '#fa8c16' },
  { value: 'task_deadline', label: '⏰ Task Deadline',  color: '#f5222d' },
  { value: 'team_note',     label: '📝 Note',         color: '#52c41a' },
  { value: 'mood_entry',    label: '😊 Mood',         color: '#eb2f96' },
  { value: 'custom',        label: '✨ Custom',       color: '#13c2c2' },
];

const PRIORITIES = [
  { value: 'low',    label: '🟢 Low' },
  { value: 'medium', label: '🟠 Medium' },
  { value: 'high',   label: '🔴 High' },
];

const REMINDER_PRESETS = [
  { minutes: 5,    label: '5 min before' },
  { minutes: 15,   label: '15 min before' },
  { minutes: 30,   label: '30 min before' },
  { minutes: 60,   label: '1 hour before' },
  { minutes: 120,  label: '2 hours before' },
  { minutes: 1440, label: '1 day before' },
];

const MOOD_OPTIONS = [
  { value: 'amazing',  emoji: '🤩', label: 'Amazing',  color: '#f5222d' },
  { value: 'happy',    emoji: '😊', label: 'Happy',    color: '#52c41a' },
  { value: 'neutral',  emoji: '😐', label: 'Neutral',  color: '#faad14' },
  { value: 'sad',      emoji: '😞', label: 'Sad',      color: '#1677ff' },
  { value: 'stressed', emoji: '😤', label: 'Stressed', color: '#722ed1' },
];

const MOOD_TAGS = [
  'Productive', 'Tired', 'Creative', 'Social', 'Focused',
  'Anxious', 'Grateful', 'Excited', 'Calm', 'Motivated',
  'Burned out', 'Inspired', 'Overwhelmed', 'Content', 'Restless',
];

const TYPE_COLOR_MAP: Record<string, string> = {
  meeting: '#1677ff', webinar: '#722ed1', reminder: '#fa8c16',
  task_deadline: '#f5222d', team_note: '#52c41a', mood_entry: '#faad14',
};

// ── Smart Reminder Selector ──────────────────────────────────

const ReminderSelector: React.FC<{
  value?: number[];
  onChange?: (v: number[]) => void;
}> = ({ value = [], onChange }) => {
  const toggle = (minutes: number) => {
    const next = value.includes(minutes)
      ? value.filter(m => m !== minutes)
      : [...value, minutes];
    onChange?.(next);
  };
  return (
    <div className="cal-reminder-selector">
      {REMINDER_PRESETS.map(preset => (
        <button
          key={preset.minutes}
          type="button"
          className={`cal-reminder-chip ${value.includes(preset.minutes) ? 'active' : ''}`}
          onClick={() => toggle(preset.minutes)}
        >
          {value.includes(preset.minutes) ? '✓ ' : ''}{preset.label}
        </button>
      ))}
    </div>
  );
};

// ── Mood Picker (upgraded 5-emoji) ───────────────────────────

const MoodPicker: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className="cal-mood-picker">
    {MOOD_OPTIONS.map(opt => (
      <button
        key={opt.value}
        type="button"
        className={`cal-mood-option ${value === opt.value ? 'active' : ''}`}
        style={value === opt.value ? { borderColor: opt.color, background: `${opt.color}14` } : {}}
        onClick={() => onChange?.(opt.value)}
      >
        <span className="cal-mood-emoji">{opt.emoji}</span>
        <span className="cal-mood-label">{opt.label}</span>
      </button>
    ))}
  </div>
);

// ── Mood Tag Picker ──────────────────────────────────────────

const MoodTagPicker: React.FC<{
  value?: string[];
  onChange?: (v: string[]) => void;
}> = ({ value = [], onChange }) => {
  const toggle = (tag: string) => {
    const next = value.includes(tag)
      ? value.filter(t => t !== tag)
      : value.length < 5 ? [...value, tag] : value;
    onChange?.(next);
  };
  return (
    <div className="cal-mood-tags">
      {MOOD_TAGS.map(tag => (
        <button
          key={tag}
          type="button"
          className={`cal-mood-tag ${value.includes(tag) ? 'active' : ''}`}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
      {value.length > 0 && (
        <button
          type="button"
          className="cal-mood-tag-clear"
          onClick={() => onChange?.([])}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
};

// ── Energy Slider ────────────────────────────────────────────

const EnergySlider: React.FC<{
  value?: number;
  onChange?: (v: number) => void;
}> = ({ value = 3, onChange }) => {
  const labels = ['', '⚡ Very Low', '🔋 Low', '🌤 Moderate', '⚡ High', '🔥 Peak'];
  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Energy level</Text>
        <Text style={{ fontSize: 13, fontWeight: 600, color: '#faad14' }}>{labels[value]}</Text>
      </div>
      <Slider
        min={1}
        max={5}
        value={value}
        onChange={onChange}
        marks={{ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }}
        style={{ marginBottom: 0 }}
      />
    </div>
  );
};

// ── Advanced Mood Form ───────────────────────────────────────

const MoodForm: React.FC = () => (
  <>
    {/* Large emoji picker */}
    <div className="cal-mood-section-header">
      <SmileOutlined style={{ color: '#faad14' }} />
      <span>How are you feeling today?</span>
    </div>
    <Form.Item name="mood" rules={[{ required: true, message: 'Select a mood' }]} style={{ marginBottom: 16 }}>
      <MoodPicker />
    </Form.Item>

    <Divider style={{ margin: '4px 0 14px' }} />

    {/* Energy level */}
    <div className="cal-mood-section-header">
      <ThunderboltOutlined style={{ color: '#fa8c16' }} />
      <span>Energy Level</span>
    </div>
    <Form.Item name="energy_level" initialValue={3} style={{ marginBottom: 16 }}>
      <EnergySlider />
    </Form.Item>

    {/* Mood annotation / journal text */}
    <div className="cal-mood-section-header">
      <span>📓</span>
      <span>Journal / Note</span>
      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>(shown on calendar)</Text>
    </div>
    <Form.Item name="description" style={{ marginBottom: 16 }}>
      <TextArea
        rows={4}
        placeholder="What's on your mind? Any highlights from today? (max 280 chars)"
        maxLength={280}
        showCount
        style={{ resize: 'none', fontSize: 13, lineHeight: 1.7 }}
      />
    </Form.Item>

    {/* Mood tags */}
    <div className="cal-mood-section-header">
      <span>🏷️</span>
      <span>Tags</span>
      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>(pick up to 5)</Text>
    </div>
    <Form.Item name="mood_tags" style={{ marginBottom: 16 }}>
      <MoodTagPicker />
    </Form.Item>

    {/* Date */}
    <Form.Item name="start_time" label="Date" rules={[{ required: true }]}>
      <DatePicker format="MMM DD, YYYY" style={{ width: '100%' }} />
    </Form.Item>
  </>
);

// ── Task Deadline Form ───────────────────────────────────────

const TaskDeadlineForm: React.FC<{ isEdit: boolean; selectedEvent: any }> = ({ isEdit, selectedEvent }) => (
  <>
    {/* Can always set a title for the deadline */}
    <Form.Item name="title" label="Deadline Title" rules={[{ required: true, message: 'Enter a title' }]}>
      <Input
        placeholder="e.g. Project proposal due"
        size="large"
        style={{ fontWeight: 600 }}
        prefix={<span>⏰</span>}
      />
    </Form.Item>

    <Form.Item name="start_time" label="Deadline Date" rules={[{ required: true, message: 'Select deadline date' }]}>
      <DatePicker
        showTime={{ format: 'HH:mm' }}
        format="MMM DD, YYYY HH:mm"
        style={{ width: '100%' }}
        placeholder="Select deadline date & time"
        suffixIcon={<ClockCircleOutlined />}
      />
    </Form.Item>

    <Form.Item name="priority" label={<><FlagOutlined /> Priority</>}>
      <Select options={PRIORITIES} style={{ width: 200 }} />
    </Form.Item>

    <Form.Item name="description" label="Description (optional)">
      <TextArea
        rows={3}
        placeholder="Describe what needs to be done by this deadline..."
        style={{ resize: 'none' }}
      />
    </Form.Item>

    <Form.Item name="reminder_minutes" label={<><BellOutlined /> Remind me before</>}>
      <ReminderSelector />
    </Form.Item>

    {isEdit && selectedEvent?.task_id && (
      <div className="cal-task-readonly" style={{ marginTop: 8 }}>
        <Tag color="blue">📌 Linked to a task on the board</Tag>
        <div style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            The date change will only update the calendar entry — to change the actual task deadline, edit the task on the board.
          </Text>
        </div>
      </div>
    )}
  </>
);

// ── Main Slide Panel ─────────────────────────────────────────

const EventSlidePanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const {
    slidePanelOpen, slidePanelMode, selectedEvent, teamMembers, currentDate,
    calendarMode, selectedTeamId, filters
  } = useAppSelector(state => state.calendarReducer);

  // State for multi-select member assignment
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const isEdit = slidePanelMode === 'edit';
  const eventType = Form.useWatch('type', form);
  const allDay = Form.useWatch('all_day', form);

  const memberOptions = teamMembers.map(m => ({ value: m._id, label: `${m.name} (${m.email})` }));
  const currentTypeColor = eventType ? (TYPE_COLOR_MAP[eventType] || '#1677ff') : '#1677ff';

  useEffect(() => {
    if (!slidePanelOpen) return;

    if (isEdit && selectedEvent) {
      // Initialize assignedUserIds from selectedEvent
      const eventAssignedUserIds = selectedEvent.assigned_user_ids || [];
      const eventExternalAssignedEmails = selectedEvent.external_assigned_emails || [];

      setAssignedUserIds(
        [
          ...eventAssignedUserIds.map(id => typeof id === 'object' ? (id as any)._id : id),
          ...eventExternalAssignedEmails,
        ]
      );

      form.setFieldsValue({
        title: selectedEvent.title,
        description: selectedEvent.description,
        type: selectedEvent.type,
        start_time: dayjs(selectedEvent.start_time),
        end_time: selectedEvent.end_time ? dayjs(selectedEvent.end_time) : null,
        all_day: selectedEvent.all_day,
        priority: selectedEvent.priority || 'medium',
        mood: selectedEvent.mood,
        energy_level: selectedEvent.energy_level || 3,
        mood_tags: selectedEvent.mood_tags || [],
        reminder_minutes: selectedEvent.reminder_minutes || [],
        assigned_user_id: typeof selectedEvent.assigned_user_id === 'object'
          ? (selectedEvent.assigned_user_id as any)?._id
          : selectedEvent.assigned_user_id,
      });
    } else {
      form.resetFields();
      const defaultStart = dayjs(currentDate).hour(9).minute(0).second(0);
      form.setFieldsValue({
        type: 'meeting',
        priority: 'medium',
        all_day: false,
        start_time: defaultStart,
        end_time: defaultStart.add(1, 'hour'),
        reminder_minutes: [60],
        energy_level: 3,
        mood_tags: [],
      });
      // Reset multi-select state for new events
      setAssignedUserIds([]);
    }
  }, [slidePanelOpen, isEdit, selectedEvent, currentDate]);

  const user = useAppSelector(state => state.auth.user);

  const canDelete = selectedEvent ? canDeleteEvent(user, selectedEvent, selectedTeamId) : false;

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const normalizedSelections = assignedUserIds
        .map(value => String(value).trim())
        .filter(Boolean);
      const externalAssignedEmails = normalizedSelections.filter(value => EMAIL_REGEX.test(value));
      const internalAssignedUserIds = normalizedSelections.filter(value => !EMAIL_REGEX.test(value));

      // For mood entries, auto-generate a display title from the emoji + energy
      let title = values.title;
      if (values.type === 'mood_entry') {
        const moodOpt = MOOD_OPTIONS.find(m => m.value === values.mood);
        const energyLabels: Record<number, string> = { 1: '⚡ Very Low', 2: '🔋 Low', 3: '🌤 Moderate', 4: '⚡ High', 5: '🔥 Peak' };
        title = `${moodOpt?.emoji || '😊'} ${moodOpt?.label || 'Mood'} · E:${energyLabels[values.energy_level || 3]}`;
      }

      const payload: ICreateEventPayload = {
        title,
        description: values.description || '',
        type: values.type,
        start_time: values.start_time?.toISOString() || new Date().toISOString(),
        end_time: values.end_time?.toISOString() || null,
        all_day: values.all_day || false,
        priority: values.priority || 'medium',
        mood: values.type === 'mood_entry' ? values.mood : null,
        reminder_minutes: values.reminder_minutes || [],
        assigned_user_ids: internalAssignedUserIds,
        external_assigned_emails: externalAssignedEmails,
        
        // Contextual IDs - STRICT SEPARATION
        project_id: filters.project_id || null,
        team_id: calendarMode === 'team' ? (selectedTeamId || null) : null,
        event_scope: calendarMode || 'personal',

        // Extra mood fields stored in a meta object
        ...(values.type === 'mood_entry' ? {
          energy_level: values.energy_level,
          mood_tags: values.mood_tags || [],
        } : {}),
      };

      if (isEdit && selectedEvent) {
        await dispatch(updateEvent({ id: selectedEvent._id, payload }));
      } else {
        await dispatch(createEvent(payload));
      }
    } catch {
      // validation handled by form
    }
  }, [form, isEdit, selectedEvent, dispatch, assignedUserIds, filters.project_id, calendarMode, selectedTeamId]);

  const handleDelete = useCallback(async () => {
    if (!selectedEvent) return;
    await dispatch(deleteEvent(selectedEvent._id));
  }, [selectedEvent, dispatch]);

  const drawerTitle = (
    <Space>
      <CalendarOutlined style={{ color: currentTypeColor }} />
      <span>{isEdit ? 'Edit Event' : 'New Event'}</span>
    </Space>
  );

  const drawerFooter = (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      {isEdit && selectedEvent ? (
        canDelete ? (
          <Popconfirm
            title="Delete this event?"
            description="This action cannot be undone."
            onConfirm={handleDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
            placement="topLeft"
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        ) : (
          <Tooltip title="You can only delete events you created">
            <Button danger icon={<DeleteOutlined />} disabled>Delete</Button>
          </Tooltip>
        )
      ) : <div />}
      <Space>
        <Button onClick={() => dispatch(closeSlidePanel())}>Cancel</Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => form.submit()}
          style={{ fontWeight: 600 }}
        >
          {isEdit ? 'Save Changes' : 'Create Event'}
        </Button>
      </Space>
    </Space>
  );

  return (
    <Drawer
      title={drawerTitle}
      placement="right"
      width={540}
      open={slidePanelOpen}
      onClose={() => dispatch(closeSlidePanel())}
      footer={drawerFooter}
      destroyOnClose
      styles={{
        header: { borderBottom: `3px solid ${currentTypeColor}` },
        footer: { padding: '12px 24px' },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit}
      >
        {/* Event Type */}
        <Form.Item name="type" label="Event Type" rules={[{ required: true }]}>
          <Select options={EVENT_TYPES.map(t => ({ ...t, color: undefined }))} size="middle" />
        </Form.Item>

        {/* Assignees — Inline layout as per user request */}
        <Form.Item className="cal-form-assignees-inline">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserOutlined /> Assignees:
            </span>
            <MemberMultiSelect
              members={teamMembers}
              selectedIds={assignedUserIds}
              onChange={(ids) => {
                setAssignedUserIds(ids);
              }}
              placeholder="Assign members..."
            />
          </div>
        </Form.Item>

        {/* Title — for meeting, webinar, reminder, note */}
        {eventType !== 'mood_entry' && (
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input
              placeholder="Event title..."
              autoFocus={!isEdit}
              size="large"
              style={{ fontWeight: 600 }}
            />
          </Form.Item>
        )}

        <Divider style={{ margin: '8px 0 12px' }} />

        {/* ── MEETING / WEBINAR ── */}
        {(eventType === 'meeting' || eventType === 'webinar') && (
          <>
            <Form.Item name="all_day" valuePropName="checked">
              <Space>
                <Switch size="small" />
                <Text type="secondary" style={{ fontSize: 13 }}>All day event</Text>
              </Space>
            </Form.Item>

            <Space style={{ width: '100%' }} size={12}>
              <Form.Item name="start_time" label="Start" rules={[{ required: true }]} style={{ flex: 1 }}>
                <DatePicker
                  showTime={!allDay}
                  format={allDay ? 'MMM DD, YYYY' : 'MMM DD, YYYY HH:mm'}
                  style={{ width: '100%' }}
                  suffixIcon={<ClockCircleOutlined />}
                />
              </Form.Item>
              <Form.Item name="end_time" label="End" style={{ flex: 1 }}>
                <DatePicker
                  showTime={!allDay}
                  format={allDay ? 'MMM DD, YYYY' : 'MMM DD, YYYY HH:mm'}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Space>

            <Form.Item name="priority" label={<><FlagOutlined /> Priority</>}>
              <Select options={PRIORITIES} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item name="description" label="Notes">
              <TextArea rows={3} placeholder="Add agenda or notes..." style={{ resize: 'none' }} />
            </Form.Item>

            <Form.Item name="reminder_minutes" label={<><BellOutlined /> Reminders</>}>
              <ReminderSelector />
            </Form.Item>
          </>
        )}

        {/* ── NOTE ── */}
        {eventType === 'team_note' && (
          <>
            <Form.Item name="description" label="Note Content" rules={[{ required: true, message: 'Add content' }]}>
              <TextArea
                rows={8}
                placeholder="Write your team note here..."
                style={{ resize: 'none', fontSize: 14, lineHeight: 1.7 }}
              />
            </Form.Item>
            <Form.Item name="start_time" label="Date" rules={[{ required: true }]}>
              <DatePicker format="MMM DD, YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}

        {/* ── MOOD ENTRY (Advanced) ── */}
        {eventType === 'mood_entry' && <MoodForm />}

        {/* ── REMINDER ── */}
        {eventType === 'reminder' && (
          <>
            <Form.Item name="start_time" label="When" rules={[{ required: true }]}>
              <DatePicker showTime format="MMM DD, YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="description" label="Note">
              <Input placeholder="What should you remember?" />
            </Form.Item>
            <Form.Item name="reminder_minutes" label={<><BellOutlined /> Remind me</>}>
              <ReminderSelector />
            </Form.Item>
          </>
        )}

        {/* ── TASK DEADLINE (editable) ── */}
        {eventType === 'task_deadline' && (
          <TaskDeadlineForm isEdit={isEdit} selectedEvent={selectedEvent} />
        )}

        {/* ── CUSTOM EVENT ── */}
        {eventType === 'custom' && (
          <>
            <Form.Item name="start_time" label="Date & Time" rules={[{ required: true }]}>
              <DatePicker showTime format="MMM DD, YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <TextArea rows={3} placeholder="Describe your event..." style={{ resize: 'none' }} />
            </Form.Item>
          </>
        )}
      </Form>
    </Drawer>
  );
};

export default EventSlidePanel;
