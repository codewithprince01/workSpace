import { PageHeader } from '@ant-design/pro-components';
import { Tabs, TabsProps } from '@/shared/antd-imports';
import React, { useMemo } from 'react';
import CurrentBill from '@/components/admin-center/billing/current-bill';
import Configuration from '@/components/admin-center/configuration/configuration';
import { useTranslation } from 'react-i18next';

const Billing: React.FC = React.memo(() => {
  const { t } = useTranslation('admin-center/current-bill');

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: '1',
        label: t('currentBill'),
        children: <CurrentBill />,
      },
      {
        key: '2',
        label: t('configuration'),
        children: <Configuration />,
      },
    ],
    [t]
  );

  const pageHeaderStyle = useMemo(() => ({ padding: '16px 0' }), []);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#000000', padding: '24px' }}>
      <PageHeader title={<span style={{ color: '#fafafa', fontSize: '24px', fontWeight: 600 }}>{t('title')}</span>} style={pageHeaderStyle} />
      <Tabs defaultActiveKey="1" items={items} destroyOnHidden />
      <style>{`
        .ant-card {
            background-color: #141414 !important;
            border-color: #303030 !important;
        }
        .ant-tabs-tab {
            color: #8c8c8c !important;
        }
        .ant-tabs-tab-active .ant-tabs-tab-btn {
            color: #fafafa !important;
        }
        .ant-tabs-ink-bar {
            background: #fafafa !important;
        }
        .ant-card-head {
            border-bottom-color: #303030 !important;
            color: #fafafa !important;
        }
        .ant-table {
            background: transparent !important;
        }
        .ant-typography {
            color: #bfbfbf !important;
        }
      `}</style>
    </div>
  );
});

Billing.displayName = 'Billing';

export default Billing;
