/**
 * Task Input Validators
 */

/**
 * Validate task creation request
 */
exports.validateCreateTask = (req, res, next) => {
  const { name, project_id } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    errors.push('Task name is required');
  }
  if (name && name.trim().length > 500) {
    errors.push('Task name cannot exceed 500 characters');
  }

  if (!project_id) {
    errors.push('Project ID is required');
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (req.body.priority && !validPriorities.includes(req.body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ done: false, message: errors[0], errors });
  }

  req.body.name = name.trim();
  next();
};

/**
 * Validate task update request
 */
exports.validateUpdateTask = (req, res, next) => {
  const { name, priority } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ done: false, message: 'Task name cannot be empty' });
    }
    if (name.trim().length > 500) {
      return res.status(400).json({ done: false, message: 'Task name cannot exceed 500 characters' });
    }
    req.body.name = name.trim();
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority !== undefined && !validPriorities.includes(priority)) {
    return res.status(400).json({
      done: false,
      message: `Priority must be one of: ${validPriorities.join(', ')}`
    });
  }

  next();
};

/**
 * Validate bulk status update
 */
exports.validateBulkUpdate = (req, res, next) => {
  const { tasks, status_id } = req.body;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ done: false, message: 'Tasks array is required and must not be empty' });
  }

  if (tasks.length > 500) {
    return res.status(400).json({ done: false, message: 'Cannot update more than 500 tasks at once' });
  }

  next();
};
