import React from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { Label } from '@/types/task-management.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';

interface CustomColordLabelProps {
  label: Label | ITaskLabel;
  isDarkMode?: boolean;
}

const CustomColordLabel = React.forwardRef<HTMLSpanElement, CustomColordLabelProps>(
  ({ label, isDarkMode = false }, ref) => {
    const name = label.name || '';
    const truncatedName = name.length > 12 ? `${name.substring(0, 12)}...` : name;

    // Handle different color property names for different types
    const backgroundColor = (label as Label).color || (label as ITaskLabel).color_code || '#6b7280';
    
    // Function to determine if we should use white or black text based on background color
    const getTextColor = (bgColor: string): string => {
      try {
        const color = bgColor.startsWith('#') ? bgColor.replace('#', '') : bgColor;
        if (color.length !== 6) return '#ffffff';
        
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
      } catch (e) {
        return '#ffffff';
      }
    };

    const textColor = getTextColor(backgroundColor);

    return (
      <Tooltip title={name}>
        <span
          ref={ref}
          className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shrink-0 transition-all duration-200 hover:opacity-90"
          style={{ 
            backgroundColor,
            color: textColor,
            border: `1px solid ${backgroundColor}`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            marginRight: '4px',
            cursor: 'default',
            userSelect: 'none'
          }}
        >
          <span className="truncate">{truncatedName}</span>
        </span>
      </Tooltip>
    );
  }
);

CustomColordLabel.displayName = 'CustomColordLabel';

export default CustomColordLabel;
