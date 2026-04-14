import { LeftCircleOutlined, RightCircleOutlined } from '@/shared/antd-imports';
import React from 'react';
import { colors } from '@/styles/colors';
import { Button, Flex } from '@/shared/antd-imports';
import { themeWiseColor } from '@utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';

const ReportingCollapsedButton = ({
  isCollapsed,
  handleCollapseToggler,
}: {
  isCollapsed: boolean;
  handleCollapseToggler: () => void;
}) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Flex
      align="center"
      justify="end"
      style={{
        marginBlockStart: 76,
        marginBlockEnd: 24,
        maxWidth: 160,
        height: 40,
      }}
    >
      <Button
        className="borderless-icon-btn"
        style={{
          background: themeWiseColor(colors.white, colors.darkGray, themeMode),
          boxShadow: 'none',
          padding: 0,
          zIndex: 120,
          transform: 'translateX(50%)',
        }}
        onClick={() => handleCollapseToggler()}
        icon={
          isCollapsed ? (
            <RightCircleOutlined
              style={{
                fontSize: 22,
                color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
              }}
            />
          ) : (
            <LeftCircleOutlined
              style={{
                fontSize: 22,
                color: themeWiseColor('#c5c5c5', colors.lightGray, themeMode),
              }}
            />
          )
        }
      />
    </Flex>
  );
};

export default ReportingCollapsedButton;
