const { Task, Project } = require('../models');

const normalizePrefix = (value) => {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return cleaned || 'TASK';
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generate a unique task key for a project in format: PREFIX-<number>
 * Example: EM-1, EM-2, EM-3
 */
const generateTaskKeyForProject = async (projectId) => {
  const project = await Project.findById(projectId).select('key').lean();
  const prefix = normalizePrefix(project?.key);
  // Support both old format (EM-1) and new format (EM1) while computing next number.
  const prefixRegex = new RegExp(`^${escapeRegex(prefix)}-?(\\d+)$`);

  const existing = await Task.find({
    project_id: projectId,
    task_key: { $regex: new RegExp(`^${escapeRegex(prefix)}-?\\d+$`) },
  })
    .select('task_key')
    .lean();

  let maxNumber = 0;
  for (const row of existing) {
    const match = String(row?.task_key || '').match(prefixRegex);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (!Number.isNaN(n) && n > maxNumber) maxNumber = n;
    }
  }

  let nextNumber = maxNumber + 1;
  let candidate = `${prefix}-${nextNumber}`;
  // Safety loop to avoid accidental collision.
  while (
    await Task.exists({
      project_id: projectId,
      task_key: { $in: [candidate, `${prefix}${nextNumber}`] },
    })
  ) {
    nextNumber += 1;
    candidate = `${prefix}-${nextNumber}`;
  }

  return candidate;
};

module.exports = {
  generateTaskKeyForProject,
};
