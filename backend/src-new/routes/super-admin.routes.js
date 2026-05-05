const express = require('express');
const router = express.Router();
const multer = require('multer');
const superAdmin = require('../controllers/super-admin.controller');
const userDirectory = require('../controllers/user-directory.controller');
const { protect, superAdminOnly } = require('../middlewares/auth.middleware');

// All routes here require: authenticated + super_admin role
router.use(protect, superAdminOnly);

// Context
router.get('/context', superAdmin.getContext);

// Org switching
router.get('/teams', superAdmin.getAllTeams);
router.post('/switch-org', superAdmin.switchOrg);
router.post('/exit-org', superAdmin.exitOrg);

// View/Manage mode toggle
router.post('/toggle-mode', superAdmin.toggleMode);

// User management (existing)
router.get('/users', superAdmin.getAllUsers);
router.put('/users/:userId/role', superAdmin.updateUserRole);

// Audit logs
router.get('/audit-logs', superAdmin.getAuditLogs);

// Global Projects Module
router.get('/projects', superAdmin.getAllProjects);
router.get('/projects/:projectId/tasks', superAdmin.getProjectTasks);

// ── User Directory ──────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls') ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

router.get('/user-directory',             userDirectory.listUsers);
router.get('/user-directory/search',      userDirectory.searchUsers);
router.post('/user-directory/single',     userDirectory.createUser);
router.post('/user-directory/bulk',       upload.single('file'), userDirectory.bulkUpload);
router.delete('/user-directory/:userId',  userDirectory.deleteUser);

module.exports = router;
