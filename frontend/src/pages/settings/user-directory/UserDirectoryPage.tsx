import React, { useState, useEffect, useCallback } from 'react';
import {
  Button, Form, Input, Modal, Table, Tag, Typography, Upload, Space,
  Popconfirm, Tooltip, Badge, Divider, Card, Row, Col, Statistic, theme
} from 'antd';
import {
  UserAddOutlined, UploadOutlined, DeleteOutlined, SearchOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, TeamOutlined, DownloadOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { userDirectoryApiService, IProvisionedUser } from '@/api/super-admin/user-directory.api.service';
import Avatar from '@/components/Avatar';

const { Title, Text } = Typography;
const { Search } = Input;
const { useToken } = theme;

// ── Sample CSV template download ───────────────────────────────────────────
const downloadTemplate = () => {
  const csv = 'Name,Email,Department\nJohn Doe,john@example.com,Engineering\nJane Smith,jane@example.com,Sales\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'user_directory_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

const UserDirectoryPage: React.FC = () => {
  const { token } = useToken();
  const isDark = token.colorBgBase === '#000' || token.colorBgContainer < '#888888';

  const [users,   setUsers]   = useState<IProvisionedUser[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');

  const [addOpen,    setAddOpen]    = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm]                   = Form.useForm();

  const [bulkResult,  setBulkResult]  = useState<{ created: any[]; skipped: string[]; errors: any[] } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Fetch list ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const res = await userDirectoryApiService.list(p, 20, s);
      const data = res.data;                       // ← axios wraps in .data
      if (data?.done) {
        setUsers(data.body || []);
        setTotal(data.total || 0);
      }
    } catch {
      // error already shown by API client interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(1, ''); }, [fetchUsers]);

  // ── Manual add ──────────────────────────────────────────────────────────
  const handleAddUser = async (values: { name: string; email: string; department?: string }) => {
    setAddLoading(true);
    try {
      const res = await userDirectoryApiService.createUser(values.name, values.email, values.department || '');
      if (res.data?.done) {
        addForm.resetFields();
        setAddOpen(false);
        fetchUsers(1, search);
      }
    } catch { /* handled by interceptor */ }
    finally { setAddLoading(false); }
  };

  // ── Bulk upload ─────────────────────────────────────────────────────────
  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      setBulkLoading(true);
      try {
        const res = await userDirectoryApiService.bulkUpload(file);
        if (res.data?.done) {
          setBulkResult(res.data.body);
          fetchUsers(1, search);
        }
      } catch { /* handled by interceptor */ }
      finally { setBulkLoading(false); }
      return false;
    },
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await userDirectoryApiService.deleteUser(id);
      if (res.data?.done) fetchUsers(page, search);
    } catch { /* handled by interceptor */ }
  };

  // ── Theme-aware colours ─────────────────────────────────────────────────
  const infoBg     = isDark ? 'rgba(99,102,241,0.15)' : '#f0f5ff';
  const infoBorder = isDark ? 'rgba(99,102,241,0.4)'  : '#adc6ff';
  const infoText   = isDark ? token.colorTextSecondary : undefined;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: ColumnsType<IProvisionedUser> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, row) => (
        <Space>
          <Avatar
            name={name || ''}
            size={32}
            isDarkMode={isDark}
            style={{ flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 500, color: token.colorText }}>{name}</div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.department || '—'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (email) => <Text copyable style={{ fontSize: 13 }}>{email}</Text>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      render: (d) => d ? <Tag color="purple">{d}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (active) => active
        ? <Badge status="success" text="Active" />
        : <Badge status="default" text="Inactive" />,
    },
    {
      title: 'Source',
      dataIndex: 'provisioned',
      render: (p) => p
        ? <Tag color="geekblue">Provisioned</Tag>
        : <Tag>Self-signup</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, row) => (
        <Popconfirm title="Remove this user?" onConfirm={() => handleDelete(row.id)} okText="Remove" okType="danger">
          <Tooltip title="Remove user">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  const provisioned = users.filter(u => u.provisioned).length;

  return (
    <div style={{ padding: '24px 0', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: token.colorText }}>User Directory</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Create users manually or via Excel. All users get a default password and can log in immediately.
          </Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>CSV Template</Button>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={bulkLoading}>Bulk Upload</Button>
          </Upload>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAddOpen(true)}>
            Add User
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 12 }}>Total Users</Text>}
              value={total} prefix={<TeamOutlined style={{ color: '#6366f1' }} />}
              valueStyle={{ color: token.colorText, fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 12 }}>Provisioned</Text>}
              value={provisioned} prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: token.colorText, fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Search
        placeholder="Search by name, email or department…"
        allowClear
        style={{ marginBottom: 12, maxWidth: 400 }}
        onSearch={(v) => { setSearch(v); fetchUsers(1, v); }}
        prefix={<SearchOutlined />}
      />

      {/* Default password info banner */}
      <div style={{
        background: infoBg, border: `1px solid ${infoBorder}`,
        borderRadius: 8, padding: '8px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <ExclamationCircleOutlined style={{ color: '#6366f1' }} />
        <Text style={{ fontSize: 13, color: infoText }}>
          All provisioned users get default password: <Text code>Britannica@1234</Text> — they can reset it via Forgot Password.
        </Text>
      </div>

      {/* Table */}
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          total, pageSize: 20, current: page,
          onChange: (p) => { setPage(p); fetchUsers(p, search); }
        }}
        style={{ borderRadius: 10, overflow: 'hidden' }}
        locale={{ emptyText: 'No users yet — click "Add User" or upload an Excel file' }}
      />

      {/* ── Add User Modal ──────────────────────────────────────────────── */}
      <Modal
        title={<Space><UserAddOutlined /><span>Add User Manually</span></Space>}
        open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields(); }}
        onOk={() => addForm.submit()}
        okText="Create User"
        confirmLoading={addLoading}
        destroyOnClose
        width={440}
      >
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Account is created immediately with default password <Text code>Britannica@1234</Text>.
        </Text>
        <Form form={addForm} layout="vertical" onFinish={handleAddUser}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Rahul Sharma" autoFocus />
          </Form.Item>
          <Form.Item name="email" label="Email Address"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="rahul@britannica.com" />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Input placeholder="e.g. Engineering, HR, Sales…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Bulk Result Modal ───────────────────────────────────────────── */}
      <Modal
        title="Bulk Upload Results"
        open={!!bulkResult}
        onCancel={() => setBulkResult(null)}
        footer={<Button type="primary" onClick={() => setBulkResult(null)}>Done</Button>}
        width={520}
      >
        {bulkResult && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Tag color="green" style={{ padding: '4px 12px', fontSize: 13 }}>✅ {bulkResult.created.length} Created</Tag>
              <Tag color="orange" style={{ padding: '4px 12px', fontSize: 13 }}>⏭ {bulkResult.skipped.length} Skipped</Tag>
              <Tag color="red" style={{ padding: '4px 12px', fontSize: 13 }}>❌ {bulkResult.errors.length} Errors</Tag>
            </div>
            {bulkResult.errors.length > 0 && (
              <div style={{
                background: isDark ? 'rgba(255,77,79,0.1)' : '#fff2f0',
                border: `1px solid ${isDark ? 'rgba(255,77,79,0.3)' : '#ffccc7'}`,
                borderRadius: 8, padding: 12
              }}>
                <Text strong style={{ color: token.colorError }}>Errors:</Text>
                {bulkResult.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, marginTop: 4, color: token.colorText }}>
                    <Text type="danger">{e.reason}</Text> — {JSON.stringify(e.row)}
                  </div>
                ))}
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default UserDirectoryPage;
