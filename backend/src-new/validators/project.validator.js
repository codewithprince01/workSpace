/**
 * Project Input Validators
 */

/**
 * Validate project creation request
 */
exports.validateCreateProject = (req, res, next) => {
  const { name } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    errors.push('Project name is required');
  }
  if (name && name.trim().length > 200) {
    errors.push('Project name cannot exceed 200 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ done: false, message: errors[0], errors });
  }

  req.body.name = name.trim();
  next();
};

/**
 * Validate project update request
 */
exports.validateUpdateProject = (req, res, next) => {
  const { name } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ done: false, message: 'Project name cannot be empty' });
    }
    if (name.trim().length > 200) {
      return res.status(400).json({ done: false, message: 'Project name cannot exceed 200 characters' });
    }
    req.body.name = name.trim();
  }

  next();
};

/**
 * Validate project invitation
 */
exports.validateInvite = (req, res, next) => {
  const { email, role } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  const validRoles = ['owner', 'admin', 'member', 'viewer'];
  if (role && !validRoles.includes(role)) {
    errors.push(`Role must be one of: ${validRoles.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ done: false, message: errors[0], errors });
  }

  req.body.email = email.trim().toLowerCase();
  next();
};
