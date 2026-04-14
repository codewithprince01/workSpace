import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { createSelector } from '@reduxjs/toolkit';
import {
  SearchOutlined,
  CloseOutlined,
  DownOutlined,
  TeamOutlined,
  TagOutlined,
  FlagOutlined,
  GroupOutlined,
  EyeOutlined,
  InboxOutlined,
  CheckOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import { toggleField, syncFieldWithDatabase } from '@/features/task-management/taskListFields.slice';
import {
  selectColumns,
  updateCustomColumnPinned,
} from '@/features/task-management/task-management.slice';

// Import Redux actions
import {
  fetchTasksV3,
  setSearch as setTaskManagementSearch,
  setArchived as setTaskManagementArchived,
  toggleArchived as toggleTaskManagementArchived,
  selectArchived,
  setSort,
  setSortField,
  setSortOrder,
  selectSort,
  selectSortField,
  selectSortOrder,
} from '@/features/task-management/task-management.slice';
import {
  setCurrentGrouping,
  selectCurrentGrouping,
} from '@/features/task-management/grouping.slice';

import { fetchPriorities } from '@/features/taskAttributes/taskPrioritySlice';
import {
  fetchLabelsByProject,
  fetchTaskAssignees,
  setMembers,
  setLabels,
  setSearch,
  setPriorities,
  setFields,
} from '@/features/tasks/tasks.slice';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import { IGroupBy } from '@/features/tasks/tasks.slice';
import { ITaskListSortableColumn } from '@/types/tasks/taskListFilters.types';
import { AvatarNamesMap } from '@/shared/constants';
// --- Enhanced Kanban imports ---
import {
  setGroupBy as setKanbanGroupBy,
  setSearch as setKanbanSearch,
  setArchived as setKanbanArchived,
  setTaskAssignees as setKanbanTaskAssignees,
  setLabels as setKanbanLabels,
  setPriorities as setKanbanPriorities,
  setMembers as setKanbanMembers,
  fetchEnhancedKanbanGroups,
  setSelectedPriorities as setKanbanSelectedPriorities,
  setBoardSearch as setKanbanBoardSearch,
  setTaskAssigneeSelection,
  setLabelSelection,
  fetchEnhancedKanbanLabels,
  fetchEnhancedKanbanTaskAssignees,
  resetState as resetKanbanState,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';

// Board slice imports for compatibility
import {
  setBoardSearch,
  setBoardPriorities,
  setBoardMembers,
  setBoardLabels,
} from '@/features/board/board-slice';

// Import modal components
import ManageStatusModal from '@/components/task-management/ManageStatusModal';
import ManagePhaseModal from '@/components/task-management/ManagePhaseModal';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

// Performance constants
const FILTER_DEBOUNCE_DELAY = 300; // ms
const SEARCH_DEBOUNCE_DELAY = 500; // ms
const MAX_FILTER_OPTIONS = 100;

// Sort order enum
enum SORT_ORDER {
  ASCEND = 'ascend',
  DESCEND = 'descend',
}

// Optimized selectors with proper transformation logic
const selectFilterData = createSelector(
  [
    (state: any) => state.priorityReducer.priorities,
    (state: any) => state.taskReducer.priorities,
    (state: any) => state.boardReducer.priorities,
    (state: any) => state.taskReducer.labels,
    (state: any) => state.boardReducer.labels,
    (state: any) => state.taskReducer.taskAssignees,
    (state: any) => state.boardReducer.taskAssignees,
    (state: any) => state.projectReducer.project,
    // Enhanced kanban data
    (state: any) => state.enhancedKanbanReducer.originalTaskAssignees,
    (state: any) => state.enhancedKanbanReducer.originalLabels,
    (state: any) => state.enhancedKanbanReducer.priorities,
  ],
  (
    priorities,
    taskPriorities,
    boardPriorities,
    taskLabels,
    boardLabels,
    taskAssignees,
    boardAssignees,
    project,
    kanbanOriginalTaskAssignees,
    kanbanOriginalLabels,
    kanbanPriorities
  ) => ({
    priorities: priorities || [],
    taskPriorities: taskPriorities || [],
    boardPriorities: boardPriorities || [],
    taskLabels: taskLabels || [],
    boardLabels: boardLabels || [],
    taskAssignees: taskAssignees || [],
    boardAssignees: boardAssignees || [],
    project,
    selectedPriorities: taskPriorities || [],
    kanbanTaskAssignees: kanbanOriginalTaskAssignees || [],
    kanbanLabels: kanbanOriginalLabels || [],
    kanbanPriorities: kanbanPriorities || [],
  })
);

// Types
interface FilterOption {
  id: string;
  label: string;
  value: string;
  color?: string;
  avatar?: string;
  count?: number;
  selected?: boolean;
}

interface FilterSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FilterOption[];
  selectedValues: string[];
  multiSelect: boolean;
  searchable?: boolean;
}

interface ImprovedTaskFiltersProps {
  position: 'board' | 'list';
  className?: string;
}

// Enhanced debounce with cancellation support
function createDebouncedFunction<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFunc = ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debouncedFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFunc;
}

