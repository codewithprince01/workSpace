import { SearchOutlined, SyncOutlined } from '@/shared/antd-imports';
import { PageHeader } from '@ant-design/pro-components';
import { Button, Flex, Input, Tooltip } from '@/shared/antd-imports';

import React, { useEffect, useState } from 'react';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  adminCenterApiService,
  IOrganizationTeamRequestParams,
} from '@/api/admin-center/admin-center.api.service';

import { IOrganizationTeam } from '@/types/admin-center/admin-center.types';
import './teams.css';
import TeamsTable from '@/components/admin-center/teams/teams-table/teams-table';

import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import logger from '@/utils/errorLogger';
import { RootState } from '@/app/store';
import { useTranslation } from 'react-i18next';
import AddTeamDrawer from '@/components/admin-center/teams/add-team-drawer/add-team-drawer';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_admin_center_teams_visit } from '@/shared/worklenz-analytics-events';
import { themeWiseColor } from '@/utils/themeWiseColor';

export interface IRequestParams extends IOrganizationTeamRequestParams {
  total: number;
}

const Teams: React.FC = () => {
  const themeMode = useAppSelector((state: RootState) => state.themeReducer.mode);
  const { t } = useTranslation('admin-center/teams');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [showAddTeamDrawer, setShowAddTeamDrawer] = useState(false);

  const [teams, setTeams] = useState<IOrganizationTeam[]>([]);
  const [currentTeam, setCurrentTeam] = useState<IOrganizationTeam | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [requestParams, setRequestParams] = useState<IRequestParams>({
    total: 0,
    index: 1,
    size: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'desc',
    search: '',
  });

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const res = await adminCenterApiService.getOrganizationTeams(requestParams);
      if (res.done) {
        setRequestParams(prev => ({ ...prev, total: res.body.total ?? 0 }));
        const mergedTeams = [...(res.body.data ?? [])];
        if (res.body.current_team_data) {
          mergedTeams.unshift(res.body.current_team_data);
        }
        setTeams(mergedTeams);
        setCurrentTeam(res.body.current_team_data ?? null);
      }
    } catch (error) {
      logger.error('Error fetching teams', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_admin_center_teams_visit);
    fetchTeams();
  }, [trackMixpanelEvent]);

  useEffect(() => {
    fetchTeams();
  }, [requestParams.search]);

  const cardStyle: React.CSSProperties = {
    borderRadius: '8px',
    backgroundColor: themeWiseColor('#ffffff', '#1e1e1e', themeMode),
    border: `1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)}`,
    width: '100%',
    padding: '0',
    boxShadow: themeWiseColor('0 2px 8px rgba(0,0,0,0.05)', 'none', themeMode)
  };

  const countLabelStyle = {
    fontSize: '20px',
    color: themeWiseColor('#262626', '#ffffff', themeMode),
    fontWeight: 500
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '24px 0', backgroundColor: themeWiseColor('#ffffff', '#121417', themeMode) }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: '24px' }}>
        <div style={countLabelStyle}>
            {requestParams.total} {t('subtitle')}
        </div>
        
        <Flex gap={12} align="center">
          <Input
            placeholder={t('placeholder')}
            prefix={<SearchOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
            style={{ 
              width: 300, 
              backgroundColor: themeWiseColor('#ffffff', 'rgba(255,255,255,0.05)', themeMode), 
              borderColor: themeWiseColor('#d9d9d9', '#303030', themeMode),
              color: themeWiseColor('#262626', '#ffffff', themeMode),
              borderRadius: '8px',
              height: '38px'
            }}
            value={requestParams.search ?? ''}
            onChange={e => setRequestParams(prev => ({ ...prev, search: e.target.value }))}
          />
          <Tooltip title={t('refresh')}>
            <Button
              shape="circle"
              icon={<SyncOutlined spin={isLoading} style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
              onClick={() => fetchTeams()}
              style={{ 
                backgroundColor: themeWiseColor('transparent', 'rgba(255,255,255,0.05)', themeMode), 
                border: `1px solid ${themeWiseColor('#d9d9d9', '#303030', themeMode)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
          <Button 
            type="primary" 
            onClick={() => setShowAddTeamDrawer(true)}
            style={{ 
                height: '38px', 
                borderRadius: '8px',
                fontWeight: 500
            }}
          >
            {t('addTeam')}
          </Button>
        </Flex>
      </Flex>

      <div style={cardStyle}>
        <TeamsTable
            teams={teams}
            currentTeam={currentTeam}
            t={t}
            loading={isLoading}
            reloadTeams={fetchTeams}
        />
      </div>

      <AddTeamDrawer
        isDrawerOpen={showAddTeamDrawer}
        onClose={() => setShowAddTeamDrawer(false)}
        reloadTeams={fetchTeams}
      />
    </div>
  );
};

export default Teams;
