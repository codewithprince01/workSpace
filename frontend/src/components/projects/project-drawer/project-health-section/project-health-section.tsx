import { TFunction } from 'i18next';
import { Badge, Form, FormInstance, Select, Typography } from '@/shared/antd-imports';

interface ProjectHealthSectionProps {
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectHealthSection = ({ form, t, disabled }: ProjectHealthSectionProps) => {
  const healthOptions = [
    { value: 'not_set', name: 'Not Set', color_code: '#a3a3a3' },
    { value: 'needs_attention', name: 'Needs Attention', color_code: '#f4c542' },
    { value: 'at_risk', name: 'At Risk', color_code: '#ff6b6b' },
    { value: 'good', name: 'Good', color_code: '#73d39a' },
  ].map((status, index) => ({
    key: index,
    value: status.value,
    label: (
      <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Badge color={status.color_code} /> {status.name}
      </Typography.Text>
    ),
  }));

  return (
    <Form.Item name="health" label={t('health')}>
      <Select
        options={healthOptions}
        onChange={value => form.setFieldValue('health', value)}
        disabled={disabled}
      />
    </Form.Item>
  );
};

export default ProjectHealthSection;