const useFilterData = (position: 'board' | 'list'): FilterSection[] => {
  const { t } = useTranslation('task-list-filters');
  const [searchParams] = useSearchParams();
  const { projectView } = useTabSearchParam();

  const filterData = useAppSelector(selectFilterData);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);
  const kanbanProject = useAppSelector((state: RootState) => state.projectReducer.project);
  
  const isBoard = position === 'board';
  const tab = searchParams.get('tab');
  const currentProjectView = tab === 'tasks-list' ? 'list' : 'kanban';

  return useMemo(() => {
    const getSafeId = (obj: any) =>
      String(obj?.id || obj?._id || obj?.team_member_id || obj?.name || '');

    if (isBoard) {
      const currentPriorities = kanbanState.priorities || [];
      const currentLabels = kanbanState.labels || [];
      const currentAssignees = kanbanState.taskAssignees || [];
      const groupByValue = kanbanState.groupBy || 'status';

      return [
        {
          id: 'priority',
          label: t('priorityText'),
          options: filterData.priorities.map((p: any) => ({
            value: p.id,
            label: p.name,
            color: p.color_code,
          })),
          selectedValues: currentPriorities,
          multiSelect: true,
          searchable: false,
          icon: FlagOutlined,
        },
        {
          id: 'assignees',
          label: t('membersText'),
          icon: TeamOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentAssignees
            .filter((m: any) => m.selected && getSafeId(m))
            .map((m: any) => getSafeId(m)),
          options: filterData.taskAssignees.map((assignee: any) => ({
            id: getSafeId(assignee),
            label: assignee.name || '',
            value: getSafeId(assignee),
            avatar: assignee.avatar_url,
            selected: assignee.selected,
          })),
        },
        {
          id: 'labels',
          label: t('labelsText'),
          icon: TagOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentLabels
            .filter((l: any) => l.selected && getSafeId(l))
            .map((l: any) => getSafeId(l)),
          options: filterData.taskLabels.map((label: any) => ({
            id: getSafeId(label),
            label: label.name || '',
            value: getSafeId(label),
            color: label.color_code,
            selected: label.selected,
          })),
        },
        {
          id: 'groupBy',
          label: t('groupByText'),
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText'), value: 'status' },
            { id: 'priority', label: t('priorityText'), value: 'priority' },
            {
              id: 'phase',
              label: (kanbanProject as any)?.phase_label || t('phaseText'),
              value: 'phase',
            },
          ],
        },
      ];
    } else {
      const currentPriorities =
        currentProjectView === 'list' ? filterData.taskPriorities : filterData.boardPriorities;
      const currentLabels =
        currentProjectView === 'list' ? filterData.taskLabels : filterData.boardLabels;
      const currentAssignees =
        currentProjectView === 'list' ? filterData.taskAssignees : filterData.boardAssignees;
      const groupByValue = currentGrouping || 'status';
      return [
        {
          id: 'priority',
          label: t('priorityText'),
          options: filterData.priorities.map((p: any) => ({
            value: p.id,
            label: p.name,
            color: p.color_code,
          })),
          selectedValues: filterData.selectedPriorities,
          multiSelect: true,
          searchable: false,
          icon: FlagOutlined,
        },
        {
          id: 'assignees',
          label: t('membersText'),
          icon: TeamOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentAssignees
            .filter((m: any) => m.selected && getSafeId(m))
            .map((m: any) => getSafeId(m)),
          options: currentAssignees.map((assignee: any) => ({
            id: getSafeId(assignee),
            label: assignee.name || '',
            value: getSafeId(assignee),
            avatar: assignee.avatar_url,
            selected: assignee.selected,
          })),
        },
        {
          id: 'labels',
          label: t('labelsText'),
          icon: TagOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentLabels
            .filter((l: any) => l.selected && getSafeId(l))
            .map((l: any) => getSafeId(l)),
          options: currentLabels.map((label: any) => ({
            id: getSafeId(label),
            label: label.name || '',
            value: getSafeId(label),
            color: label.color_code,
            selected: label.selected,
          })),
        },
        {
          id: 'groupBy',
          label: t('groupByText'),
          icon: GroupOutlined,
          multiSelect: false,
          searchable: false,
          selectedValues: [groupByValue],
          options: [
            { id: 'status', label: t('statusText'), value: 'status' },
            { id: 'priority', label: t('priorityText'), value: 'priority' },
            {
              id: 'phase',
              label: filterData.project?.phase_label || t('phaseText'),
              value: 'phase',
            },
          ],
        },
      ];
    }
  }, [isBoard, kanbanState, kanbanProject, filterData, currentProjectView, t, currentGrouping]);
};

