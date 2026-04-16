import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Typography, Space, Avatar, Divider, Spin } from '@/shared/antd-imports';
import { CloseOutlined, UserOutlined } from '@/shared/antd-imports';
import dayjs from 'dayjs';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { setMoodPanelOpen, createEvent } from '@/features/calendar/calendarSlice';
import { calendarApiService } from '@/api/calendar/calendar.api.service';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MOODS = [
  { value: 'happy',   emoji: '😊', label: 'Happy',   bg: '#f6ffed', border: '#52c41a' },
  { value: 'neutral', emoji: '😐', label: 'Neutral',  bg: '#fffbe6', border: '#faad14' },
  { value: 'sad',     emoji: '😞', label: 'Sad',      bg: '#fff1f0', border: '#f5222d' },
];

const MoodPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { moodPanelDate } = useAppSelector(state => state.calendarReducer);
  const [form] = Form.useForm();
  const [selectedMood, setSelectedMood] = useState<string | null>('happy');
  const [teamMoods, setTeamMoods] = useState<any[]>([]);
  const [loadingMoods, setLoadingMoods] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing team moods for this date
  useEffect(() => {
    if (!moodPanelDate) return;
    setLoadingMoods(true);
    calendarApiService.getTeamMoods(moodPanelDate)
      .then(res => setTeamMoods(res.body || []))
      .catch(() => {})
      .finally(() => setLoadingMoods(false));
  }, [moodPanelDate]);

  const handleClose = () => dispatch(setMoodPanelOpen({ open: false }));

  const handleSubmit = async () => {
    if (!selectedMood || !moodPanelDate) return;
    const values = form.getFieldsValue();

    setSubmitting(true);
    try {
      await dispatch(createEvent({
        title: `Mood: ${selectedMood}`,
        description: values.note || '',
        type: 'mood_entry',
        start_time: dayjs(moodPanelDate).startOf('day').toISOString(),
        all_day: true,
        priority: 'low',
        mood: selectedMood as any,
      }));

      // Re-fetch moods
      const res = await calendarApiService.getTeamMoods(moodPanelDate);
      setTeamMoods(res.body || []);
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  const getMoodEmoji = (mood: string) => MOODS.find(m => m.value === mood)?.emoji || '😊';
  const formatDate = (date: string | null) =>
    date ? dayjs(date).format('dddd, MMMM D, YYYY') : '';

  return (
    <div className="mood-side-panel">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Title level={5} style={{ margin: 0, fontWeight: 700 }}>Daily Mood 🌈</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{formatDate(moodPanelDate)}</Text>
        </div>
        <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
      </div>

      {/* Mood selector */}
      <Text strong style={{ display: 'block', marginBottom: 12 }}>How are you feeling?</Text>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {MOODS.map(mood => (
          <button
            key={mood.value}
            onClick={() => setSelectedMood(mood.value)}
            style={{
              flex: 1,
              border: `2px solid ${selectedMood === mood.value ? mood.border : '#f0f0f0'}`,
              borderRadius: 12,
              padding: '12px 8px',
              background: selectedMood === mood.value ? mood.bg : '#fafafa',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center',
              transform: selectedMood === mood.value ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 4 }}>{mood.emoji}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#595959' }}>{mood.label}</div>
          </button>
        ))}
      </div>

      {/* Note */}
      <Form form={form} layout="vertical">
        <Form.Item name="note" label="One-line note (optional)">
          <TextArea
            placeholder="What's on your mind today?"
            rows={2}
            style={{ resize: 'none' }}
          />
        </Form.Item>
      </Form>

      <Button
        type="primary"
        block
        loading={submitting}
        onClick={handleSubmit}
        style={{ fontWeight: 600, marginBottom: 24, height: 40 }}
        disabled={!selectedMood}
      >
        Log Mood
      </Button>

      <Divider style={{ margin: '0 0 16px' }} />

      {/* Team moods for this day */}
      <Text strong style={{ display: 'block', marginBottom: 12 }}>
        Team's Mood Today
      </Text>
      <Spin spinning={loadingMoods}>
        {teamMoods.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>No moods logged yet</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teamMoods.map(entry => {
              const user = typeof entry.user_id === 'object' ? entry.user_id : null;
              return (
                <div
                  key={entry._id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: '#fafafa', border: '1px solid #f0f0f0',
                  }}
                >
                  <Avatar src={user?.avatar_url} size={32} icon={<UserOutlined />} style={{ background: '#2563eb' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name || 'Team Member'}</div>
                    {entry.description && (
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{entry.description}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 22 }}>{getMoodEmoji(entry.mood)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default MoodPanel;
