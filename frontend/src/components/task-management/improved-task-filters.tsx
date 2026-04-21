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
  SettingOutlined,
} from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useFilterDataLoader } from '@/hooks/useFilterDataLoader';
import {
  setFields as setTaskListFields,
  toggleField,
  syncFieldWithDatabase,
} from '@/features/task-management/taskListFields.slice';
import {
  selectColumns,
  updateColumnVisibility,
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
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

// Performance constants
const FILTER_DEBOUNCE_DELAY = 300; // ms
const SEARCH_DEBOUNCE_DELAY = 500; // ms
const MAX_FILTER_OPTIONS = 100;

// Optimized selectors with proper transformation logic
const selectFilterData = createSelector(
  [
    (state: RootState) => state.priorityReducer.priorities,
    (state: RootState) => state.taskReducer.priorities,
    (state: RootState) => state.boardReducer.priorities,
    (state: RootState) => state.taskReducer.labels,
    (state: RootState) => state.boardReducer.labels,
    (state: RootState) => state.taskReducer.taskAssignees,
    (state: RootState) => state.boardReducer.taskAssignees,
    (state: RootState) => state.projectReducer.project,
    // Enhanced kanban data
    (state: RootState) => state.enhancedKanbanReducer.originalTaskAssignees,
    (state: RootState) => state.enhancedKanbanReducer.originalLabels,
    (state: RootState) => state.enhancedKanbanReducer.priorities,
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
      const currentLabels = filterData.taskLabels;
      const currentAssignees = filterData.taskAssignees;
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

const FilterDropdown: React.FC<{
  section: FilterSection;
  onSelectionChange: (sectionId: string, values: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  themeClasses: any;
  isDarkMode: boolean;
  className?: string;
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
  onManageStatus,
  onManagePhase,
  projectPhaseLabel,
}) => {
  const { t } = useTranslation('task-list-filters');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptionsMemo = useMemo(() => {
    const baseOptions = !section.searchable || !searchTerm.trim()
      ? section.options
      : section.options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );

    if (section.id === 'labels' || section.id === 'assignees') {
      return [...baseOptions].sort((a, b) => {
        const aSelected = section.selectedValues.includes(a.value) ? 1 : 0;
        const bSelected = section.selectedValues.includes(b.value) ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        return a.label.localeCompare(b.label);
      });
    }

    return baseOptions;
  }, [searchTerm, section]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

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
          border transition-all duration-200 ease-in-out
          ${
            selectedCount > 0
              ? isDarkMode
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 font-semibold'
                : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50
        `}
      >
        <IconComponent className="w-3.5 h-3.5 opacity-80" />
        <span className="truncate flex items-center gap-1.5">
          {section.label}
          {section.id === 'groupBy' && (
            <span className={`font-medium opacity-100 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
              {section.options.find(o => o.value === section.selectedValues[0])?.label}
            </span>
          )}
        </span>
        {selectedCount > 0 && section.id !== 'groupBy' && (
          <span className={`
            inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 text-[9px] font-bold rounded-full ml-0.5
            ${isDarkMode ? 'bg-[#333333] text-white' : 'bg-gray-200 text-gray-700'}
          `}>
            {selectedCount}
          </span>
        )}
        <DownOutlined className={`text-[10px] opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-lg border ${themeClasses.dropdownBorder}`}>
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={`Search ${section.label.toLowerCase()}...`}
                  className={`w-full pl-8 pr-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-white text-gray-900 border-gray-300'}`}
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptionsMemo.map(option => {
              const isSelected = section.selectedValues.includes(option.value);
              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionToggle(option.value)}
                  className={`
                    w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors text-left
                    ${isSelected ? (isDarkMode ? 'bg-blue-600/20 text-white' : 'bg-blue-50 text-blue-700 font-semibold') : themeClasses.optionText + ' ' + themeClasses.optionHover}
                  `}
                >
                  {section.id !== 'groupBy' && (
                    <div className={`flex items-center justify-center w-3.5 h-3.5 border rounded shrink-0 ${isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                      {isSelected && <CheckOutlined className="text-[8px] font-bold" />}
                    </div>
                  )}
                  {option.avatar ? (
                    <img src={option.avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
                  ) : option.color ? (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  ) : null}
                  <span className="truncate flex-1">{option.label}</span>
                </button>
              );
            })}
          </div>

          {section.id === 'groupBy' && canConfigure && (
            <div className={`p-1 border-t ${themeClasses.dividerBorder}`}>
              {section.selectedValues[0] === 'status' && (
                <button onClick={() => { onToggle(); onManageStatus?.(); }} className={`w-full px-2 py-1.5 text-[11px] text-left rounded ${themeClasses.optionText} ${themeClasses.optionHover}`}>
                  Manage Statuses...
                </button>
              )}
              {section.selectedValues[0] === 'phase' && (
                <button onClick={() => { onToggle(); onManagePhase?.(); }} className={`w-full px-2 py-1.5 text-[11px] text-left rounded ${themeClasses.optionText} ${themeClasses.optionHover}`}>
                  Manage {projectPhaseLabel}...
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SearchFilter: React.FC<{
  value: string;
  onChange: (value: string) => void;
  themeClasses: any;
}> = ({ value, onChange, themeClasses }) => {
  const { t } = useTranslation('task-list-filters');
  const [localValue, setLocalValue] = useState(value);
  const [isExpanded, setIsExpanded] = useState(!!value);
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  useEffect(() => { setLocalValue(value); }, [value]);

  return (
    <div className="relative">
      {!isExpanded ? (
        <button 
          onClick={() => setIsExpanded(true)} 
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border 
            transition-all duration-200
            ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}
            hover:border-gray-500
          `}
        >
          <SearchOutlined className="text-[11px] opacity-70" />
          <span>{value || 'Search'}</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
          <div className="relative w-48">
            <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onChange(localValue)}
              placeholder="Search..."
              className={`w-full pl-8 pr-2 py-1.5 text-xs rounded border focus:outline-none transition-all ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
            />
          </div>
          <button onClick={() => onChange(localValue)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">Apply</button>
          <button onClick={() => { setIsExpanded(false); setLocalValue(''); onChange(''); }} className={`px-2 py-1.5 text-xs ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>Cancel</button>
        </div>
      )}
    </div>
  );
};

const SortDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSortField = useAppSelector(selectSortField);
  const currentSortOrder = useAppSelector(selectSortOrder);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SORT_FIELDS = [
    { label: t('taskText'), key: 'name' },
    { label: t('statusText'), key: 'status' },
    { label: t('priorityText'), key: 'priority' },
    { label: t('startDateText'), key: 'start_date' },
    { label: t('dueDateText'), key: 'end_date' },
    { label: t('createdDateText'), key: 'created_at' },
  ];

  const handleSort = (fieldKey: string) => {
    const order = currentSortField === fieldKey && currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
    dispatch(setSort({ field: fieldKey, order }));
    if (projectId) dispatch(fetchTasksV3(projectId));
    setOpen(false);
  };

  const isActive = !!currentSortField;

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setOpen(!open)} className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border ${isActive ? (isDarkMode ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200 font-bold') : themeClasses.buttonBg + ' ' + themeClasses.buttonBorder + ' ' + themeClasses.buttonText}`}>
        {currentSortOrder === 'ASC' ? <SortAscendingOutlined className="text-xs" /> : <SortDescendingOutlined className="text-xs" />}
        <span>Sort {isActive && `| ${SORT_FIELDS.find(f => f.key === currentSortField)?.label}`}</span>
        <DownOutlined className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-56 ${themeClasses.dropdownBg} rounded-md shadow-lg border ${themeClasses.dropdownBorder}`}>
          <div className="p-1">
            {SORT_FIELDS.map(f => (
              <button key={f.key} onClick={() => handleSort(f.key)} className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded transition-all ${currentSortField === f.key ? (isDarkMode ? 'bg-blue-600/20 text-white font-semibold' : 'bg-blue-50 text-blue-700 font-bold') : themeClasses.optionText + ' ' + themeClasses.optionHover}`}>
                <span>{f.label}</span>
                {currentSortField === f.key && (currentSortOrder === 'ASC' ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FieldsDropdown: React.FC<{ themeClasses: any; isDarkMode: boolean }> = ({ themeClasses, isDarkMode }) => {
  const { t } = useTranslation('task-list-filters');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const fieldsRaw = useSelector((state: RootState) => state.taskManagementFields);
  const columns = useSelector(selectColumns);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const fields = Array.isArray(fieldsRaw) ? fieldsRaw : [];
  const STANDARD_FIELD_KEYS = useMemo(
    () =>
      new Set([
        'KEY',
        'DESCRIPTION',
        'PROGRESS',
        'STATUS',
        'ASSIGNEES',
        'LABELS',
        'PHASE',
        'PRIORITY',
        'TIME_TRACKING',
        'ESTIMATION',
        'START_DATE',
        'DUE_DATE',
        'DUE_TIME',
        'COMPLETED_DATE',
        'CREATED_DATE',
        'LAST_UPDATED',
        'REPORTER',
      ]),
    []
  );
  const ALWAYS_HIDDEN_FIELD_KEYS = useMemo(() => new Set(['TASK', 'NAME']), []);

  const displayFields = useMemo(() => {
    // Until backend columns are loaded, keep current list as-is.
    if (!Array.isArray(columns) || columns.length === 0) {
      return fields;
    }

    const backendKeys = new Set(
      columns
        .map((c: any) => String(c?.key || c?.id || ''))
        .filter(Boolean)
    );

    return fields.filter(f => {
      const key = String(f.key || '').toUpperCase();
      if (ALWAYS_HIDDEN_FIELD_KEYS.has(key)) return false;
      return STANDARD_FIELD_KEYS.has(key) || backendKeys.has(String(f.key));
    });
  }, [fields, columns, STANDARD_FIELD_KEYS, ALWAYS_HIDDEN_FIELD_KEYS]);

  useEffect(() => {
    // Prune ghost custom fields from Redux + localStorage once columns are loaded.
    if (!Array.isArray(columns) || columns.length === 0) return;
    if (displayFields.length === fields.length) return;
    dispatch(setTaskListFields(displayFields));
  }, [columns, displayFields, fields.length, dispatch]);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleCount = displayFields.filter(f => f.visible).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)} 
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border 
          ${visibleCount > 0 
            ? (isDarkMode ? 'bg-[#1f1f1f] border-[#333333] text-white' : 'bg-gray-100 text-gray-800 font-semibold') 
            : themeClasses.buttonBg + ' ' + themeClasses.buttonBorder + ' ' + themeClasses.buttonText}
        `}
      >
        <EyeOutlined className="text-xs opacity-80" />
        <span>Fields</span>
        {visibleCount > 0 && (
          <span className={`
            ml-1 px-1.5 h-4 flex items-center justify-center text-[9px] font-bold rounded-full
            ${isDarkMode ? 'bg-[#333333] text-white' : 'bg-gray-200 text-gray-700'}
          `}>
            {visibleCount}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute top-full right-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-lg border ${themeClasses.dropdownBorder}`}>
          <div className="max-h-60 overflow-y-auto p-1">
            {displayFields.map(f => (
              <button key={f.key} onClick={() => {
                dispatch(toggleField(f.key));
                const col = columns.find(c => c.key === f.key || (c as any).id === f.key);
                const nextVisible = !f.visible;
                if (col?.custom_column) {
                  dispatch(updateCustomColumnPinned({ columnKey: col.key || (col as any).id || f.key, isVisible: nextVisible }));
                  if (projectId) {
                    dispatch(
                      updateColumnVisibility({
                        projectId,
                        item: {
                          ...col,
                          key: col.key || (col as any).id || f.key,
                          id: (col as any).id || col.key || f.key,
                          pinned: nextVisible,
                          custom_column: true,
                        } as any,
                      })
                    );
                    socket?.emit(SocketEvents.CUSTOM_COLUMN_PINNED_CHANGE.toString(), {
                      project_id: projectId,
                      action: 'visibility',
                      column_id: (col as any).id || col.key || f.key,
                      is_visible: nextVisible,
                    });
                  }
                } else if (projectId) {
                  dispatch(syncFieldWithDatabase({ projectId, fieldKey: f.key, visible: nextVisible, columns }));
                }
              }} className={`w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-all ${f.visible ? 'font-semibold text-blue-600' : themeClasses.optionText + ' ' + themeClasses.optionHover}`}>
                <div className={`w-3.5 h-3.5 border rounded shrink-0 flex items-center justify-center ${f.visible ? 'bg-blue-500 border-blue-400 text-white' : 'border-gray-300'}`}>
                  {f.visible && <CheckOutlined className="text-[8px]" />}
                </div>
                <span className="truncate">{f.label}</span>
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
  const { projectId } = useAppSelector(state => state.projectReducer);
  const projectPhaseLabel = useAppSelector(state => state.projectReducer.project?.phase_label);
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const taskManagementSearch = useAppSelector(state => state.taskManagement?.search || '');
  const kanbanSearch = useAppSelector(state => state.enhancedKanbanReducer?.search || '');
  const searchValue = position === 'board' ? kanbanSearch : taskManagementSearch;

  const currentTaskAssignees = useAppSelector(state => state.taskReducer.taskAssignees);
  const currentTaskLabels = useAppSelector(state => state.taskReducer.labels);
  const kanbanTaskAssignees = useAppSelector(state => state.enhancedKanbanReducer.taskAssignees);
  const kanbanLabels = useAppSelector(state => state.enhancedKanbanReducer.labels);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showManageStatusModal, setShowManageStatusModal] = useState(false);
  const [showManagePhaseModal, setShowManagePhaseModal] = useState(false);

  useFilterDataLoader();
  const filterSectionsData = useFilterData(position);

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
    dividerBorder: isDarkMode ? 'border-[#404040]' : 'border-gray-200',
    activeBlue: isDarkMode ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' : 'bg-blue-50 text-blue-700 border-blue-200',
  }), [isDarkMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchValue) count++;
    if (filterSectionsData[0]?.selectedValues.length > 0) count++; // Priority
    if (filterSectionsData[1]?.selectedValues.length > 0) count++; // Assignees
    if (filterSectionsData[2]?.selectedValues.length > 0) count++; // Labels
    return count;
  }, [searchValue, filterSectionsData]);

  const handleSelectionChange = useCallback((sectionId: string, values: string[]) => {
    if (!projectId) return;
    
    const getSafeId = (obj: any) => String(obj?.id || obj?._id || obj?.team_member_id || '');

    if (position === 'board') {
      if (sectionId === 'groupBy') {
        dispatch(setKanbanGroupBy(values[0] as any));
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
      else if (sectionId === 'priority') {
        dispatch(setKanbanPriorities(values));
        dispatch(setPriorities(values)); // Sync with list view just in case
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
      else if (sectionId === 'assignees' || sectionId === 'members') {
        const updated = (kanbanTaskAssignees || []).map((m: any) => ({
          ...m,
          selected: values.includes(getSafeId(m)),
        }));
        dispatch(setKanbanTaskAssignees(updated));
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
      else if (sectionId === 'labels') {
        const updated = (kanbanLabels || []).map((l: any) => ({
          ...l,
          selected: values.includes(getSafeId(l)),
        }));
        dispatch(setKanbanLabels(updated));
        dispatch(fetchEnhancedKanbanGroups(projectId));
      }
    } else {
      if (sectionId === 'groupBy') {
        dispatch(setCurrentGrouping(values[0] as any));
        dispatch(fetchTasksV3(projectId));
      }
      else if (sectionId === 'priority') {
        dispatch(setPriorities(values));
        dispatch(fetchTasksV3(projectId));
      }
      else if (sectionId === 'assignees' || sectionId === 'members') {
        const updated = currentTaskAssignees.map((m: any) => ({
          ...m,
          selected: values.includes(getSafeId(m)),
        }));
        dispatch(setMembers(updated));
        dispatch(fetchTasksV3(projectId));
      }
      else if (sectionId === 'labels') {
        const updated = currentTaskLabels.map((l: any) => ({
          ...l,
          selected: values.includes(getSafeId(l)),
        }));
        dispatch(setLabels(updated));
        dispatch(fetchTasksV3(projectId));
      }
    }
  }, [dispatch, projectId, position, currentTaskAssignees, currentTaskLabels, kanbanTaskAssignees, kanbanLabels]);

  const handleSearchChange = (val: string) => {
    if (!projectId) return;
    if (position === 'board') { dispatch(setKanbanSearch(val)); dispatch(fetchEnhancedKanbanGroups(projectId)); }
    else { dispatch(setTaskManagementSearch(val)); dispatch(fetchTasksV3(projectId)); }
  };

  const clearAllFilters = () => {
    if (!projectId) return;
    dispatch(setTaskManagementSearch(''));
    dispatch(setPriorities([]));
    dispatch(setMembers(currentTaskAssignees.map(m => ({ ...m, selected: false }))));
    dispatch(setLabels(currentTaskLabels.map(l => ({ ...l, selected: false }))));
    dispatch(setSort({ field: '', order: 'ASC' }));
    if (position === 'board') { dispatch(setKanbanSearch('')); dispatch(resetKanbanState()); dispatch(fetchEnhancedKanbanGroups(projectId)); }
    else dispatch(fetchTasksV3(projectId));
  };

  const isArchived = position === 'board' 
    ? useAppSelector(state => state.enhancedKanbanReducer.archived)
    : useAppSelector(state => state.taskManagement.archived);

  return (
    <div className={`${themeClasses.containerBg} border ${themeClasses.containerBorder} rounded-md p-2 shadow-sm mb-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 min-h-[40px]">
        {/* Left Side: Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <SearchFilter value={searchValue} onChange={handleSearchChange} themeClasses={themeClasses} />
          
          {position === 'list' && <SortDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
          
          {filterSectionsData.map(section => (
            <FilterDropdown 
              key={section.id} 
              section={section} 
              onSelectionChange={handleSelectionChange} 
              isOpen={openDropdown === section.id} 
              onToggle={() => setOpenDropdown(openDropdown === section.id ? null : section.id)} 
              themeClasses={themeClasses} 
              isDarkMode={isDarkMode} 
              projectPhaseLabel={projectPhaseLabel} 
              onManageStatus={() => setShowManageStatusModal(true)} 
              onManagePhase={() => setShowManagePhaseModal(true)} 
            />
          ))}

          {/* Manage Statuses Button - Solid Blue as per image */}
          <button
            onClick={() => setShowManageStatusModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <SettingOutlined className="w-3.5 h-3.5" />
            <span>Manage Statuses</span>
          </button>
        </div>

        {/* Right Side: Active count, Clear, Archived, Fields */}
        <div className="flex items-center gap-4 ml-auto">
          {activeFilterCount > 0 && (
            <span className={`text-[11px] opacity-60 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {activeFilterCount} filter active
            </span>
          )}

          <button 
            onClick={clearAllFilters} 
            className="text-xs text-blue-500 hover:text-blue-600 font-medium whitespace-nowrap transition-colors"
          >
            Clear all
          </button>

          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => {
              if (position === 'board') {
                 dispatch(setKanbanArchived(!isArchived));
                 dispatch(fetchEnhancedKanbanGroups(projectId || ''));
              } else {
                 dispatch(toggleTaskManagementArchived());
                 dispatch(fetchTasksV3(projectId || ''));
              }
            }}
          >
            <div className={`
              w-4 h-4 rounded border flex items-center justify-center transition-all
              ${isArchived 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : `${isDarkMode ? 'border-gray-600 group-hover:border-gray-400' : 'border-gray-300 group-hover:border-gray-500'}`}
            `}>
              {isArchived && <CheckOutlined className="text-[10px]" />}
            </div>
            <span className={`text-xs ${isDarkMode ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-600 group-hover:text-gray-900'} transition-colors`}>
              Show archived
            </span>
          </div>

          {position === 'list' && <FieldsDropdown themeClasses={themeClasses} isDarkMode={isDarkMode} />}
        </div>
      </div>
      
      <ManageStatusModal open={showManageStatusModal} onClose={() => setShowManageStatusModal(false)} projectId={projectId || undefined} />
      <ManagePhaseModal open={showManagePhaseModal} onClose={() => setShowManagePhaseModal(false)} projectId={projectId || undefined} />
    </div>
  );
};

export default React.memo(ImprovedTaskFilters);
