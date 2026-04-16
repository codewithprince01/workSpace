import React, { useEffect } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, Checkbox, Button, Space, Typography, Divider, Tag
} from '@/shared/antd-imports';
import { CalendarOutlined, ClockCircleOutlined, UserOutlined, TeamOutlined, FlagOutlined, BellOutlined } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setEventModalOpen, createEvent, updateEvent } from '@/features/calendar/calendarSlice';
import { ICreateEventPayload } from '@/api/calendar/calendar.api.service';

const { TextArea } = Input;

const EVENT_TYPES = [
  { value: 'meeting',       label: '🤝 Meeting',       color: '#1677ff' },
  { value: 'webinar',       label: '🎥 Webinar',       color: '#722ed1' },
  { value: 'reminder',      label: '🔔 Reminder',      color: '#fa8c16' },
  { value: 'task_deadline', label: '⏰ Task Deadline',  color: '#f5222d' },
  { value: 'team_note',     label: '📝 Team Note',     color: '#52c41a' },
  { value: 'mood_entry',    label: '😊 Mood Entry',    color: '#faad14' },
];

const PRIORITIES = [
  { value: 'low',    label: '🟢 Low' },
  { value: 'medium', label: '🟠 Medium' },
  { value: 'high',   label: '🔴 High' },
];

const MOOD_OPTIONS = [
  { value: 'happy',   label: '😊 Happy' },
  { value: 'neutral', label: '😐 Neutral' },
  { value: 'sad',     label: '😞 Sad' },
];

const REMINDER_OPTIONS = [
  { value: 5,    label: '5 minutes before' },
  { value: 15,   label: '15 minutes before' },
  { value: 30,   label: '30 minutes before' },
  { value: 60,   label: '1 hour before' },
  { value: 120,  label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

const EventModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const { eventModalOpen, selectedEvent, teamMembers, currentDate } = useAppSelector(state => state.calendarReducer);
  const isEditing = !!selectedEvent && eventModalOpen;

  useEffect(() => {
    if (isEditing && selectedEvent) {
      form.setFieldsValue({
        title: selectedEvent.title,
        description: selectedEvent.description,
        type: selectedEvent.type,
        start_time: dayjs(selectedEvent.start_time),
        end_time: selectedEvent.end_time ? dayjs(selectedEvent.end_time) : null,
        all_day: selectedEvent.all_day,
        priority: selectedEvent.priority,
        mood: selectedEvent.mood,
        reminder_minutes: selectedEvent.reminder_minutes,
        assigned_user_id: typeof selectedEvent.assigned_user_id === 'object'
          ? (selectedEvent.assigned_user_id as any)?._id
          : selectedEvent.assigned_user_id,
        team_id: typeof selectedEvent.team_id === 'object'
          ? (selectedEvent.team_id as any)?._id
          : selectedEvent.team_id,
      });
    } else {
      form.setFieldsValue({
        type: 'meeting',
        priority: 'medium',
        start_time: dayjs(currentDate),
        reminder_minutes: [60],
        all_day: false,
      });
    }
  }, [isEditing, selectedEvent, currentDate, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: ICreateEventPayload = {
        title: values.title,
        description: values.description || '',
        type: values.type,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time ? values.end_time.toISOString() : null,
        all_day: values.all_day || false,
        priority: values.priority || 'medium',
        mood: values.type === 'mood_entry' ? values.mood : null,
        reminder_minutes: values.reminder_minutes || [60],
        assigned_user_id: values.assigned_user_id || null,
        team_id: values.team_id || null,
      };

      if (isEditing && selectedEvent) {
        await dispatch(updateEvent({ id: selectedEvent._id, payload }));
      } else {
        await dispatch(createEvent(payload));
      }

      form.resetFields();
      dispatch(setEventModalOpen(false));
    } catch (err) {
      // validation error — form handles display
    }
  };

  const handleCancel = () => {
    form.resetFields();
    dispatch(setEventModalOpen(false));
  };

  const eventType = Form.useWatch('type', form);
  const allDay = Form.useWatch('all_day', form);

  // Team options for dropdown
  const teamOptions = Array.from(
    new Map(
      teamMembers
        .filter((m: any) => m.team_id)
        .map((m: any) => [m.team_id?._id || m.team_id, { value: m.team_id?._id || m.team_id, label: m.team_id?.name || m.team_id }])
    ).values()
  );

  const memberOptions = teamMembers.map(m => ({
    value: m._id,
    label: `${m.name} (${m.email})`,
  }));

  return (
    <Modal
      open={eventModalOpen}
      onCancel={handleCancel}
      title={
        <Space>
          <CalendarOutlined style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 700 }}>{isEditing ? 'Edit Event' : 'New Event'}</span>
        </Space>
      }
      footer={null}
      width={560}
      styles={{ body: { paddingTop: 8 } }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit}
      >
        {/* Title */}
        <Form.Item name="title" rules={[{ required: true, message: 'Title is required' }]}>
          <Input
            placeholder="Event title..."
            size="large"
            style={{ fontWeight: 600, fontSize: 16 }}
            autoFocus
          />
        </Form.Item>

        {/* Type */}
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select
            options={EVENT_TYPES}
            size="large"
            optionRender={option => (
              <Space>
                <span>{option.label}</span>
              </Space>
            )}
          />
        </Form.Item>

        {/* Date & Time */}
        <Form.Item name="all_day" valuePropName="checked">
          <Checkbox>All day event</Checkbox>
        </Form.Item>

        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="start_time" label="Start" rules={[{ required: true, message: 'Start time required' }]} style={{ flex: 1 }}>
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
              suffixIcon={<ClockCircleOutlined />}
            />
          </Form.Item>
        </Space>

        {/* Priority */}
        <Form.Item name="priority" label={<><FlagOutlined /> Priority</>}>
          <Select options={PRIORITIES} />
        </Form.Item>

        {/* Mood (only for mood_entry) */}
        {eventType === 'mood_entry' && (
          <Form.Item name="mood" label="Mood" rules={[{ required: true, message: 'Please select a mood' }]}>
            <Select options={MOOD_OPTIONS} size="large" />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* Assigned User */}
        <Form.Item name="assigned_user_id" label={<><UserOutlined /> Assign to</>}>
          <Select
            showSearch
            allowClear
            placeholder="Select team member"
            options={memberOptions}
            filterOption={(input, option) =>
              (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        {/* Description */}
        <Form.Item name="description" label="Notes">
          <TextArea
            rows={3}
            placeholder="Add notes or description..."
            style={{ resize: 'none' }}
          />
        </Form.Item>

        {/* Reminders */}
        <Form.Item name="reminder_minutes" label={<><BellOutlined /> Reminders</>}>
          <Select
            mode="multiple"
            options={REMINDER_OPTIONS}
            placeholder="Set reminders"
            allowClear
          />
        </Form.Item>

        {/* Footer buttons */}
        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ fontWeight: 600 }}>
              {isEditing ? 'Save Changes' : 'Create Event'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EventModal;
