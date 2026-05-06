import { AutoComplete, Button, Flex, Form, Modal, Select, Spin, Typography } from '@/shared/antd-imports';
import { notification } from 'antd';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleInviteMemberDrawer,
  triggerTeamMembersRefresh,
} from '../../../features/settings/member/memberSlice';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { IJobTitle } from '@/types/job.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import axios from 'axios';
import Avatar from '@/components/Avatar';
import { userDirectoryApiService, IUserSearchResult } from '@/api/super-admin/user-directory.api.service';
import { theme } from 'antd';

interface FormValues {
  emails: string[];
  jobTitle: string;
  access: 'member' | 'admin';
}

const InviteTeamMembers = () => {
  const { token } = theme.useToken();
  const [searching, setSearching] = useState(false);
  const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Directory — pre-loaded on drawer open
  const [allDirUsers, setAllDirUsers]   = useState<IUserSearchResult[]>([]);
  const [filteredDir, setFilteredDir]   = useState<IUserSearchResult[]>([]);
  const [loadingDir, setLoadingDir]     = useState(false);

  const [form] = Form.useForm<FormValues>();
  const { t } = useTranslation('settings/team-members');
  const isDrawerOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const dispatch = useAppDispatch();

  // ── Load job titles ────────────────────────────────────────────────────
  const handleSearch = useCallback(async (value: string) => {
    try {
      setSearching(true);
      const res = await jobTitlesApiService.getJobTitles(1, 10, null, null, value || null);
      if (res.done) setJobTitles(res.body.data || []);
    } catch { /* silent */ }
    finally { setSearching(false); }
  }, []);

  // ── Pre-load directory users ──────────────────────────────────────────
  const loadDirectory = useCallback(async () => {
    setLoadingDir(true);
    try {
      const res = await userDirectoryApiService.list(1, 200, '');
      if (res.data?.done) {
        const users: IUserSearchResult[] = (res.data.body || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          department: u.department || '',
          avatar_url: u.avatar_url || null,
        }));
        setAllDirUsers(users);
        setFilteredDir(users);
      }
    } catch { /* silent */ }
    finally { setLoadingDir(false); }
  }, []);

  // ── Local filter (instant) ────────────────────────────────────────────
  const handleDirSearch = useCallback((q: string) => {
    if (!q.trim()) { setFilteredDir(allDirUsers); return; }
    const lq = q.toLowerCase();
    setFilteredDir(allDirUsers.filter(u =>
      u.name.toLowerCase().includes(lq) ||
      u.email.toLowerCase().includes(lq) ||
      (u.department || '').toLowerCase().includes(lq)
    ));
  }, [allDirUsers]);

  useEffect(() => {
    if (isDrawerOpen) {
      handleSearch('');
      loadDirectory();
    }
  }, [isDrawerOpen, handleSearch, loadDirectory]);

  const handleFormSubmit = async (values: FormValues) => {
    // Validate emails from state (not form field — form/Select onChange sync issue)
    if (!emails || emails.length === 0) {
      notification.error({ message: 'Please select at least one user to invite' });
      return;
    }
    try {
      setLoading(true);
      const body: ITeamMemberCreateRequest = {
        job_title: selectedJobTitle,
        emails: emails,
        is_admin: values.access === 'admin',
      };
      const res = await teamMembersApiService.createTeamMember(body);
      if (res.done) {
        const duplicateError = (res.body as any)?.errors?.find?.((err: any) => err?.code === 'TEAM_MEMBER_EXISTS');
        if (duplicateError?.error) {
          notification.warning({ message: 'One or more users are already team members.' });
          return;
        }
        notification.success({ message: `Invited as ${values.access === 'admin' ? 'Admin' : 'Member'} successfully!` });
        form.resetFields();
        setEmails([]);
        setSelectedJobTitle(null);
        dispatch(triggerTeamMembersRefresh());
        dispatch(toggleInviteMemberDrawer());
      }
    } catch (error: any) {
      const errorMsg =
        (axios.isAxiosError(error) ? (error.response?.data as any)?.message : null) ||
        error?.message || t('createMemberErrorMessage');
      notification.error({ message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { form.resetFields(); dispatch(toggleInviteMemberDrawer()); };
  const handleEmailChange = (value: string[]) => setEmails(value);

  // ── Directory dropdown options ────────────────────────────────────────
  const dirOptions = filteredDir.map(u => ({
    value: u.email,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar
          size={24}
          src={u.avatar_url}
          name={u.name || ''}
          style={{ flexShrink: 0 }}
        />
        <div style={{ lineHeight: 1.3, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.name}
          </div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {u.email}
            {u.department && (
              <span style={{ marginLeft: 4, color: '#8b5cf6', fontWeight: 500 }}>· {u.department}</span>
            )}
          </div>
        </div>
      </div>
    ),
  }));

  return (
    <Modal
      title={
        <div>
          <Typography.Text strong style={{ fontSize: 15 }}>{t('addMemberDrawerTitle')}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {loadingDir
                ? 'Loading directory…'
                : `${allDirUsers.length} user${allDirUsers.length !== 1 ? 's' : ''} in directory`}
            </Typography.Text>
          </div>
        </div>
      }
      open={isDrawerOpen}
      onCancel={handleClose}
      destroyOnHidden
      afterOpenChange={visible => visible && handleSearch('')}
      width={420}
      loading={loading}
      footer={
        <Flex justify="end">
          <Button onClick={form.submit} type="primary" style={{ fontSize: 12 }}>
            {t('addToTeamButton')}
          </Button>
        </Flex>
      }
    >
      <Form form={form} onFinish={handleFormSubmit} layout="vertical" initialValues={{ access: 'member' }}>

        {/* Email multi-select with directory pre-load */}
        {/* No Form.Item validator here — emails are validated in handleFormSubmit via state */}
        <Form.Item
          name="emails"
          label={t('memberEmailLabel')}
        >
          <Flex vertical gap={4}>
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder={loadingDir ? 'Loading directory users…' : t('memberEmailPlaceholder')}
              value={emails}
              onChange={(value: string[]) => {
                setEmails(value);
                // Also sync form field so it stays clean
                form.setFieldValue('emails', value);
              }}
              onSearch={handleDirSearch}
              loading={loadingDir}
              options={dirOptions}
              notFoundContent={
                loadingDir
                  ? <div style={{ textAlign: 'center', padding: 8 }}><Spin size="small" /></div>
                  : <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      No match — type an email to add manually
                    </Typography.Text>
              }
              tokenSeparators={[',', ';']}
              dropdownStyle={{ maxHeight: 280, overflow: 'auto' }}
              maxTagCount="responsive"
              showSearch
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('addMemberEmailHint')}
            </Typography.Text>
          </Flex>
        </Form.Item>

        {/* Job title */}
        <Form.Item label={t('jobTitleLabel')} name="jobTitle">
          <AutoComplete
            options={jobTitles.map(job => ({ id: job.id, label: job.name, value: job.name }))}
            allowClear
            onSearch={handleSearch}
            placeholder={t('jobTitlePlaceholder')}
            onChange={(value, option) => form.setFieldsValue({ jobTitle: (option as any)?.label || value })}
            onSelect={value => setSelectedJobTitle(value)}
            dropdownRender={menu => <div>{searching && <Spin size="small" />}{menu}</div>}
          />
        </Form.Item>

        {/* Access level */}
        <Form.Item label={t('memberAccessLabel')} name="access">
          <Select
            options={[
              { value: 'member', label: t('memberText') },
              { value: 'admin', label: t('adminText') },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default InviteTeamMembers;
