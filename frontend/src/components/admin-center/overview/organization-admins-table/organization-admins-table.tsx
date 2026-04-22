import { Table, TableProps, Typography } from '@/shared/antd-imports';
import React, { useMemo } from 'react';
import { IOrganizationAdmin } from '@/types/admin-center/admin-center.types';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface OrganizationAdminsTableProps {
  organizationAdmins: IOrganizationAdmin[] | null;
  loading: boolean;
  themeMode: string;
}

const { Text } = Typography;

const OrganizationAdminsTable: React.FC<OrganizationAdminsTableProps> = ({
  organizationAdmins,
  loading,
  themeMode,
}) => {
  const columns = useMemo<TableProps<IOrganizationAdmin>['columns']>(
    () => [
      {
        title: <Text strong style={{ color: themeWiseColor('#262626', '#fff', themeMode) }}>Name</Text>,
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <div style={{ padding: '8px 0' }}>
            <Text style={{ color: themeWiseColor('#262626', '#fafafa', themeMode), fontWeight: 500 }}>
              {text}
              {record.is_owner && <Text style={{ color: '#1890ff', marginLeft: 8 }}>(Owner)</Text>}
            </Text>
          </div>
        ),
      },
      {
        title: <Text strong style={{ color: themeWiseColor('#262626', '#fff', themeMode) }}>Email</Text>,
        dataIndex: 'email',
        key: 'email',
        render: text => <Text style={{ color: themeWiseColor('#595959', '#bfbfbf', themeMode) }}>{text}</Text>,
      },
    ],
    [themeMode]
  );

  return (
    <>
      <Table<IOrganizationAdmin>
        className="organization-admins-table"
        columns={columns}
        dataSource={organizationAdmins || []}
        loading={loading}
        showHeader={false}
        pagination={{
          size: 'small',
          pageSize: 10,
          hideOnSinglePage: true,
        }}
        rowKey="email"
        style={{ backgroundColor: 'transparent' }}
      />
      <style>{`
        .organization-admins-table .ant-table {
          background: transparent !important;
        }
        .organization-admins-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${themeWiseColor('#f0f0f0', '#303030', themeMode)} !important;
          padding: 12px 24px !important;
        }
        .organization-admins-table .ant-table-tbody > tr:last-child > td {
          border-bottom: none !important;
        }
        .organization-admins-table .ant-table-tbody > tr:hover > td {
          background-color: ${themeWiseColor('rgba(0,0,0,0.02)', 'rgba(255,255,255,0.02)', themeMode)} !important;
        }
      `}</style>
    </>
  );
};

export default OrganizationAdminsTable;
