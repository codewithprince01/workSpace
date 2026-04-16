import React from 'react';
import {
  Drawer, Button, Tag, Space, Typography, Divider, Avatar, Popconfirm
} from '@/shared/antd-imports';
import {
  EditOutlined, DeleteOutlined, CalendarOutlined,
  ClockCircleOutlined, UserOutlined, FlagOutlined, BellOutlined,
  PaperClipOutlined
} from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setDetailPanelOpen, openSlidePanel, deleteEvent } from '@/features/calendar/calendarSlice';

const { Title, Text, Paragraph } = Typography;

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  meeting:       { label: '🤝 Meeting',       color: '#1677ff', bg: '#e6f4ff' },
  webinar:       { label: '🎥 Webinar',       color: '#722ed1', bg: '#f9f0ff' },
  reminder:      { label: '🔔 Reminder',      color: '#fa8c16', bg: '#fff7e6' },
  task_deadline: { label: '⏰ Task Deadline',  color: '#f5222d', bg: '#fff1f0' },
  team_note:     { label: '📝 Team Note',     color: '#52c41a', bg: '#f6ffed' },
  mood_entry:    { label: '😊 Mood Entry',    color: '#faad14', bg: '#fffbe6' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'green' },
  medium: { label: 'Medium', color: 'orange' },
  high:   { label: 'High',   color: 'red' },
};

const MOOD_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  amazing:  { label: 'Amazing',  emoji: '🤩', color: '#f5222d' },
  happy:    { label: 'Happy',    emoji: '😊', color: '#52c41a' },
  neutral:  { label: 'Neutral',  emoji: '😐', color: '#faad14' },
  sad:      { label: 'Sad',      emoji: '😞', color: '#1677ff' },
  stressed: { label: 'Stressed', emoji: '😤', color: '#722ed1' },
};

const ENERGY_LABELS: Record<number, string> = {
  1: '⚡ Very Low',
  2: '🔋 Low',
  3: '🌤 Moderate',
  4: '⚡ High',
  5: '🔥 Peak',
};

const REMINDER_LABELS: Record<number, string> = {
  5: '5 min', 15: '15 min', 30: '30 min',
  60: '1 hour', 120: '2 hours', 1440: '1 day',
};

const EventDetailPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { selectedEvent, detailPanelOpen } = useAppSelector(state => state.calendarReducer);

  if (!selectedEvent) return null;

  const cfg = TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.meeting;
  const priorityCfg = PRIORITY_CONFIG[selectedEvent.priority] || PRIORITY_CONFIG.medium;
  const assignedUser = typeof selectedEvent.assigned_user_id === 'object'
    ? selectedEvent.assigned_user_id as any : null;

  const moodCfg = selectedEvent.mood ? MOOD_CONFIG[selectedEvent.mood] : null;

  const handleEdit = () => dispatch(openSlidePanel({ mode: 'edit', event: selectedEvent }));
  const handleDelete = async () => {
    await dispatch(deleteEvent(selectedEvent._id));
    dispatch(setDetailPanelOpen(false));
  };

  const drawerTitle = (
    <Space>
      <span style={{
        display: 'inline-block',
        background: cfg.bg,
        color: cfg.color,
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
      }}>
        {cfg.label}
      </span>
    </Space>
  );

  const drawerFooter = (
    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
      <Button
        type="primary"
        icon={<EditOutlined />}
        onClick={handleEdit}
        style={{ fontWeight: 600 }}
      >
        Edit
      </Button>
      <Popconfirm
        title="Delete this event?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <Button danger icon={<DeleteOutlined />}>Delete</Button>
      </Popconfirm>
    </Space>
  );

  return (
    <Drawer
      title={drawerTitle}
      placement="right"
      width={400}
      open={detailPanelOpen}
      onClose={() => dispatch(setDetailPanelOpen(false))}
      footer={drawerFooter}
      styles={{
        header: { borderBottom: `3px solid ${cfg.color}` },
        footer: { padding: '12px 24px' },
      }}
    >
      {/* Title */}
      <Title level={4} style={{ marginBottom: 16, fontWeight: 700 }}>
        {selectedEvent.title}
      </Title>

      {/* Date & Time */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <CalendarOutlined style={{ color: '#8c8c8c' }} />
          <Text strong>
            {dayjs(selectedEvent.start_time).format('dddd, MMMM D, YYYY')}
          </Text>
        </Space>
        {!selectedEvent.all_day && (
          <div style={{ marginTop: 4, paddingLeft: 22 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dayjs(selectedEvent.start_time).format('h:mm A')}
              {selectedEvent.end_time && ` – ${dayjs(selectedEvent.end_time).format('h:mm A')}`}
            </Text>
          </div>
        )}
      </div>

      {/* Mood Entry Specifics */}
      {selectedEvent.type === 'mood_entry' && (
        <div style={{
          background: moodCfg ? `${moodCfg.color}10` : 'rgba(0,0,0,0.02)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: moodCfg ? `1px solid ${moodCfg.color}20` : '1px solid rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px' }}>{moodCfg?.emoji}</span>
            <div>
              <Text strong style={{ fontSize: '16px', display: 'block' }}>{moodCfg?.label}</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>Personal Mood Check-in</Text>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div style={{ marginBottom: '8px' }}>
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Energy Level</Text>
              <Text strong>{ENERGY_LABELS[selectedEvent.energy_level || 3]}</Text>
            </Space>
          </div>

          {selectedEvent.mood_tags && selectedEvent.mood_tags.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Feelings</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {selectedEvent.mood_tags.map((tag: string) => (
                  <Tag key={tag} style={{ borderRadius: '12px', margin: 0 }}>{tag}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Priority */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <FlagOutlined style={{ color: '#8c8c8c' }} />
          <Text type="secondary">Priority:</Text>
          <Tag color={priorityCfg.color}>{priorityCfg.label}</Tag>
        </Space>
      </div>

      {/* Assigned User */}
      {assignedUser && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <UserOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">Assigned to:</Text>
            <Space size={8}>
              <Avatar
                src={assignedUser.avatar_url}
                size="small"
                icon={<UserOutlined />}
                style={{ background: '#1677ff' }}
              />
              <Text strong>{assignedUser.name}</Text>
            </Space>
          </Space>
        </div>
      )}

      {/* Reminders */}
      {selectedEvent.reminder_minutes?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space align="start">
            <BellOutlined style={{ color: '#8c8c8c', marginTop: 2 }} />
            <div>
              <Text type="secondary">Reminders:</Text>
              <div style={{ marginTop: 6 }}>
                {selectedEvent.reminder_minutes.map((m: number) => (
                  <Tag key={m} style={{ marginBottom: 4 }}>
                    🔔 {REMINDER_LABELS[m] || `${m} min`} before
                  </Tag>
                ))}
              </div>
            </div>
          </Space>
        </div>
      )}

      {/* Description / Journal Note */}
      {selectedEvent.description && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <div>
            <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
              {selectedEvent.type === 'mood_entry' ? 'Journal Note' : 'Notes'}
            </Text>
            <Paragraph style={{
              lineHeight: 1.7,
              marginBottom: 0,
              fontSize: '14px',
              padding: '12px',
              background: 'rgba(0,0,0,0.02)',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.04)'
            }}>
              {selectedEvent.description}
            </Paragraph>
          </div>
        </>
      )}

      {/* Task link */}
      {selectedEvent.task_id && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <Space>
            <PaperClipOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>Linked to task #{selectedEvent.task_id.slice(-6)}</Text>
          </Space>
        </>
      )}

    </Drawer>
  );
};

export default EventDetailPanel;
