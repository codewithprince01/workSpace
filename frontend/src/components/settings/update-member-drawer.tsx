import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Drawer,
  Flex,
  Form,
  message,
  Select,
  Spin,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import Avatar from '@/components/Avatar';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { colors } from '@/styles/colors';
import { jobTitlesApiService } from '@/api/settings/job-titles/job-titles.api.service';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { toggleUpdateMemberDrawer } from '../../features/settings/member/memberSlice';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeDifference } from '@/utils/calculate-time-difference';
import { IJobTitle } from '@/types/job.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMemberCreateRequest } from '@/types/teamMembers/team-member-create-request';
import logger from '@/utils/errorLogger';
import { authApiService } from '@/api/auth/auth.api.service';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';

type UpdateMemberDrawerProps = {
  selectedMemberId: string | null;
  onMemberUpdate?: (memberId: string, updatedData: Partial<ITeamMemberViewModel>) => void;
};

const UpdateMemberDrawer = ({ selectedMemberId, onMemberUpdate }: UpdateMemberDrawerProps) => {
  const { t } = useTranslation('settings/team-members');
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resentSuccess, setResentSuccess] = useState(false);
  const [jobTitles, setJobTitles] = useState<IJobTitle[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [teamMember, setTeamMember] = useState<ITeamMemberViewModel | null>({});

  const isDrawerOpen = useAppSelector(state => state.memberReducer.isUpdateMemberDrawerOpen);

  const isOwnAccount = useMemo(() => {
    return auth.getCurrentSession()?.email === teamMember?.email;
  }, [auth, teamMember?.email]);

  const isResendAvailable = useMemo(() => {
    return teamMember?.pending_invitation && selectedMemberId && !resentSuccess;
  }, [teamMember?.pending_invitation, selectedMemberId, resentSuccess]);

  const getJobTitles = async () => {
    try {
      setLoading(true);
      const res = await jobTitlesApiService.getJobTitles(1, 10, null, null, null);
      if (res.done) {
        setJobTitles(res.body.data || []);
      }
    } catch (error) {
      logger.error('Error fetching job titles:', error);
      message.error(t('jobTitlesFetchError'));
    } finally {
      setLoading(false);
    }
  };

  const getTeamMember = async () => {
    if (!selectedMemberId) return;

    try {
      const res = await teamMembersApiService.getById(selectedMemberId);
      if (res.done) {
        setTeamMember(res.body);
        form.setFieldsValue({
          jobTitle: jobTitles.find(job => job.id === res.body?.job_title || job.name === res.body?.job_title)?.id || res.body?.job_title,
          access: (res.body.role === 'admin' || res.body.is_admin || res.body.role === 'owner') ? 'admin' : 'member',
        });
      }
    } catch (error) {
      logger.error('Error fetching team member:', error);
    }
  };

  const handleFormSubmit = async (values: any) => {
    if (!selectedMemberId || !teamMember?.email) return;

    try {
      const jobTitleValue = form.getFieldValue('jobTitle');
      const resolvedJobTitle = jobTitles.find(j => j.id === jobTitleValue)?.name || jobTitleValue;

      const body: ITeamMemberCreateRequest = {
        job_title: resolvedJobTitle,
        emails: [teamMember.email],
        is_admin: values.access === 'admin',
        manager_id: values.managerId || null,
      };

      const res = await teamMembersApiService.update(selectedMemberId!, body);
      if (res.done) {
        message.success(t('updateMemberSuccessMessage'));
        onMemberUpdate?.(selectedMemberId!, { 
          role_name: body.is_admin ? 'admin' : 'member',
          job_title: body.job_title 
        });
        form.resetFields();
        setSelectedJobTitle(null);
        dispatch(toggleUpdateMemberDrawer());

        const authorizeResponse = await authApiService.verify();
        if (authorizeResponse.authenticated) {
          setSession(authorizeResponse.user);
          dispatch(setUser(authorizeResponse.user));
        }
      }
    } catch (error) {
      logger.error('Error updating member:', error);
    }
  };

  const resendInvitation = async () => {
    if (!selectedMemberId) return;

    try {
      setResending(true);
      const res = await teamMembersApiService.resendInvitation(selectedMemberId);
      if (res.done) {
        setResentSuccess(true);
        message.success(t('invitationResent'));
      }
    } catch (error) {
      logger.error('Error resending invitation:', error);
    } finally {
      setResending(false);
    }
  };

  const [potentialManagers, setPotentialManagers] = useState<ITeamMemberViewModel[]>([]);

  const afterOpenChange = async (visible: boolean) => {
    if (visible) {
      setLoading(true);
      try {
        // Fetch data in parallel
        const [titlesRes, membersRes, memberRes] = await Promise.all([
          jobTitlesApiService.getJobTitles(1, 50, null, null, null),
          teamMembersApiService.get(1, 100, 'name', 'asc', ''), // Fetch all members for manager selection
          teamMembersApiService.getById(selectedMemberId!)
        ]);

        let currentTitles = [];
        if (titlesRes.done) {
          currentTitles = titlesRes.body.data || [];
          setJobTitles(currentTitles);
        }

        if (membersRes.done) {
          // Filter out the current user being edited from the potential managers list
          setPotentialManagers((membersRes.body.data || []).filter((m: any) => m.id !== selectedMemberId));
        }

        if (memberRes.done) {
          const resMember = memberRes.body;
          setTeamMember(resMember);
          
          const matchingTitle = currentTitles.find(
            (job: IJobTitle) => job.id === resMember?.job_title || job.name === resMember?.job_title
          );

          form.setFieldsValue({
            jobTitle: matchingTitle ? matchingTitle.id : resMember?.job_title,
            access: (resMember.role === 'admin' || resMember.is_admin || resMember.role === 'owner') ? 'admin' : 'member',
            managerId: resMember.manager_id,
          });
          setSelectedJobTitle(matchingTitle ? matchingTitle.id : resMember?.job_title);
        }
      } catch (error) {
        logger.error('Error during drawer data fetch:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Drawer
      title={
        <Flex gap={8} align="center">
          <Avatar src={teamMember?.avatar_url} name={teamMember?.name || ''} size={32} />
          <Flex vertical gap={4}>
            <Typography.Text
              style={{
                fontSize: 16,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {teamMember?.name}
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 12.8,
                fontWeight: 400,
              }}
            >
              {teamMember?.email}
            </Typography.Text>
          </Flex>
        </Flex>
      }
      open={isDrawerOpen}
      onClose={() => {
        dispatch(toggleUpdateMemberDrawer());
        setTeamMember(null);
        form.resetFields();
      }}
      afterOpenChange={afterOpenChange}
      width={400}
      loading={loading}
      destroyOnHidden
    >
      <Form
        form={form}
        onFinish={handleFormSubmit}
        layout="vertical"
        initialValues={{ access: 'member' }}
      >
        <Form.Item label={t('jobTitleLabel')} name="jobTitle">
          <Select
            showSearch
            optionLabelProp="label"
            placeholder={t('jobTitlePlaceholder')}
            options={jobTitles.map(job => ({
              label: job.name,
              value: job.id,
            }))}
            onChange={(value) => {
              // If we pick from dropdown, we want to store the ID in form state for the Select value
              // but we might want to store the label for submission.
              // Let's keep ID in Select for matching, and resolve name in submit.
              setSelectedJobTitle(value);
            }}
          />
        </Form.Item>

        <Form.Item label={t('memberAccessLabel')} name="access" rules={[{ required: true }]}>
          <Select
            disabled={isOwnAccount}
            options={[
              { value: 'member', label: t('memberText') },
              { value: 'admin', label: t('adminText') },
            ]}
          />
        </Form.Item>
        
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues.access !== currentValues.access}
        >
          {({ getFieldValue }) =>
            getFieldValue('access') === 'member' && (
              <>
                <Form.Item label={'Manager (Optional)'} name="managerId">
                  <Select
                    showSearch
                    allowClear
                    placeholder={'Select a team lead as manager'}
                    optionLabelProp="label"
                  >
                    {potentialManagers.map(m => (
                      <Select.Option key={m.id} value={m.id} label={m.name}>
                        <Flex align="center" gap={8}>
                      <Avatar size={24} src={m.avatar_url} name={m.name || ''} />
                          {m.name}
                        </Flex>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )
          }
        </Form.Item>

        <Form.Item>
          <Flex vertical gap={8}>
            <Button type="primary" style={{ width: '100%' }} htmlType="submit">
              {t('updateButton')}
            </Button>
            <Button
              type="dashed"
              loading={resending}
              style={{ width: '100%' }}
              onClick={resendInvitation}
              disabled={!isResendAvailable}
            >
              {t('resendInvitationButton')}
            </Button>
            <Flex vertical style={{ marginBlockStart: 8 }}>
              <Typography.Text
                style={{
                  fontSize: 12,
                  color: colors.lightGray,
                }}
              >
                {t('addedText')}
                <Tooltip title={formatDateTimeWithLocale(teamMember?.created_at || '')}>
                   {calculateTimeDifference(teamMember?.created_at || '')}
                </Tooltip>
              </Typography.Text>
              <Typography.Text
                style={{
                  fontSize: 12,
                  color: colors.lightGray,
                }}
              >
                {t('updatedText')}
                <Tooltip title={formatDateTimeWithLocale(teamMember?.updated_at || '')}>
                   {calculateTimeDifference(teamMember?.updated_at || '')}
                </Tooltip>
              </Typography.Text>
            </Flex>
          </Flex>
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default UpdateMemberDrawer;
