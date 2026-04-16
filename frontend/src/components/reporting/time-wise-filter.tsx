import { CalendarOutlined, CheckOutlined, DownOutlined } from '@/shared/antd-imports';
import { Button, Card, DatePicker, Divider, Dropdown, Flex, List, Typography } from '@/shared/antd-imports';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { colors } from '@/styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { durations } from '@/shared/constants';
import { setDateRange, setDuration } from '@/features/reporting/reporting.slice';

const TimeWiseFilter = () => {
  const { t } = useTranslation('reporting-members');
  const { mode: themeMode } = useAppSelector(state => state.themeReducer);
  const dispatch = useAppDispatch();

  // Get values from Redux store
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>(
    durations.find(item => item.key === duration)?.label || 'lastSevenDaysText'
  );
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);

  // Format customRange for display
  const getDisplayLabel = () => {
    const f = 'MMM DD, YYYY';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    const selected = durations.find(item => item.key === duration);
    return selected ? t(selected.label) : t('lastSevenDaysText');
  };

  // Apply changes when date range is selected
  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates) {
      setCustomRange([dates[0].$d.toString(), dates[1].$d.toString()]);
    } else {
      setCustomRange(null);
    }
  };

  // Apply custom date filter
  const applyCustomDateFilter = () => {
    if (customRange) {
      setSelectedTimeFrame('customRange');
      setIsDropdownOpen(false);
      dispatch(setDateRange([customRange[0], customRange[1]]));
    }
  };

  // Handle duration item selection
  const handleDurationSelect = (item: any) => {
    setSelectedTimeFrame(item.label);
    setCustomRange(null);
    dispatch(setDuration(item.key));
    
    let start, end;
    if (item.key === 'YESTERDAY') {
      start = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      end = start;
    } else if (item.dates) {
      const parts = item.dates.split(' - ');
      start = dayjs(parts[0]).format('YYYY-MM-DD');
      end = dayjs(parts[1]).format('YYYY-MM-DD');
    } else {
      start = dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      end = dayjs().format('YYYY-MM-DD');
    }
    dispatch(setDateRange([start, end]));
    setIsDropdownOpen(false);
  };

  // custom dropdown content
  const timeWiseDropdownContent = (
    <Card
      className="custom-card"
      styles={{
        body: {
          padding: '12px 0 0 0',
          minWidth: 350,
        },
      }}
    >
      <div style={{ padding: '0 16px 8px 16px' }}>
        <Typography.Text strong style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          QUICK RANGES
        </Typography.Text>
      </div>

      <div style={{ maxHeight: 350, overflowY: 'auto', padding: '0 8px' }}>
        <List style={{ padding: 0 }}>
          {durations.map(item => {
            const isSelected = duration === item.key;
            return (
              <div 
                key={item.key}
                onClick={() => handleDurationSelect(item)}
                style={{
                  padding: '10px 12px',
                  border: isSelected ? '1px solid #1890ff' : '1px solid transparent',
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: 'pointer',
                  backgroundColor: isSelected ? (themeMode === 'dark' ? '#111b26' : '#e6f7ff') : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <CalendarOutlined style={{ color: isSelected ? '#1890ff' : '#8c8c8c', fontSize: 16 }} />
                
                <Flex align="center" style={{ flex: 1 }} gap={8}>
                  <Typography.Text style={{ 
                    color: isSelected ? '#1890ff' : 'inherit', 
                    fontWeight: isSelected ? 500 : 400,
                    marginRight: 'auto'
                  }}>
                    {t(item.label)}
                  </Typography.Text>
                  
                  {isSelected && <CheckOutlined style={{ color: '#1890ff', fontSize: 14 }} />}

                  {item.dates && (
                    <Flex vertical align="flex-end" style={{ minWidth: 80 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {item.key === 'YESTERDAY' 
                          ? dayjs().subtract(1, 'day').format('MMM DD')
                          : (dayjs(item.dates.split(' - ')[0]).format('MMM DD'))}
                      </Typography.Text>
                      {item.dates.includes(' - ') && (
                        <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: -4 }}>
                          {dayjs(item.dates.split(' - ')[1]).format('MMM DD, YYYY')}
                        </Typography.Text>
                      )}
                    </Flex>
                  )}
                </Flex>
              </div>
            );
          })}
        </List>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <Flex vertical gap={8} style={{ padding: '0 16px 16px 16px' }}>
        <Typography.Text style={{ fontSize: 12 }}>{t('customRangeText')}</Typography.Text>
        <DatePicker.RangePicker
          format={'MMM DD, YYYY'}
          style={{ width: '100%' }}
          onChange={handleDateRangeChange}
          value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
        />
        <Button
          type="primary"
          size="small"
          style={{ alignSelf: 'flex-end', marginTop: 4 }}
          onClick={applyCustomDateFilter}
          disabled={!customRange}
        >
          {t('filterButton')}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      popupRender={() => timeWiseDropdownContent}
      onOpenChange={open => setIsDropdownOpen(open)}
      open={isDropdownOpen}
    >
      <Button
        className={`transition-all duration-300 ${isDropdownOpen ? 'border-[#1890ff] text-[#1890ff]' : ''}`}
        style={{
          height: 38,
          borderColor: isDropdownOpen || selectedTimeFrame ? '#1890ff' : undefined,
          color: isDropdownOpen || selectedTimeFrame ? '#1890ff' : undefined,
        }}
      >
        <Flex align="center" gap={8}>
          <CalendarOutlined style={{ color: '#1890ff' }} />
          <span>{getDisplayLabel()}</span>
          <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default TimeWiseFilter;
