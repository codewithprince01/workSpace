import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Space,
  Table,
  TableProps,
  Typography,
  message,
  SearchOutlined,
  DeleteOutlined,
  InboxOutlined,
  RollbackOutlined,
  Divider,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import PinRouteToNavbarButton from '@/components/PinRouteToNavbarButton';
import logger from '@/utils/errorLogger';
import { TrashTask, trashApiService } from '@/api/tasks/trash.api.service';

const TrashSettings = () => {
  const { t } = useTranslation('settings/sidebar');
  useDocumentTitle('Trash');

  const [rows, setRows] = useState<TrashTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const loadTrash = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const response = await trashApiService.getTrashTasks(query);
      if (response.done) {
        setRows(response.body || []);
      }
    } catch (error) {
      logger.error('Failed to load trash tasks', error);
      message.error('Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const dataSource = useMemo(
    () =>
      rows.map(item => ({
        ...item,
        id: String(item.id || item._id || ''),
      })),
    [rows]
  );

  const selectedIds = selectedRowKeys.map(String);

  const handleRestore = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      try {
        setLoading(true);
        const response = await trashApiService.restoreTasks(ids);
        if (response.done) {
          message.success('Task restored successfully');
          setSelectedRowKeys([]);
          await loadTrash(searchQuery);
        }
      } catch (error) {
        logger.error('Failed to restore tasks', error);
        message.error('Failed to restore task');
      } finally {
        setLoading(false);
      }
    },
    [loadTrash, searchQuery]
  );

  const handlePermanentDelete = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      try {
        setLoading(true);
        const response = await trashApiService.permanentlyDeleteTasks(ids);
        if (response.done) {
          message.success('Task permanently deleted');
          setSelectedRowKeys([]);
          await loadTrash(searchQuery);
        }
      } catch (error) {
        logger.error('Failed to permanently delete tasks', error);
        message.error('Failed to permanently delete task');
      } finally {
        setLoading(false);
      }
    },
    [loadTrash, searchQuery]
  );

  const columns: TableProps<any>['columns'] = [
    {
      title: 'Task Key',
      dataIndex: 'task_key',
      key: 'task_key',
      width: 140,
      render: (value: string) => <Typography.Text>{value || '-'}</Typography.Text>,
    },
    {
      title: 'Task',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Typography.Text>{value || '-'}</Typography.Text>,
    },
    {
      title: 'Project',
      key: 'project',
      dataIndex: 'project_id',
      width: 220,
      render: (value: any) => (
        <Typography.Text>{typeof value === 'object' ? value?.name || '-' : '-'}</Typography.Text>
      ),
    },
    {
      title: 'Deleted On',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 200,
      render: (value: string) => (
        <Typography.Text>{value ? new Date(value).toLocaleString() : '-'}</Typography.Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => handleRestore([record.id])}
          >
            Restore
          </Button>
          <Popconfirm
            title="Permanently delete this task?"
            description="This action cannot be undone."
            onConfirm={() => handlePermanentDelete([record.id])}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      styles={{ head: { padding: '12px 24px' }, body: { padding: 0 } }}
      title={
        <Space size="middle">
          <Flex
            align="center"
            justify="center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(24, 144, 255, 0.1)',
              color: '#1890ff',
            }}
          >
            <InboxOutlined style={{ fontSize: 18 }} />
          </Flex>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Task Trash
          </Typography.Title>
        </Space>
      }
      extra={
        <Flex gap="middle" align="center">
          <Space.Compact style={{ width: 300 }}>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onPressEnter={() => loadTrash(searchQuery)}
              placeholder="Search trash tasks..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              allowClear
            />
            <Button type="primary" onClick={() => loadTrash(searchQuery)}>
              Search
            </Button>
          </Space.Compact>

          <Divider type="vertical" style={{ height: 24, margin: '0 4px' }} />

          <Space size="small">
            <Button
              disabled={!selectedIds.length}
              icon={<RollbackOutlined />}
              onClick={() => handleRestore(selectedIds)}
              className={selectedIds.length ? 'restore-btn-active' : ''}
              style={{
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              Restore {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>

            <Popconfirm
              title="Permanently delete tasks?"
              description={`Are you sure you want to permanently delete ${selectedIds.length > 1 ? 'these tasks' : 'this task'}? This action cannot be undone.`}
              onConfirm={() => handlePermanentDelete(selectedIds)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              disabled={!selectedIds.length}
            >
              <Button
                danger
                disabled={!selectedIds.length}
                icon={<DeleteOutlined />}
                style={{ borderRadius: 6 }}
              >
                Delete
              </Button>
            </Popconfirm>
          </Space>

          <Divider type="vertical" style={{ height: 24, margin: '0 4px' }} />

          <PinRouteToNavbarButton name="trash" path="/worklenz/settings/trash" />
        </Flex>
      }
    >
      <Table
        rowKey="id"
        dataSource={dataSource}
        columns={columns}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: keys => setSelectedRowKeys(keys),
        }}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: 20,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
      />
    </Card>
  );
};

export default TrashSettings;
