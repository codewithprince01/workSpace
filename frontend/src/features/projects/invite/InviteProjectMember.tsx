import { Button, Form, Modal, Select, Avatar, Typography, Tag, Spin, theme, notification } from 'antd';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { useParams } from 'react-router-dom';
import { userDirectoryApiService, IUserSearchResult } from '@/api/super-admin/user-directory.api.service';
import { UserOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;
const { useToken } = theme;

interface InviteProjectMemberProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const InviteProjectMember = ({ open, onClose, onSuccess }: InviteProjectMemberProps) => {
  const { t } = useTranslation('projects');
  const { token } = useToken();
  const [form] = Form.useForm();
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const { id } = useParams<{ id: string }>();

  // Directory users — loaded once on modal open
  const [allUsers, setAllUsers]   = useState<IUserSearchResult[]>([]);
  const [filtered, setFiltered]   = useState<IUserSearchResult[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);

  // Pre-load all directory users when modal opens
  const loadDirectory = useCallback(async () => {
    setLoadingDir(true);
    try {
      const res = await userDirectoryApiService.list(1, 200, '');
      if (res.data?.done) {
        // list returns IProvisionedUser; adapt to IUserSearchResult shape
        const users: IUserSearchResult[] = (res.data.body || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          department: u.department || '',
          avatar_url: u.avatar_url || null,
        }));
        setAllUsers(users);
        setFiltered(users);
      }
    } catch { /* silent */ }
    finally { setLoadingDir(false); }
  }, []);

  useEffect(() => {
    if (open) loadDirectory();
    else { form.resetFields(); setFiltered([]); setAllUsers([]); }
  }, [open, loadDirectory, form]);

  // Local filter (instant, no network)
  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) { setFiltered(allUsers); return; }
    const lq = q.toLowerCase();
    setFiltered(allUsers.filter(u =>
      u.name.toLowerCase().includes(lq) ||
      u.email.toLowerCase().includes(lq) ||
      (u.department || '').toLowerCase().includes(lq)
    ));
  }, [allUsers]);

  const handleSubmit = async (values: { email: string; role: 'admin' | 'member' }) => {
    if (!id) return;
    try {
      setSubmitting(true);
      const res = await projectsApiService.inviteMember(id, values.email, values.role);
      if (res.done) {
        notification.success({ message: `Invitation sent as ${values.role}` });
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      const msg =
        (axios.isAxiosError(error) ? (error.response?.data as any)?.message : null) ||
        error?.message ||
        'Failed to send invitation';
      notification.error({ message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Build option list — show directory users; also allow free-type email
  const options = filtered.map(u => ({
    value: u.email,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar
          size={26}
          src={u.avatar_url}
          icon={<UserOutlined />}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0, fontSize: 11 }}
        >
          {!u.avatar_url && u.name?.[0]?.toUpperCase()}
        </Avatar>
        <div style={{ lineHeight: 1.35, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {u.name}
          </div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {u.email}
            {u.department && <Tag color="purple" style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{u.department}</Tag>}
          </div>
        </div>
      </div>
    ),
  }));

  return (
    <Modal
      title={
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Invite to Project</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {loadingDir ? 'Loading directory…' : `${allUsers.length} user${allUsers.length !== 1 ? 's' : ''} in directory`}
          </Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={460}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: 'member' }}>

        {/* Email / user picker */}
        <Form.Item
          name="email"
          label="Select or search user"
          rules={[
            { required: true, message: 'Please select a user or enter an email' },
            {
              // Custom validator — accepts directory-picked emails AND manually typed ones
              validator: (_: any, value: string) => {
                if (!value) return Promise.resolve();
                // Basic email regex — tolerates dots, plus signs, subdomains etc.
                const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return EMAIL_RE.test(value.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('Please enter a valid email address'));
              },
            },
          ]}
        >
          <Select
            showSearch
            placeholder={loadingDir ? 'Loading directory users…' : 'Search by name, email or department…'}
            filterOption={false}
            onSearch={handleSearch}
            loading={loadingDir}
            options={options}
            notFoundContent={
              loadingDir
                ? <div style={{ textAlign: 'center', padding: 8 }}><Spin size="small" /> <Text type="secondary" style={{ fontSize: 12 }}>Loading directory…</Text></div>
                : <Text type="secondary" style={{ fontSize: 12 }}>No match — type a full email to invite externally</Text>
            }
            style={{ width: '100%' }}
            optionLabelProp="value"
            dropdownStyle={{ maxHeight: 280, overflow: 'auto' }}
            // When user picks from directory dropdown — directly set form value
            onSelect={(val: string) => {
              form.setFieldValue('email', val);
              form.validateFields(['email']);
            }}
            // Allow free-type manual email as fallback (on blur of search box)
            onChange={(val: string) => {
              if (val) form.setFieldValue('email', val);
            }}
          />
        </Form.Item>

        {/* Role picker */}
        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select optionLabelProp="label">
            <Select.Option value="admin" label="Admin">
              <div>
                <div style={{ fontWeight: 500 }}>Admin</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Full access including settings and reports</div>
              </div>
            </Select.Option>
            <Select.Option value="member" label="Member">
              <div>
                <div style={{ fontWeight: 500 }}>Member</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Can view and work on tasks, no admin controls</div>
              </div>
            </Select.Option>
          </Select>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>Send Invitation</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default InviteProjectMember;
