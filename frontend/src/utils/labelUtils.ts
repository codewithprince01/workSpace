import { ITaskLabel } from '@/types/tasks/taskLabel.types';

export const getNormalizedLabelId = (label?: string | ITaskLabel | Record<string, any>): string => {
  if (!label) return '';
  if (typeof label === 'string') return label;
  const rawId = (label as any).id || (label as any).label_id || (label as any)._id || (label as any).value || '';
  return String(rawId);
};

/**
 * Sorts labels to show selected labels first
 * @param labels - All available labels
 * @param selectedLabels - Currently selected labels
 * @returns Sorted array with selected labels first
 */
export const sortLabelsBySelection = (
  labels: ITaskLabel[],
  selectedLabels: ITaskLabel[]
): ITaskLabel[] => {
  const selectedIds = new Set((selectedLabels || []).map(label => getNormalizedLabelId(label)));

  return [...labels].sort((a, b) => {
    const aSelected = selectedIds.has(getNormalizedLabelId(a));
    const bSelected = selectedIds.has(getNormalizedLabelId(b));

    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });
};

/**
 * Checks if a label is selected
 * @param labelId - ID of the label to check
 * @param selectedLabels - Currently selected labels
 * @returns true if label is selected
 */
export const isLabelSelected = (
  labelId: string,
  selectedLabels?: ITaskLabel[]
): boolean => {
  if (!selectedLabels || selectedLabels.length === 0) return false;
  const normalizedLabelId = String(labelId || '');
  return selectedLabels.some(label => getNormalizedLabelId(label) === normalizedLabelId);
};
