import {
  Modal,
  Flex,
  Form,
  Select,
  Typography,
  Button,
  message,
  QuestionCircleOutlined,
  ShareAltOutlined,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addProjectMember,
  getAllProjectMembers,
  toggleProjectMemberDrawer,
} from '@/features/projects/singleProject/members/projectMembersSlice';
import logger from '@/utils/errorLogger';
import { validateEmail } from '@/utils/validateEmail';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { projectsApiService } from '@/api/projects/projects.api.service';

const ProjectMemberDrawer = () => {
  const { t } = useTranslation('project-view/project-member-drawer');
  const { isDrawerOpen, currentMembersList, isFromAssigner } = useAppSelector(
    state => state.projectMemberReducer
  );
  const { projectId, project } = useAppSelector(state => state.projectReducer);

  const dispatch = useAppDispatch();
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [members, setMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [targets, setTargets] = useState<string[]>([]);

  const currentProjectMemberIds = useMemo(
    () => (currentMembersList || []).map(m => m.team_member_id).filter(Boolean),
    [currentMembersList]
  );

  const availableMembers = useMemo(
    () =>
      (members?.data || []).filter(
        member => member.id && !currentProjectMemberIds.includes(member.id)
      ),
    [members, currentProjectMemberIds]
  );

  const availableMembersById = useMemo(() => {
    const map = new Map<string, any>();
    availableMembers.forEach(member => {
      if (member.id) {
        map.set(member.id, member);
      }
    });
    return map;
  }, [availableMembers]);

  const fetchProjectMembers = async () => {
    if (!projectId) return;
    dispatch(getAllProjectMembers(projectId));
  };

  const fetchTeamMembers = async (query = '') => {
    try {
      setTeamMembersLoading(true);
      const response = await teamMembersApiService.get(1, 50, null, null, query || null, true);
      if (response.done) {
        setMembers(response.body);
      }
    } catch (error) {
      logger.error('Error fetching team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      void fetchTeamMembers(searchTerm.trim());
    }, 180);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const resetFormState = () => {
    form.resetFields();
    setSearchTerm('');
    setRole('member');
    setTargets([]);
  };

  const handleInvite = async () => {
    if (!projectId) return;
    if (!targets.length) {
      message.error(t('enterValidMemberOrEmail'));
      return;
    }

    try {
      setIsInviting(true);

      const memberIds = targets.filter(value => availableMembersById.has(value));
      const emails = targets
        .map(value => value.trim().toLowerCase())
        .filter(value => !availableMembersById.has(value) && validateEmail(value));

      if (!memberIds.length && !emails.length) {
        message.error(t('enterValidMemberOrEmail'));
        return;
      }

      await Promise.all(
        memberIds.map(memberId => dispatch(addProjectMember({ memberId, projectId })).unwrap())
      );

      await Promise.all(
        emails.map(email => projectsApiService.inviteMember(projectId, email, role))
      );

      message.success(t('inviteSuccess'));
      await fetchProjectMembers();
      resetFormState();
    } catch (error: any) {
      const errorMsg =
        (axios.isAxiosError(error) ? (error.response?.data as any)?.message : null) ||
        error?.message ||
        'Failed to invite';
      message.error(errorMsg);
      logger.error('Error inviting project members:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyProjectLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      message.success(t('projectLinkCopied'));
    } catch (error) {
      message.error(t('copyProjectLinkFailed'));
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    void fetchProjectMembers();
    void fetchTeamMembers('');
  };

  const projectName = project?.name || '';

  return (
    <Modal
      title={
        <Typography.Text style={{ fontWeight: 700, fontSize: 17, color: '#ffffff' }}>
          {`Share "${projectName}"`}
        </Typography.Text>
      }
      open={isDrawerOpen}
      onCancel={() => {
        dispatch(toggleProjectMemberDrawer());
        resetFormState();
      }}
      afterOpenChange={handleOpenChange}
      footer={null}
      width={620}
      styles={{
        content: { background: '#1f1f1f', border: '1px solid #2d2d2d', borderRadius: 12 },
        header: { background: '#1f1f1f', borderBottom: 'none', paddingBottom: 0 },
        body: { paddingTop: 12 },
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={<Typography.Text style={{ color: '#e5e7eb', fontSize: 14 }}>Invite with email</Typography.Text>}
          style={{ marginBottom: 18 }}
        >
          <Flex gap={12} align="center">
            <Select
              mode="tags"
              showSearch
              allowClear
              loading={teamMembersLoading}
              value={targets}
              placeholder={t('searchPlaceholder')}
              style={{ flex: 1 }}
              tokenSeparators={[',', ';']}
              onSearch={value => setSearchTerm(value)}
              onChange={values => setTargets(Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean))))}
              onDropdownVisibleChange={open => {
                if (open && !members?.data?.length) {
                  void fetchTeamMembers('');
                }
              }}
              filterOption={false}
              options={availableMembers.map(member => ({
                key: member.id,
                value: member.id,
                label: `${member.name} (${member.email})`,
              }))}
            />
            <Button type="primary" onClick={handleInvite} loading={isInviting}>
              {t('invite')}
            </Button>
          </Flex>
        </Form.Item>

        <Form.Item
          label={
            <Flex align="center" gap={6}>
              <Typography.Text style={{ color: '#e5e7eb', fontSize: 14 }}>Team role</Typography.Text>
              <QuestionCircleOutlined style={{ color: '#9ca3af', fontSize: 14 }} />
            </Flex>
          }
          style={{ marginBottom: 16 }}
        >
          <Select
            value={role}
            onChange={value => setRole(value)}
            options={[
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </Form.Item>

        {!isFromAssigner && (
          <Flex justify="flex-end">
            <Button icon={<ShareAltOutlined />} onClick={handleCopyProjectLink}>
              {t('copyProjectLink')}
            </Button>
          </Flex>
        )}
      </Form>
    </Modal>
  );
};

export default ProjectMemberDrawer;
