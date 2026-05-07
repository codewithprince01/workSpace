import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, DatePicker, Select, Button, Space, message, Avatar } from 'antd';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { createTodo, updateTodo, searchAssignableUsers } from './todoSlice';
import { ITodo, ITodoUser } from '@/api/todo/todo.api.service';
import dayjs from 'dayjs';

const { Option } = Select;

interface Props {
  open: boolean;
  todo: ITodo | null; // null for create
  onClose: () => void;
}

const getColorFromName = (name: string) => {
    const colors = [
        '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', 
        '#52c41a', '#eb2f96', '#fa8c16', '#a0d911', '#13c2c2'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

const TodoFormModal: React.FC<Props> = ({ open, todo, onClose }) => {
  const [form] = Form.useForm();
  const dispatch = useAppDispatch();
  const { users, usersLoading } = useAppSelector(state => state.todoReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDark = themeMode === 'dark';
  const [submitting, setSubmitting] = useState(false);

  const normalizeDueDate = (val: any) => {
    if (!val) return null;
    let next = dayjs(val);
    if (!next.isValid()) return null;

    const hasDefaultTime =
      next.minute() === 0 &&
      next.second() === 0 &&
      (next.hour() === 0 || next.hour() === 12);

    if (hasDefaultTime) {
      const now = dayjs();
      next = next.hour(now.hour()).minute(now.minute()).second(0).millisecond(0);
    }

    return next.toISOString();
  };

  useEffect(() => {
    if (open) {
      dispatch(searchAssignableUsers());
      form.resetFields();
      if (todo) {
        console.log('[TodoFormModal] Populating with todo:', todo);
        form.setFieldsValue({
          ...todo,
          due_date: todo.due_date ? dayjs(todo.due_date) : null,
          assigned_to: (todo.assigned_to || []).map(u => u._id)
        });
      }
    }
  }, [open, todo, form, dispatch]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    console.log('[TodoFormModal] handleSubmit values:', values);
    try {
      let dueDateValue = null;
      if (values.due_date) {
        dueDateValue = normalizeDueDate(values.due_date);
      }

      const payload = {
        ...values,
        due_date: dueDateValue,
      };

      console.log('[TodoFormModal] Sending payload:', payload);

      if (todo) {
        const resultAction = await dispatch(updateTodo({ id: todo._id, data: payload }));
        if (updateTodo.fulfilled.match(resultAction)) {
            message.success('Todo updated successfully');
            onClose();
        } else {
            const errorMsg = resultAction.payload as string || 'Update failed';
            message.error(errorMsg);
        }
      } else {
        const resultAction = await dispatch(createTodo(payload));
        if (createTodo.fulfilled.match(resultAction)) {
            message.success('Todo created successfully');
            onClose();
        } else {
            const errorMsg = resultAction.payload as string || 'Creation failed';
            message.error(errorMsg);
        }
      }
    } catch (err: any) {
      console.error('[TodoFormModal] Submit error:', err);
      message.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      key={todo?._id || 'new'}
      title={todo ? 'Edit Todo' : 'Create New Todo'}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Please enter a title' }]}
        >
          <Input placeholder="e.g. Finish security audit" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} placeholder="Add more details..." />
        </Form.Item>

        <Form.Item 
            name="assigned_to" 
            label="Assign To"
            extra="Search and select team members or any user in the directory"
        >
          <Select
            mode="multiple"
            placeholder="Search users by name or email..."
            loading={usersLoading}
            filterOption={false}
            onSearch={(val) => dispatch(searchAssignableUsers(val))}
            style={{ width: '100%' }}
            dropdownStyle={{ 
                background: isDark ? '#1d2633' : '#fff', 
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` 
            }}
          >
            {users.map(u => (
              <Option key={u._id} value={u._id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <Avatar 
                    size="small" 
                    src={u.avatar_url} 
                    style={{ 
                        background: getColorFromName(u.name), 
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                        fontWeight: 600
                    }}
                  >
                    {u.name[0].toUpperCase()}
                  </Avatar>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#fff' : '#262626' }}>{u.name}</span>
                    <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}>{u.email}</span>
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="priority" label="Priority" initialValue="medium">
          <Select dropdownStyle={{ 
              background: isDark ? '#1d2633' : '#fff', 
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` 
          }}>
            <Option value="low">Low</Option>
            <Option value="medium">Medium</Option>
            <Option value="high">High</Option>
            <Option value="urgent">Urgent</Option>
          </Select>
        </Form.Item>

        <Form.Item name="labels" label="Labels">
          <Select mode="tags" placeholder="Add labels (press enter)" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="due_date" label="Due Date">
          <DatePicker 
            showTime={{ format: 'hh:mm A', use12Hours: true }}
            format="YYYY-MM-DD hh:mm A"
            disabledDate={(current) => current && current < dayjs().startOf('day')}
            disabledTime={(current) => {
              if (!current || !dayjs(current).isSame(dayjs(), 'day')) return {};
              const now = dayjs();
              return {
                disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
                disabledMinutes: (selectedHour: number) =>
                  selectedHour === now.hour()
                    ? Array.from({ length: now.minute() }, (_, i) => i)
                    : [],
              };
            }}
            onCalendarChange={(val) => {
              const selected = Array.isArray(val) ? val[0] : val;
              const normalized = selected ? dayjs(normalizeDueDate(selected) || undefined) : null;
              if (normalized) {
                form.setFieldsValue({ due_date: normalized });
              }
            }}
            needConfirm={false}
            style={{ width: '100%' }} 
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {todo ? 'Save Changes' : 'Create Todo'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
    <style>{`
        .ant-modal-content {
            background: ${isDark ? '#1f1f1f' : '#fff'} !important;
        }
        .ant-modal-header {
            background: ${isDark ? '#1f1f1f' : '#fff'} !important;
            border-bottom: ${isDark ? '1px solid #303030' : '1px solid #f0f0f0'} !important;
        }
        .ant-modal-title {
            color: ${isDark ? '#fff' : '#262626'} !important;
        }
        .ant-form-item-label > label {
            color: ${isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)'} !important;
        }
        .ant-input, .ant-input-affix-wrapper, .ant-picker, .ant-select-selector {
            background: ${isDark ? '#141414' : '#fff'} !important;
            border-color: ${isDark ? '#434343' : '#d9d9d9'} !important;
            color: ${isDark ? '#fff' : 'inherit'} !important;
        }
        .ant-input-placeholder, .ant-input::placeholder {
            color: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} !important;
        }
        .ant-modal-close-x {
            color: ${isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} !important;
        }
    `}</style>
    </>
  );
};

export default TodoFormModal;
