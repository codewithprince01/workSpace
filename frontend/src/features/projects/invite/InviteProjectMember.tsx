import { Button, Form, Input, Modal, Select, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { useParams } from 'react-router-dom';

interface InviteProjectMemberProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const InviteProjectMember = ({ open, onClose, onSuccess }: InviteProjectMemberProps) => {
  const { t } = useTranslation('projects');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { id } = useParams<{ id: string }>();

  const handleSubmit = async (values: { email: string; role: 'admin' | 'member' }) => {
    if (!id) return;

    try {
      setLoading(true);
      const res = await projectsApiService.inviteMember(id, values.email, values.role);
      
      if (res.done) {
        message.success('Invitation sent successfully');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res.message || 'Failed to send invitation');
      }
    } catch (error: any) {
        message.error(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Invite to Project"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ role: 'member' }}
      >
        <Form.Item
          name="email"
          label="Email Address"
          rules={[
            { required: true, message: 'Please enter an email' },
            { type: 'email', message: 'Please enter a valid email' }
          ]}
        >
          <Input placeholder="user@example.com" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: 'Please select a role' }]}
        >
          <Select>
            <Select.Option value="admin">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>Admin</span>
                <span style={{ fontSize: 12, color: '#888' }}>Full access including settings and reports</span>
              </div>
            </Select.Option>
            <Select.Option value="member">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>Member</span>
                <span style={{ fontSize: 12, color: '#888' }}>Can view and work on tasks, no admin controls</span>
              </div>
            </Select.Option>
          </Select>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Send Invitation
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default InviteProjectMember;
