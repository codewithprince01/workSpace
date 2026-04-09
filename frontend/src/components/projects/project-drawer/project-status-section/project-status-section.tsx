import { Form, FormInstance, Select } from '@/shared/antd-imports';
import { TFunction } from 'i18next';

interface ProjectStatusSectionProps {
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectStatusSection = ({ form, t, disabled }: ProjectStatusSectionProps) => {
  const statusOptions = [
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'proposed', label: 'Proposed' },
    { value: 'in_planning', label: 'In Planning' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <Form.Item name="status" label={t('status')}>
      <Select
        options={statusOptions}
        onChange={value => form.setFieldValue('status', value)}
        placeholder={t('selectStatus')}
        disabled={disabled}
      />
    </Form.Item>
  );
};

export default ProjectStatusSection;
