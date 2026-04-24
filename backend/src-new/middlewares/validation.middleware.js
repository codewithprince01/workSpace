const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation result handler
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      done: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Auth validators #####
 */
const authValidators = {
  signup: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail({ gmail_remove_dots: false }),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    validate
  ],
  
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format'),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate
  ]
};

/**
 * Project validators
 */
const projectValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Project name is required')
      .isLength({ max: 200 }).withMessage('Project name cannot exceed 200 characters'),
    body('key')
      .optional()
      .trim()
      .isLength({ max: 10 }).withMessage('Project key cannot exceed 10 characters'),
    validate
  ],
  
  update: [
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Project name cannot exceed 200 characters'),
    validate
  ]
};

/**
 * Task validators
 */
const taskValidators = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('Task name is required')
      .isLength({ max: 500 }).withMessage('Task name cannot exceed 500 characters'),
    body('project_id')
      .notEmpty().withMessage('Project ID is required')
      .isMongoId().withMessage('Invalid project ID'),
    body('status_id')
      .optional()
      .isMongoId().withMessage('Invalid status ID'),
    validate
  ],
  
  update: [
    param('id').isMongoId().withMessage('Invalid task ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Task name cannot exceed 500 characters'),
    validate
  ]
};

/**
 * Common validators
 */
const commonValidators = {
  mongoIdParam: (paramName) => [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
    validate
  ],

  mongoId: [
    param('id').isMongoId().withMessage('Invalid ID'),
    validate
  ],
  
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ]
};

module.exports = {
  validate,
  authValidators,
  projectValidators,
  taskValidators,
  commonValidators
};