// Filter Dropdown Component
const FilterDropdown: React.FC<{
  section: FilterSection;
  onSelectionChange: (sectionId: string, values: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  themeClasses: any;
  isDarkMode: boolean;
  className?: string;
  dispatch?: any;
  onManageStatus?: () => void;
  onManagePhase?: () => void;
  projectPhaseLabel?: string;
}> = ({
  section,
  onSelectionChange,
  isOpen,
  onToggle,
  themeClasses,
  isDarkMode,
  className = '',
  dispatch,
  onManageStatus,
  onManagePhase,
  projectPhaseLabel,
}) => {
  const { t } = useTranslation('task-list-filters');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(section.options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptionsMemo = useMemo(() => {
    const baseOptions = !section.searchable || !searchTerm.trim()
      ? section.options
      : section.options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );

    if (section.id === 'labels') {
      return [...baseOptions].sort((a, b) => {
        const aSelected = section.selectedValues.includes(a.value) ? 1 : 0;
        const bSelected = section.selectedValues.includes(b.value) ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
    }

    return baseOptions;
  }, [searchTerm, section.options, section.searchable, section.id, section.selectedValues]);

  useEffect(() => {
    setFilteredOptions(filteredOptionsMemo);
  }, [filteredOptionsMemo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleOptionToggle = useCallback(
    (optionValue: string) => {
      if (section.multiSelect) {
        const newValues = section.selectedValues.includes(optionValue)
          ? section.selectedValues.filter(v => v !== optionValue)
          : [...section.selectedValues, optionValue];
        onSelectionChange(section.id, newValues);
      } else {
        onSelectionChange(section.id, [optionValue]);
        onToggle();
      }
    },
    [section, onSelectionChange, onToggle]
  );

  const selectedCount = section.selectedValues.length;
  const IconComponent = section.icon;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-300 ease-in-out
          ${
            selectedCount > 0
              ? isDarkMode
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30'
                : 'bg-blue-50 text-blue-700 border-blue-200'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500/50
        `}
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span>{section.label}</span>
        {selectedCount > 0 && (
          <span className={`
            text-[11px] font-semibold border-l px-1.5 ml-0.5 truncate max-w-[100px]
            ${isDarkMode ? 'text-blue-300 border-blue-500/30' : 'text-blue-700 border-blue-200'}
          `}>
            {selectedCount <= 2
              ? section.options
                  .filter(opt => section.selectedValues.includes(opt.value))
                  .map(opt => opt.label)
                  .join(', ')
              : `${selectedCount} ${t('filtersActive')}`}
          </span>
        )}
        <DownOutlined
          className={`text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
        />
      </button>

      {section.id === 'groupBy' && canConfigure && (
        <div className="inline-flex items-center gap-1 ml-2">
          {section.selectedValues[0] === 'phase' && (
            <button
              onClick={() => {
                onToggle();
                onManagePhase?.();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ease-in-out hover:shadow-sm ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`}
            >
              {t('manage')} {projectPhaseLabel || t('phasesText')}
            </button>
          )}
          {section.selectedValues[0] === 'status' && (
            <button
              onClick={() => {
                onToggle();
                onManageStatus?.();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ease-in-out hover:shadow-sm ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`}
            >
              {t('manageStatuses')}
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative w-full">
                <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={`${t('searchPlaceholder')} ${section.label.toLowerCase()}...`}
                  className={`w-full pl-8 pr-2 py-1 rounded border focus:outline-none transition-colors duration-150 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound')}
              </div>
            ) : (
              <div className="p-0.5">
                {filteredOptions.map(option => {
                  const isSelected = section.selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionToggle(option.value)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors duration-150 text-left
                        ${
                          isSelected
                            ? isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800 font-semibold'
                            : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {section.id !== 'groupBy' && (
                        <div className={`flex items-center justify-center w-3.5 h-3.5 border rounded ${isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                          {isSelected && <CheckOutlined className="text-[8px] font-bold" />}
                        </div>
                      )}
                      {option.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />}
                      {(option.avatar || section.id === 'assignees') ? (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: option.avatar ? 'transparent' : AvatarNamesMap[(option.label?.[0] || 'U').toUpperCase()] || '#1890ff' }}>
                          {option.avatar ? <img src={option.avatar} alt={option.label} className="w-5 h-5 rounded-full object-cover" /> : <span>{(option.label?.[0] || 'U').toUpperCase()}</span>}
                        </div>
                      ) : null}
                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{option.label}</span>
                        {option.count !== undefined && <span className="text-xs text-gray-500 dark:text-gray-400">{option.count}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Search Component
const SearchFilter: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  themeClasses: any;
  className?: string;
}> = ({ value, onChange, placeholder, themeClasses, className = '' }) => {
  const { t } = useTranslation('task-list-filters');
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
    if (value) setIsExpanded(true);
  }, [value]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onChange(localValue);
  }, [localValue, onChange]);

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    setIsExpanded(false);
  }, [value]);

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  return (
    <div className={`relative ${className}`}>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md
            border transition-all duration-200 ease-in-out
            ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}
          `}
        >
          <SearchOutlined className="text-xs" />
          <span className="truncate max-w-[120px]">{value || t('searchPlaceholder')}</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="relative w-full">
            <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              placeholder={placeholder || t('searchTasks') || 'Search...'}
              className={`w-full pr-4 pl-8 py-1 rounded border focus:outline-none transition-colors duration-150 ${isDarkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white">
            {t('search')}
          </button>
          <button type="button" onClick={handleCancel} className={`px-3 py-1.5 text-xs font-medium rounded-md ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
            {t('cancel')}
          </button>
        </form>
      )}
    </div>
  );
};

// Sort Dropdown
const SortDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSortField = useAppSelector(selectSortField);
  const currentSortOrder = useAppSelector(selectSortOrder);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const sortFieldsList = [
    { label: t('taskText'), key: 'name' },
    { label: t('statusText'), key: 'status' },
    { label: t('priorityText'), key: 'priority' },
    { label: t('startDateText'), key: 'start_date' },
    { label: t('endDateText'), key: 'end_date' },
    { label: t('completedDateText'), key: 'completed_at' },
    { label: t('createdDateText'), key: 'created_at' },
    { label: t('lastUpdatedText'), key: 'updated_at' },
  ];

  const handleSortFieldChange = (fieldKey: string) => {
    const newOrder = currentSortField === fieldKey && currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
    dispatch(setSort({ field: fieldKey, order: newOrder }));
    if (projectId) dispatch(fetchTasksV3(projectId));
    setOpen(false);
  };

  const isActive = currentSortField !== '';
  const currentFieldLabel = sortFieldsList.find(f => f.key === currentSortField)?.label;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-300 ${isActive ? (isDarkMode ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200') : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`}`}
      >
        {currentSortOrder === 'ASC' ? <SortAscendingOutlined className="text-xs" /> : <SortDescendingOutlined className="text-xs" />}
        <span>{t('sortText')}</span>
        {isActive && currentFieldLabel && <span className={`text-[11px] font-semibold border-l px-1.5 ml-0.5 ${isDarkMode ? 'text-blue-300 border-blue-500/30' : 'text-blue-700 border-blue-200'}`}>{currentFieldLabel}</span>}
        <DownOutlined className={`text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          <div className="p-0.5">
            {sortFieldsList.map(sortField => {
              const isSelected = currentSortField === sortField.key;
              return (
                <button
                  key={sortField.key}
                  onClick={() => handleSortFieldChange(sortField.key)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-all duration-150 ${isSelected ? (isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-700 font-semibold') : `${themeClasses.optionText} ${themeClasses.optionHover}`}`}
                >
                  <span>{sortField.label}</span>
                  {isSelected && (currentSortOrder === 'ASC' ? <SortAscendingOutlined className="text-[10px]" /> : <SortDescendingOutlined className="text-[10px]" />)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const FieldsDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const { t: tTable } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const columns = useSelector(selectColumns);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [];
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.order - b.order), [fields]);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visibleCount = sortedFields.filter(f => f.visible).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setOpen(!open)} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${visibleCount > 0 ? (isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800 font-semibold') : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`}`}>
        <EyeOutlined className="text-xs" />
        <span>{t('fieldsText')}</span>
        {visibleCount > 0 && <span className="ml-1 px-1.5 bg-gray-500 text-white rounded-full text-[10px]">{visibleCount}</span>}
        <DownOutlined className="text-[10px]" />
      </button>

      {open && (
        <div className={`absolute top-full right-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}>
          <div className="max-h-48 overflow-y-auto p-0.5">
            {sortedFields.map(field => (
              <button
                key={field.key}
                onClick={() => {
                  dispatch(toggleField(field.key));
                  const targetColumn = columns.find(col => col.key === field.key || (col as any).id === field.key);
                  if (targetColumn?.custom_column) {
                    dispatch(updateCustomColumnPinned({ columnKey: targetColumn.key || (targetColumn as any).id || field.key, isVisible: !field.visible }));
                  } else if (projectId) {
                    dispatch(syncFieldWithDatabase({ projectId, fieldKey: field.key, visible: !field.visible, columns }));
                  }
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${field.visible ? 'font-semibold' : themeClasses.optionText + ' ' + themeClasses.optionHover}`}
              >
                <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${field.visible ? 'bg-blue-500 border-blue-400 text-white' : 'border-gray-300'}`}>
                  {field.visible && <CheckOutlined className="text-[8px]" />}
                </div>
                <span>{field.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ImprovedTaskFilters: React.FC<ImprovedTaskFiltersProps> = ({ position, className = '' }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);
  const kanbanState = useAppSelector((state: RootState) => state.enhancedKanbanReducer);
  const taskManagementArchived = useAppSelector(selectArchived);
  const taskReducerArchived = useAppSelector(state => state.taskReducer.archived);
  const showArchived = position === 'list' ? taskManagementArchived : taskReducerArchived;
  const taskManagementSearch = useAppSelector(state => state.taskManagement?.search || '');
  const kanbanSearch = useAppSelector(state => state.enhancedKanbanReducer?.search || '');
  const searchValue = position === 'board' ? kanbanSearch : taskManagementSearch;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [clearingFilters, setClearingFilters] = useState(false);
  const [showManageStatusModal, setShowManageStatusModal] = useState(false);
  const [showManagePhaseModal, setShowManagePhaseModal] = useState(false);

  const filterSectionsData = useFilterData(position);
  const isDataLoaded = filterSectionsData.length > 0;

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const { projectId } = useAppSelector(state => state.projectReducer);
  const projectPhaseLabel = useAppSelector(state => state.projectReducer.project?.phase_label);

  const themeClasses = useMemo(() => ({
    containerBg: isDarkMode ? 'bg-[#141414]' : 'bg-white',
    containerBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-200',
    buttonBg: isDarkMode ? 'bg-[#1f1f1f] hover:bg-[#262626]' : 'bg-white hover:bg-gray-50',
    buttonBorder: isDarkMode ? 'border-[#333333]' : 'border-gray-300',
    buttonText: isDarkMode ? 'text-[#e5e7eb]' : 'text-gray-700',
    dropdownBg: isDarkMode ? 'bg-[#1f1f1f]' : 'bg-white',
    dropdownBorder: isDarkMode ? 'border-[#303030]' : 'border-gray-200',
    optionText: isDarkMode ? 'text-[#d1d5db]' : 'text-gray-700',
    optionHover: isDarkMode ? 'hover:bg-[#262626]' : 'hover:bg-gray-50',
    secondaryText: isDarkMode ? 'text-[#9ca3af]' : 'text-gray-500',
    dividerBorder: isDarkMode ? 'border-[#404040]' : 'border-gray-200',
  }), [isDarkMode]);

  const handleSelectionChange = useCallback((sectionId: string, values: string[]) => {
    if (!projectId) return;
    if (position === 'board') {
      if (sectionId === 'groupBy' && values.length > 0) {
        dispatch(setKanbanGroupBy(values[0] as any));
        dispatch(fetchEnhancedKanbanGroups(projectId));
      } else if (sectionId === 'priority') {
        dispatch(setKanbanPriorities(values));
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
      // ... other board filters
    } else {
      if (sectionId === 'groupBy' && values.length > 0) {
        dispatch(setCurrentGrouping(values[0] as any));
        dispatch(fetchTasksV3(projectId));
      } else if (sectionId === 'priority') {
        dispatch(setPriorities(values));
        dispatch(fetchTasksV3(projectId));
      }
      // ... other list filters
    }
  }, [dispatch, projectId, position]);

  const handleSearchChange = (val: string) => {
    if (!projectId) return;
    if (position === 'board') {
      dispatch(setKanbanSearch(val));
      dispatch(fetchEnhancedKanbanGroups(projectId));
    } else {
      dispatch(setTaskManagementSearch(val));
      dispatch(fetchTasksV3(projectId));
    }
  };

  const clearAllFilters = () => {
    if (!projectId) return;
    dispatch(setTaskManagementSearch(''));
    dispatch(setPriorities([]));
    dispatch(setMembers([]));
    dispatch(setLabels([]));
    if (projectId) dispatch(fetchTasksV3(projectId));
  };

  return (
    <div className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-1.5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[36px]">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <SearchFilter value={searchValue} onChange={handleSearchChange} themeClasses={themeClasses} />
          {position === 'list' && <SortDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
          {isDataLoaded ? filterSectionsData.map(section => (
            <FilterDropdown key={section.id} section={section} onSelectionChange={handleSelectionChange} isOpen={openDropdown === section.id} onToggle={() => setOpenDropdown(openDropdown === section.id ? null : section.id)} themeClasses={themeClasses} isDarkMode={isDarkMode} projectPhaseLabel={projectPhaseLabel} onManageStatus={() => setShowManageStatusModal(true)} onManagePhase={() => setShowManagePhaseModal(true)} />
          )) : <div className="text-xs text-gray-500">Loading...</div>}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {searchValue || position === 'list' ? <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{t('clearAll')}</button> : null}
          {position === 'list' && <FieldsDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
        </div>
      </div>
      <ManageStatusModal open={showManageStatusModal} onClose={() => setShowManageStatusModal(false)} projectId={projectId || undefined} />
      <ManagePhaseModal open={showManagePhaseModal} onClose={() => setShowManagePhaseModal(false)} projectId={projectId || undefined} />
    </div>
  );
};

export default React.memo(ImprovedTaskFilters);
