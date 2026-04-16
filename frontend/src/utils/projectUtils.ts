import { PROJECT_STATUS_ICON_MAP } from '@/shared/constants';
import React from 'react';
import { InfoCircleOutlined } from '@/shared/antd-imports';

export function getStatusIcon(statusIcon: string, colorCode: string) {
  const IconComponent = PROJECT_STATUS_ICON_MAP[statusIcon as keyof typeof PROJECT_STATUS_ICON_MAP];
  
  if (!IconComponent) {
    return React.createElement(InfoCircleOutlined, {
      style: { fontSize: 16, color: colorCode },
    });
  }

  return React.createElement(
    IconComponent,
    {
      style: { fontSize: 16, color: colorCode },
    }
  );
}
