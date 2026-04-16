import { Typography, Flex } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

type EstimatedVsActualCellProps = {
  actualTime: number | null;
  actualTimeString: string | null;
  estimatedTime: number | null;
  estimatedTimeString: string | null;
};

const EstimatedVsActualCell = ({
  actualTime,
  actualTimeString,
  estimatedTime,
  estimatedTimeString,
}: EstimatedVsActualCellProps) => {
  const { t } = useTranslation('reporting-projects');

  if (!actualTime && !estimatedTime) {
      return <Typography.Text style={{ color: '#555' }}>-</Typography.Text>;
  }

  // Calculate percentage for a progress bar if needed, 
  // but the user wants "Estimated: 12h 12m Actual: 0h 2m" design.
  
  return (
    <Flex vertical gap={2} style={{ width: '100%' }}>
      <div 
        style={{ 
            backgroundColor: '#7c83da', 
            padding: '2px 10px', 
            borderRadius: '4px', 
            width: 'fit-content',
            marginBottom: '2px'
        }}
      >
        <Typography.Text style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
          {t('estimatedText')}: {estimatedTimeString || '0h'}
        </Typography.Text>
      </div>
      <div 
        style={{ 
            paddingLeft: '10px', 
            borderLeft: '2px solid rgba(193, 145, 204, 0.5)',
            display: 'flex',
            alignItems: 'center',
            height: '20px'
        }}
      >
        <Typography.Text style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
          {t('actualText')}: {actualTimeString || '0h'}
        </Typography.Text>
      </div>
    </Flex>
  );
};

export default EstimatedVsActualCell;
