import { Button, Flex, Tooltip } from '@/shared/antd-imports';
import { useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectStatusFilterDropdown from './project-status-filter-dropdown';
import ProjectHealthFilterDropdown from './project-health-filter-dropdown';
import ProjectCategoriesFilterDropdown from './project-categories-filter-dropdown';
import ProjectManagersFilterDropdown from './project-managers-filter-dropdown';
import ProjectTeamsFilterDropdown from './project-teams-filter-dropdown';
import ProjectTableShowFieldsDropdown from './project-table-show-fields-dropdown';
import CustomSearchbar from '@/components/CustomSearchbar';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSearchQuery, setViewMode, fetchProjectReportingFilters, fetchProjectData, resetProjectReports } from '@/features/reporting/projectReports/project-reports-slice';
import { AppstoreOutlined, UnorderedListOutlined, ReloadOutlined } from '@/shared/antd-imports';
import { useEffect } from 'react';

const ProjectsReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-projects-filters');
  const { searchQuery, viewMode } = useAppSelector(state => state.projectReportsReducer);

  useEffect(() => {
    dispatch(fetchProjectReportingFilters());
  }, [dispatch]);

  const handleSearchQueryChange = useCallback(
    (text: string) => {
      dispatch(setSearchQuery(text));
    },
    [dispatch]
  );

  const handleSetTable = useCallback(() => dispatch(setViewMode('table')), [dispatch]);
  const handleSetGrouped = useCallback(() => dispatch(setViewMode('grouped')), [dispatch]);

  const filterDropdowns = useMemo(
    () => (
      <Flex gap={8} wrap={'wrap'} align="center">
        <ProjectTeamsFilterDropdown />
        <ProjectStatusFilterDropdown />
        <ProjectHealthFilterDropdown />
        <ProjectCategoriesFilterDropdown />
        <ProjectManagersFilterDropdown />
      </Flex>
    ),
    [dispatch]
  );

  const rightControls = useMemo(
    () => (
      <Flex gap={8} align="center">
        {/* Table / Grouped toggle - styled like the screenshot */}
        <Flex
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <Tooltip title="Table view">
            <Button
              type={viewMode === 'table' ? 'primary' : 'text'}
              icon={<UnorderedListOutlined />}
              onClick={handleSetTable}
              style={{
                borderRadius: 0,
                border: 'none',
                boxShadow: 'none',
                paddingInline: 12,
              }}
            >
              Table
            </Button>
          </Tooltip>
          <Tooltip title="Grouped view">
            <Button
              type={viewMode === 'grouped' ? 'primary' : 'text'}
              icon={<AppstoreOutlined />}
              onClick={handleSetGrouped}
              style={{
                borderRadius: 0,
                border: 'none',
                borderLeft: '1px solid #d9d9d9',
                boxShadow: 'none',
                paddingInline: 12,
              }}
            >
              Grouped
            </Button>
          </Tooltip>
        </Flex>

        <ProjectTableShowFieldsDropdown />
        <CustomSearchbar
          placeholderText={t('searchByNamePlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={handleSearchQueryChange}
        />
      </Flex>
    ),
    [t, searchQuery, handleSearchQueryChange, viewMode, handleSetTable, handleSetGrouped]
  );

  return (
    <Flex gap={8} align="center" justify="space-between" wrap="wrap">
      {filterDropdowns}
      {rightControls}
    </Flex>
  );
};

export default memo(ProjectsReportsFilters);
