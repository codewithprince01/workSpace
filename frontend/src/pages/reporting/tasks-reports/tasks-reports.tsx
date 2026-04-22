import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Card, Flex, Table, Tag, Avatar, Tooltip, 
  Input, Space, Typography, Badge, Button,
  Checkbox, Select, Row, Col, Divider, Dropdown
} from '@/shared/antd-imports';
import { 
  SearchOutlined, ReloadOutlined, 
  ClockCircleOutlined, UserOutlined,
  DownOutlined, ExportOutlined, RightOutlined,
  FilterOutlined, CloseCircleOutlined,
  ProjectOutlined, CheckCircleOutlined, CalendarOutlined,
  FileExcelOutlined, FileTextOutlined
} from '@/shared/antd-imports';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import dayjs from 'dayjs';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';

const { Text, Title } = Typography;
const { Option } = Select;

interface FilterOption {
    id: string | number;
    name: string;
    color?: string;
    avatar_url?: string;
}

const TasksReports = () => {
  const { t } = useTranslation('reporting-sidebar');
  useDocumentTitle('Reporting - Tasks');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
    unassigned: 0,
    dueThisWeek: 0
  });

  const [filterOptions, setFilterOptions] = useState<{
    teams: FilterOption[];
    projects: FilterOption[];
    statuses: FilterOption[];
    priorities: FilterOption[];
    project_managers: FilterOption[];
  }>({
    teams: [],
    projects: [],
    statuses: [],
    priorities: [],
    project_managers: []
  });

  const [params, setParams] = useState({
    index: 1,
    size: 50,
    search: '',
    field: 'created_at',
    order: 'descend',
    includeArchived: false,
    teams: [] as string[],
    projects: [] as string[],
    statuses: [] as string[],
    priorities: [] as string[],
    project_managers: [] as string[]
  });

  const fetchFilters = useCallback(async () => {
    try {
      const res = await reportingApiService.getTasksReportingFilters();
      if (res.done) {
        setFilterOptions(res.body);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportingApiService.getTasksReports(params);
      console.log('Reporting API Response:', res); // Log as requested
      if (res.done) {
        setData(res.body.tasks);
        setTotal(res.body.total);
        setStats(res.body.stats);
      }
    } catch (error) {
      console.error('Failed to fetch tasks reports:', error);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const handleExport = (type: 'csv' | 'excel') => {
    if (!data || data.length === 0) return;

    const exportData = data.map(task => ({
      'Task Name': task.name,
      'Key': task.key || '-',
      'Project': task.project_name || '-',
      'Status': task.status_name || '-',
      'Priority': task.priority_label || '-',
      'Assignees': task.assignees?.map((a: any) => a.name).join(', ') || 'Unassigned',
      'Due Date': task.due_date ? dayjs(task.due_date).format('MMM DD, YYYY') : '-',
      'Progress': `${task.progress || 0}%`,
      'Estimated (h)': task.estimated_time || 0,
      'Logged (h)': task.logged_time || 0,
      'Overlogged (h)': task.overlogged_time || 0,
      'Phase': task.phase_name || '-',
      'Created': task.created_at ? dayjs(task.created_at).format('MMM DD, YYYY') : '-',
    }));

    if (type === 'csv') {
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => 
        Object.values(row).map(val => {
            const strValue = String(val).replace(/"/g, '""');
            return `"${strValue}"`;
        }).join(',')
      );
      const csvStr = [headers, ...rows].join('\n');
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tasks_Report_${dayjs().format('YYYY-MM-DD')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      let html = '<html><head><meta charset="UTF-8"></head><body><table border="1">';
      html += '<tr style="background:#f2f2f2"><th>' + Object.keys(exportData[0]).join('</th><th>') + '</th></tr>';
      exportData.forEach(row => {
        html += '<tr><td>' + Object.values(row).join('</td><td>') + '</td></tr>';
      });
      html += '</table></body></html>';
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Tasks_Report_${dayjs().format('YYYY-MM-DD')}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportMenu = (
    <div style={{ 
        backgroundColor: themeWiseColor('#ffffff', '#1d1d1d', themeMode), 
        border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`, 
        borderRadius: '8px', 
        padding: '4px 0', 
        boxShadow: themeWiseColor('0 4px 12px rgba(0,0,0,0.1)', '0 4px 12px rgba(0,0,0,0.5)', themeMode), 
        minWidth: '180px' 
    }}>
      <div className="custom-option-item" onClick={() => handleExport('csv')} style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <FileTextOutlined style={{ marginRight: 10, color: '#1677ff' }} />
        <span style={{ color: themeWiseColor('#262626', '#fff', themeMode) }}>Export to CSV</span>
      </div>
      <div className="custom-option-item" onClick={() => handleExport('excel')} style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <FileExcelOutlined style={{ marginRight: 10, color: '#52c41a' }} />
        <span style={{ color: themeWiseColor('#262626', '#fff', themeMode) }}>Export to Excel</span>
      </div>
    </div>
  );

  // Real-time polling logic
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1 minute polling for reporting
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setParams(p => ({
        ...p,
        index: pagination.current,
        size: pagination.pageSize,
        field: sorter.field || 'created_at',
        order: sorter.order || 'descend'
    }));
  };

  const clearAllFilters = () => {
    setParams(p => ({
      ...p,
      teams: [],
      projects: [],
      statuses: [],
      priorities: [],
      project_managers: [],
      search: '',
      index: 1
    }));
  };

  // --- Tree Building Logic ---
  const buildTaskTree = (tasks: any[]) => {
    const taskMap = new Map();
    const tree: any[] = [];

    // Initialize map
    tasks.forEach(t => {
      taskMap.set(t.id, { ...t, children: [] });
    });

    // Build tree
    tasks.forEach(t => {
      const node = taskMap.get(t.id);
      if (t.parent_task_id && taskMap.has(t.parent_task_id)) {
        taskMap.get(t.parent_task_id).children.push(node);
      } else {
        tree.push(node);
      }
    });

    // Cleanup empty children
    const cleanup = (nodes: any[]) => {
      nodes.forEach(n => {
        if (n.children.length === 0) {
          delete n.children;
        } else {
          cleanup(n.children);
        }
      });
    };
    cleanup(tree);

    return tree;
  };

  const tableData = useMemo(() => buildTaskTree(data), [data]);

  // --- Persistent Column Selection ---
  const STORAGE_KEY = 'worklenz_reporting_tasks_columns';
  const DEFAULT_COLUMNS = ['name', 'status', 'assignees', 'due_date'];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const allColumnDefs: any[] = [
    {
      title: 'Task',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 300,
      sorter: true,
      render: (name: string, record: any) => {
        const isSubtask = !!record.parent_task_id;
        const displayName = name === '-' ? 'Untitled Task' : name;
        return (
          <div style={{ paddingLeft: isSubtask ? '12px' : '8px', paddingRight: '16px', display: 'flex', alignItems: 'center' }}>
              {isSubtask && <span style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), marginRight: '6px', fontSize: '11px', opacity: 0.8 }}>»</span>}
              <Text style={{ color: themeWiseColor('#262626', '#fff', themeMode), fontSize: '13px', fontWeight: 500 }}>{displayName}</Text>
          </div>
        );
      },
    },
    {
        title: 'Key',
        dataIndex: 'key',
        key: 'key',
        width: 120,
        sorter: false,
        render: (key: string) => <div style={{ paddingLeft: '16px' }}><Text style={{ color: themeWiseColor('#8c8c8c', '#888', themeMode), fontSize: '13px' }}>{key || '-'}</Text></div>,
    },
    {
      title: 'Project',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 180,
      sorter: true,
      render: (name: string, record: any) => (
        <Space size={8}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: record.project_color || '#8c8c8c' }} />
          <Text style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px' }}>{name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status_name',
      key: 'status',
      width: 130,
      sorter: true,
      render: (name: string, record: any) => {
        if (!name || name === '-') return '-';
        let color = '#8c8c8c'; // Default Grey
        if (record.status_category === 'done') color = '#52c41a';    // Green
        else if (record.status_category === 'doing') color = '#1890ff'; // Blue
        
        const textColor = '#fff';

        return (
          <div 
            style={{ 
              backgroundColor: color, 
              color: textColor, 
              padding: '1px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 500,
              display: 'inline-block',
              textAlign: 'center',
              minWidth: '60px'
            }}
          >
            {name}
          </div>
        );
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority_label',
      key: 'priority',
      width: 120,
      sorter: true,
      render: (label: string, record: any) => {
        if (!label || label === '-') return '-';
        return (
          <div 
            style={{ 
              backgroundColor: record.priority_color || '#faad14', 
              color: '#fff', 
              padding: '1px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 500,
              display: 'inline-block',
              textAlign: 'center',
              minWidth: '60px'
            }}
          >
            {label}
          </div>
        );
      },
    },
    {
      title: 'Assignees',
      dataIndex: 'assignees',
      key: 'assignees',
      width: 140,
      render: (assignees: any[]) => {
        if (!assignees || assignees.length === 0) return '-';
        return (
          <Avatar.Group maxCount={3} size={22}>
            {assignees.map((user: any) => (
              <Tooltip title={user.name} key={user.id}>
                <Avatar src={user.avatar_url} style={{ border: '1px solid #141414' }}>{user.name?.charAt(0)}</Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      },
    },
    {
        title: 'Start Date',
        dataIndex: 'start_date',
        key: 'start_date',
        width: 120,
        sorter: true,
        render: (date: string) => date ? (
          <Text style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px' }}>{dayjs(date).format('MMM DD')}</Text>
        ) : '-',
      },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      sorter: true,
      render: (date: string) => date ? (
        <Text style={{ color: '#ef4444', fontSize: '13px' }}>{dayjs(date).format('MMM DD')}</Text>
      ) : '-',
    },
    {
        title: 'Created',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 140,
        sorter: true,
        render: (date: string) => date ? (
          <Text style={{ color: '#8c8c8c', fontSize: '13px' }}>{dayjs(date).format('MMM DD')}</Text>
        ) : '-',
    },
    {
        title: 'Completed',
        dataIndex: 'completed_at',
        key: 'completed_at',
        width: 140,
        sorter: true,
        render: (date: string) => date ? (
          <Text style={{ color: '#8c8c8c', fontSize: '13px' }}>{dayjs(date).format('MMM DD')}</Text>
        ) : '-',
    },
    {
        title: 'Last Updated',
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 140,
        sorter: true,
        render: (date: string) => date ? (
          <Text style={{ color: '#8c8c8c', fontSize: '13px' }}>{dayjs(date).format('MMM DD')}</Text>
        ) : '-',
    },
    {
        title: 'Days Overdue',
        dataIndex: 'days_overdue',
        key: 'days_overdue',
        width: 130,
        sorter: true,
        render: (days: number) => days > 0 ? (
          <Text style={{ color: '#ef4444', fontWeight: 600 }}>{days}</Text>
        ) : '-',
    },
    {
      title: 'Estimated',
      dataIndex: 'estimated_time',
      key: 'estimated_time',
      width: 130,
      sorter: false,
      render: (hours: number) => {
        if (!hours) return '-';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return <Text style={{ color: '#bfbfbf', fontSize: '13px' }}>{h}h {m}m</Text>;
      },
    },
    {
      title: 'Logged',
      dataIndex: 'logged_time',
      key: 'logged_time',
      width: 130,
      sorter: false,
      render: (hours: number) => {
        if (!hours) return '-';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return <Text style={{ color: '#bfbfbf', fontSize: '13px' }}>{h}h {m}m</Text>;
      },
    },
    {
        title: 'Overlogged',
        dataIndex: 'overlogged_time',
        key: 'overlogged_time',
        width: 150,
        sorter: false,
        render: (hours: number) => {
          if (!hours || hours <= 0) return '-';
          const h = Math.floor(hours);
          const m = Math.round((hours - h) * 60);
          return <Text style={{ color: '#ff4d4f', fontSize: '13px' }}>{h}h {m}m</Text>;
        },
    },
    {
        title: 'Phase',
        dataIndex: 'phase_name',
        key: 'phase',
        width: 150,
        sorter: false,
        render: (name: string) => <Text style={{ color: '#bfbfbf', fontSize: '13px' }}>{name || '-'}</Text>,
    },
    {
        title: 'Labels',
        dataIndex: 'labels',
        key: 'labels',
        width: 180,
        render: (labels: any[]) => {
          if (!labels || labels.length === 0) return '-';
          return (
            <Space size={[4, 4]} wrap>
              {labels.map((l, i) => {
                const labelName = typeof l === 'object' ? l.name : l;
                const labelColor = typeof l === 'object' ? (l.color || l.color_code || '#333') : '#333';
                return (
                    <Tag 
                        key={i} 
                        style={{ 
                            margin: 0, 
                            fontSize: '11px', 
                            borderRadius: '4px', 
                            border: 'none', 
                            backgroundColor: labelColor === '#333' ? '#333' : `${labelColor}20`, 
                            color: labelColor === '#333' ? '#fff' : labelColor 
                        }}
                    >
                        {labelName}
                    </Tag>
                );
              })}
            </Space>
          );
        },
    },
    {
        title: 'Progress',
        dataIndex: 'progress',
        key: 'progress',
        width: 120,
        sorter: true,
        render: (p: number) => (
          <Text style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px' }}>{p || 0}%</Text>
        ),
    },
    {
        title: 'Subtasks',
        dataIndex: 'subtask_count',
        key: 'subtasks',
        width: 100,
        sorter: true,
        render: (count: number) => (
          <Text style={{ color: '#8c8c8c', fontSize: '13px' }}>{count || 0}</Text>
        ),
    },
  ];

  const columns = useMemo(() => {
    return allColumnDefs.filter(col => visibleColumns.includes(col.key));
  }, [visibleColumns]);

  const statCards = [
    { title: 'Total Tasks', value: stats.total },
    { title: 'Completed', value: stats.completed },
    { title: 'In Progress', value: stats.inProgress },
    { title: 'Overdue', value: stats.overdue },
    { title: 'Unassigned', value: stats.unassigned },
    { title: 'Due This Week', value: stats.dueThisWeek },
  ];

  // --- Custom Filter Component ---
  const FilterSelect = ({ 
    placeholder, 
    options, 
    value, 
    onChange, 
    width = 110,
    showSearch = false,
    badgeMode = false,
    includeUnassigned = false,
    showSelectAll = true
  }: { 
    placeholder: string, 
    options: FilterOption[], 
    value: any[], 
    onChange: (val: any[]) => void,
    width?: number,
    showSearch?: boolean,
    badgeMode?: boolean,
    includeUnassigned?: boolean,
    showSelectAll?: boolean
  }) => {
    const [searchValue, setSearchValue] = useState('');
    const isAllSelected = options.length > 0 && value.length === options.length;

    const filteredOptions = useMemo(() => {
        let opts = options;
        if (searchValue) {
            opts = options.filter(o => o.name.toLowerCase().includes(searchValue.toLowerCase()));
        }
        return opts;
    }, [options, searchValue]);

    const onSelectAll = (checked: boolean) => {
      if (checked) {
        onChange([...options.map(o => o.id), ...(includeUnassigned ? ['unassigned'] : [])]);
      } else {
        onChange([]);
      }
    };

    return (
      <Select
        mode="multiple"
        maxTagCount={0}
        value={value}
        onChange={onChange}
        placeholder={value.length > 0 ? "" : placeholder} // Hide placeholder if values selected
        style={{ width: 140 }}
        className="premium-select"
        maxTagPlaceholder={() => (
            <span style={{ color: themeWiseColor('#262626', '#fff', themeMode), fontSize: '13px' }}>
                {placeholder} <span style={{ color: '#1890ff', marginLeft: '4px' }}>({value.length})</span>
            </span>
        )}
        suffixIcon={<DownOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: '10px' }} />}
        dropdownStyle={{ minWidth: showSearch ? 280 : 200 }}
        dropdownRender={(menu) => (
          <div 
            className="premium-dropdown"
            style={{
                backgroundColor: themeWiseColor('#ffffff', '#1f1f1f', themeMode),
                border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`,
                borderRadius: '8px',
                boxShadow: themeWiseColor('0 4px 12px rgba(0,0,0,0.1)', '0 4px 12px rgba(0,0,0,0.5)', themeMode)
            }}
          >
            <div style={{ padding: '12px' }}>
                {showSearch && (
                    <Input 
                        placeholder="Search..." 
                        prefix={<SearchOutlined style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode) }} />}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        style={{ 
                            backgroundColor: themeWiseColor('#fafafa', '#141414', themeMode), 
                            border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`, 
                            color: themeWiseColor('#262626', '#fff', themeMode), 
                            borderRadius: '6px',
                            height: '32px',
                            marginBottom: '12px'
                        }}
                        className="premium-input dropdown-search"
                    />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {includeUnassigned ? (
                        <div 
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => {
                                const newValue = value.includes('unassigned') 
                                    ? value.filter(v => v !== 'unassigned') 
                                    : [...value, 'unassigned'];
                                onChange(newValue);
                            }}
                        >
                            <Checkbox checked={value.includes('unassigned')} className="premium-checkbox" />
                            <span style={{ marginLeft: 10, fontSize: '13px', color: themeWiseColor('#262626', '#fff', themeMode) }}>Unassigned</span>
                        </div>
                    ) : showSelectAll ? (
                        <Checkbox 
                            checked={isAllSelected}
                            indeterminate={value.length > 0 && value.length < options.length}
                            onChange={(e) => onSelectAll(e.target.checked)}
                            className="premium-checkbox"
                            style={{ fontSize: '13px', color: themeWiseColor('#262626', '#fff', themeMode) }}
                        >
                            Select All
                        </Checkbox>
                    ) : (
                        <div /> // Spacer if no Select All
                    )}
                    <Button type="text" size="small" style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode), padding: 0, fontSize: '13px' }} onClick={() => onChange([])}>Clear All</Button>
                </div>
            </div>
            <Divider style={{ margin: '0', borderColor: themeWiseColor('#f0f0f0', '#333', themeMode) }} />
            <div style={{ maxHeight: 250, overflow: 'auto' }}>
                {filteredOptions.length > 0 ? (
                    <div className="dropdown-options-list">
                        {filteredOptions.map(opt => {
                            const isSelected = value.some(val => String(val) === String(opt.id));
                            return (
                                <div 
                                    key={String(opt.id)} 
                                    className={`custom-option-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                        const newValue = isSelected 
                                            ? value.filter(v => String(v) !== String(opt.id)) 
                                            : [...value, opt.id];
                                        onChange(newValue);
                                    }}
                                    style={{ 
                                        padding: '8px 12px', 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        backgroundColor: isSelected ? themeWiseColor('#e6f7ff', 'rgba(24, 144, 255, 0.1)', themeMode) : 'transparent'
                                    }}
                                >
                                    <Checkbox checked={isSelected} className="premium-checkbox" />
                                <div style={{ marginLeft: 10, display: 'flex', alignItems: 'center' }}>
                                    {opt.avatar_url && <Avatar src={opt.avatar_url} size={24} style={{ marginRight: 10 }} />}
                                    {badgeMode ? (
                                        <div 
                                            style={{ 
                                                backgroundColor: opt.color || '#3b82f6', 
                                                color: '#fff', 
                                                padding: '2px 10px', 
                                                borderRadius: '4px', 
                                                fontSize: '12px', 
                                                fontWeight: 600,
                                                minWidth: '60px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {opt.name}
                                        </div>
                                    ) : (
                                        <>
                                            {opt.color && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: opt.color, marginRight: 10 }} />}
                                            <span style={{ fontSize: '13px', color: themeWiseColor('#262626', '#fff', themeMode) }}>{opt.name}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ); })}
                    </div>
                ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: themeWiseColor('#bfbfbf', '#555', themeMode) }}>No options found</div>
                )}
            </div>
          </div>
        )}
      />
    );
  };

  return (
    <div className="reporting-tasks-page" style={{ padding: '24px', backgroundColor: themeWiseColor('#ffffff', '#141414', themeMode), minHeight: '100vh', color: themeWiseColor('#262626', '#fff', themeMode) }}>
      {/* Header Row */}
      <Flex justify="space-between" align="center" style={{ marginBottom: '24px' }}>
        <Title level={4} style={{ color: themeWiseColor('#262626', '#fff', themeMode), margin: 0, fontWeight: 500, fontSize: '18px' }}>All Tasks ({total})</Title>
        <Space size={12}>
          <Checkbox 
            style={{ color: '#8c8c8c', fontSize: '13px' }}
            checked={params.includeArchived}
            onChange={(e) => setParams(p => ({ ...p, includeArchived: e.target.checked, index: 1 }))}
          >
            Include Archived
          </Checkbox>
          <Button ghost icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: '6px', backgroundColor: themeWiseColor('#fff', '#262626', themeMode), border: `1px solid ${themeWiseColor('#d9d9d9', 'transparent', themeMode)}`, color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px' }}>Refresh</Button>
          <Button ghost onClick={clearAllFilters} style={{ borderRadius: '6px', backgroundColor: themeWiseColor('#fff', '#262626', themeMode), border: `1px solid ${themeWiseColor('#d9d9d9', 'transparent', themeMode)}`, color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px' }}>Clear Filters</Button>
          
          <Dropdown dropdownRender={() => exportMenu} trigger={['click']}>
            <Button type="primary" style={{ backgroundColor: '#1677ff', borderRadius: '6px', fontWeight: 500 }}>
                <Space>
                    <ExportOutlined />
                    Export
                    <DownOutlined style={{ fontSize: '10px' }} />
                </Space>
            </Button>
          </Dropdown>
        </Space>
      </Flex>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {statCards.map((card, idx) => (
          <Col span={4} key={idx}>
            <Card 
              bodyStyle={{ padding: '20px' }} 
              style={{ backgroundColor: themeWiseColor('#fff', '#1d1d1d', themeMode), border: 'none', borderRadius: '8px' }}
            >
              <div style={{ color: themeWiseColor('#8c8c8c', '#8c8c8c', themeMode), fontSize: '12px', marginBottom: '12px', fontWeight: 500 }}>{card.title}</div>
              <div style={{ color: themeWiseColor('#262626', '#fff', themeMode), fontSize: '24px', fontWeight: 600 }}>{card.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Main Container */}
      <div style={{ backgroundColor: themeWiseColor('#fff', '#1d1d1d', themeMode), borderRadius: '8px', padding: '24px' }}>
        {/* Filter Bar */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={10}>
            <FilterSelect 
                placeholder="Teams" 
                options={filterOptions.teams} 
                value={params.teams} 
                onChange={(val) => setParams(p => ({ ...p, teams: val, index: 1 }))} 
            />
            <FilterSelect 
                placeholder="Projects" 
                options={filterOptions.projects} 
                value={params.projects} 
                onChange={(val) => setParams(p => ({ ...p, projects: val, index: 1 }))} 
                showSearch={true}
                showSelectAll={false}
            />
            <FilterSelect 
                placeholder="Status" 
                options={filterOptions.statuses} 
                value={params.statuses} 
                onChange={(val) => setParams(p => ({ ...p, statuses: val, index: 1 }))} 
                badgeMode={true}
                showSelectAll={false}
            />
            <FilterSelect 
                placeholder="Priority" 
                options={filterOptions.priorities} 
                value={params.priorities} 
                onChange={(val) => setParams(p => ({ ...p, priorities: val, index: 1 }))} 
                badgeMode={true}
                showSelectAll={false}
            />
            <FilterSelect 
                placeholder="Assignee" 
                options={filterOptions.project_managers} 
                value={params.project_managers} 
                onChange={(val) => setParams(p => ({ ...p, project_managers: val, index: 1 }))} 
                width={120}
                showSearch={true}
                includeUnassigned={true}
            />
          </Space>
          
          <Space size={16}>
            <Dropdown
                trigger={['click']}
                dropdownRender={() => (
                    <div style={{ backgroundColor: '#1d1d1d', border: '1px solid #333', borderRadius: '8px', padding: '4px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '180px' }}>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {allColumnDefs.map(col => {
                                const isTask = col.key === 'name';
                                return (
                                    <div 
                                        key={col.key} 
                                        className="custom-option-item"
                                        style={{ 
                                          opacity: isTask ? 0.5 : 1, 
                                          cursor: isTask ? 'not-allowed' : 'pointer'
                                        }}
                                        onClick={() => {
                                            if (isTask) return;
                                            const newVisible = visibleColumns.includes(col.key)
                                                ? visibleColumns.filter(c => c !== col.key)
                                                : [...visibleColumns, col.key];
                                            setVisibleColumns(newVisible);
                                        }}
                                    >
                                        <Checkbox 
                                            checked={visibleColumns.includes(col.key)} 
                                            disabled={isTask}
                                            className="premium-checkbox" 
                                        />
                                        <span style={{ marginLeft: '12px', color: isTask ? '#888' : '#fff', fontSize: '13px', fontWeight: 500 }}>{col.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            >
                <Button 
                    ghost 
                    style={{ borderRadius: '6px', borderColor: themeWiseColor('#d9d9d9', '#333', themeMode), color: themeWiseColor('#595959', '#bfbfbf', themeMode), fontSize: '13px', height: '32px', padding: '0 16px' }}
                >
                    Show Fields <DownOutlined style={{ fontSize: '10px' }} />
                </Button>
            </Dropdown>
            <Input 
              placeholder="Search by task name, key..." 
              value={params.search}
              prefix={<SearchOutlined style={{ color: '#666' }} />}
              style={{ width: 320, backgroundColor: themeWiseColor('#fafafa', '#141414', themeMode), border: `1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)}`, color: themeWiseColor('#262626', '#fff', themeMode), borderRadius: '4px', height: '32px', fontSize: '13px' }}
              className="premium-input"
              onChange={(e) => setParams(p => ({ ...p, search: e.target.value, index: 1 }))}
            />
          </Space>
        </div>

        {/* Table */}
        <div className="reporting-table-container">
          <Table
            dataSource={tableData}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
            expandable={{
                expandIcon: ({ expanded, onExpand, record }) => {
                    if (!record.children || record.children.length === 0) return <div style={{ width: 24 }} />;
                    return expanded ? (
                        <DownOutlined
                            style={{ fontSize: '12px', color: '#8c8c8c', marginRight: 12, cursor: 'pointer' }}
                            onClick={e => onExpand(record, e)}
                        />
                    ) : (
                        <RightOutlined
                            style={{ fontSize: '12px', color: '#8c8c8c', marginRight: 12, cursor: 'pointer' }}
                            onClick={e => onExpand(record, e)}
                        />
                    );
                },
                expandIconColumnIndex: 0,
                indentSize: 24
            }}
            pagination={{
              current: params.index,
              pageSize: params.size,
              total: total,
              showSizeChanger: true,
              className: 'dark-pagination',
              itemRender: (current, type, originalElement) => {
                if (type === 'prev') return <Text style={{ color: '#8c8c8c' }}>{'<'}</Text>;
                if (type === 'next') return <Text style={{ color: '#8c8c8c' }}>{'>'}</Text>;
                return originalElement;
              }
            }}
            className="dark-reporting-table"
          />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .dark-reporting-table .ant-table {
          background: transparent !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }
        /* Ultra-Dense Row Styles */
        .dark-reporting-table .ant-table-tbody > tr > td {
          padding-top: 2px !important;
          padding-bottom: 2px !important;
          height: 28px !important;
          font-size: 13px;
        }
        
        /* General Table Header Styles */
        .dark-reporting-table .ant-table-thead > tr > th {
          background: transparent !important;
          color: ${themeWiseColor('#8c8c8c', '#8c8c8c', themeMode)} !important;
          border-bottom: 2px solid ${themeWiseColor('#f0f0f0', '#262626', themeMode)} !important;
          font-size: 13px;
          font-weight: 600;
          height: 28px !important;
          padding: 4px 16px !important;
        }

        /* Sticky Column Styles */
        .ant-table-cell-fix-left,
        .ant-table-cell-fix-right {
          background: ${themeWiseColor('#ffffff', '#151515', themeMode)} !important;
          z-index: 2 !important;
          padding: 4px 16px !important;
        }
        .dark-reporting-table .ant-table-cell-fix-left-last {
          border-right: 1px solid ${themeWiseColor('#f0f0f0', '#333', themeMode)} !important;
          box-shadow: ${themeWiseColor('4px 0 8px rgba(0,0,0,0.05)', '4px 0 8px rgba(0,0,0,0.3)', themeMode)} !important;
        }
        
        /* Universal Padding for Data Columns */
        .dark-reporting-table .ant-table-tbody > tr > td:not(.ant-table-cell-fix-left) {
             padding-left: 16px !important;
        }
        .ant-table-cell-fix-left-last::after {
          box-shadow: ${themeWiseColor('inset 10px 0 12px -8px rgba(0, 0, 0, 0.05)', 'inset 10px 0 12px -8px rgba(0, 0, 0, 0.9)', themeMode)} !important;
        }
        .dark-reporting-table .ant-table-thead > tr > th.ant-table-cell-fix-left {
            background: ${themeWiseColor('#ffffff', '#151515', themeMode)} !important;
            border-bottom: 2px solid ${themeWiseColor('#f0f0f0', '#262626', themeMode)} !important;
        }

        .dark-reporting-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#262626', themeMode)} !important;
          padding: 8px 24px 8px 0 !important;
          font-size: 13px;
          height: 32px !important;
        }
        
        /* Unified Hover Effect across Row */
        .dark-reporting-table .ant-table-tbody > tr:hover > td {
          background: ${themeWiseColor('#fafafa', '#262626', themeMode)} !important;
        }
        .dark-reporting-table .ant-table-tbody > tr:hover > .ant-table-cell-fix-left,
        .dark-reporting-table .ant-table-tbody > tr:hover > .ant-table-cell-fix-right {
          background: ${themeWiseColor('#fafafa', '#262626', themeMode)} !important;
        }
        
        .premium-select .ant-select-selector {
          background-color: ${themeWiseColor('#ffffff', '#1f1f1f', themeMode)} !important;
          border: 1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)} !important;
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
          border-radius: 6px !important;
          font-size: 13px !important;
          height: 32px !important;
        }
        .premium-select .ant-select-selection-item {
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
          line-height: 30px !important;
          display: flex !important;
          align-items: center !important;
        }
        .premium-select .ant-select-selection-placeholder {
            color: ${themeWiseColor('#8c8c8c', '#fff', themeMode)} !important;
            opacity: 1 !important;
            line-height: 30px !important;
            display: flex !important;
            align-items: center !important;
        }
        .ant-select-selection-overflow-item {
            width: 100% !important;
        }

        .premium-dropdown {
          background-color: ${themeWiseColor('#ffffff', '#1f1f1f', themeMode)} !important;
          border: 1px solid ${themeWiseColor('#d9d9d9', '#333', themeMode)};
          border-radius: 8px;
        }
        .ant-select-dropdown {
            padding: 0 !important;
            background-color: transparent !important;
            box-shadow: none !important;
        }
        .ant-select-item-option-content {
            width: 100%;
        }
        .ant-select-item {
          color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
          padding: 8px 12px !important;
        }
        .ant-select-item-option-active {
          background-color: ${themeWiseColor('#f5f5f5', '#262626', themeMode)} !important;
        }
        .ant-select-item-option-selected {
            background-color: transparent !important;
        }
        
        .custom-option-item {
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background 0.2s;
        }
        .custom-option-item:hover {
          background: ${themeWiseColor('#f5f5f5', '#262626', themeMode)};
        }
        
        .premium-checkbox .ant-checkbox-inner {
          background-color: transparent !important;
          border-color: ${themeWiseColor('#d9d9d9', '#444', themeMode)} !important;
          width: 18px;
          height: 18px;
          border-radius: 4px;
        }
        
        .premium-checkbox.ant-checkbox-checked .ant-checkbox-inner,
        .premium-checkbox .ant-checkbox-checked .ant-checkbox-inner,
        .premium-checkbox.ant-checkbox-wrapper-checked .ant-checkbox-inner {
          background-color: #1890ff !important;
          border-color: #1890ff !important;
        }
        
        .premium-checkbox .ant-checkbox-inner::after {
            border-color: #fff !important;
            width: 5px;
            height: 9px;
        }
        /* Disable Task hover */
        .custom-option-item[style*="not-allowed"]:hover {
          background: transparent !important;
        }
        .ant-checkbox-wrapper {
            color: ${themeWiseColor('#262626', '#fff', themeMode)} !important;
        }

        .dark-input::placeholder {
          color: #8c8c8c;
        }
        .premium-input:focus {
          border-color: #1677ff !important;
          box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2) !important;
        }

        .dark-pagination {
          margin-top: 32px !important;
        }
        .dark-pagination .ant-pagination-item a {
          color: ${themeWiseColor('#595959', '#8c8c8c', themeMode)} !important;
        }
        .dark-pagination .ant-pagination-item-active {
          background: #1677ff !important;
          border-color: #1677ff !important;
        }
        .dark-pagination .ant-pagination-item-active a {
          color: #fff !important;
        }
        .ant-table-pagination-right {
          color: ${themeWiseColor('#8c8c8c', '#8c8c8c', themeMode)};
        }

        .ant-table-column-sorter {
          color: ${themeWiseColor('#d9d9d9', '#444', themeMode)} !important;
        }
        .ant-table-column-sorter-up.active, 
        .ant-table-column-sorter-down.active {
          color: #1677ff !important;
        }

        /* Custom Horizontal Scrollbar */
        .reporting-table-container .ant-table-body::-webkit-scrollbar,
        .reporting-table-container .ant-table-content::-webkit-scrollbar {
          height: 8px !important;
        }
        .reporting-table-container .ant-table-body::-webkit-scrollbar-track,
        .reporting-table-container .ant-table-content::-webkit-scrollbar-track {
          background: ${themeWiseColor('#f5f5f5', '#141414', themeMode)} !important;
          border-radius: 4px;
        }
        .reporting-table-container .ant-table-body::-webkit-scrollbar-thumb,
        .reporting-table-container .ant-table-content::-webkit-scrollbar-thumb {
          background: ${themeWiseColor('#d9d9d9', '#333', themeMode)} !important;
          border-radius: 4px;
        }
        .reporting-table-container .ant-table-body::-webkit-scrollbar-thumb:hover,
        .reporting-table-container .ant-table-content::-webkit-scrollbar-thumb:hover {
          background: ${themeWiseColor('#bfbfbf', '#444', themeMode)} !important;
        }

        /* Ensure horizontal scroll is enabled when many columns are visible */
        .dark-reporting-table .ant-table {
            overflow-x: auto !important;
        }
      `}} />
    </div>
  );
};

export default memo(TasksReports);
