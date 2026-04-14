const express = require('express');
const router = express.Router();
const { auth } = require('../controllers');
const { authValidators } = require('../middlewares/validation.middleware');

// Public routes
router.post('/signup', authValidators.signup, auth.signup);
router.post('/login', authValidators.login, auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password/:token', auth.resetPassword);
router.get('/verify', auth.verify);

// Legacy route support
router.post('/signup/check', (req, res) => {
  res.json({ done: true, message: 'Validation passed' });
});

// Protected routes
const { protect } = require('../middlewares/auth.middleware');
router.get('/logout', protect, auth.logout);
router.get('/me', protect, auth.getMe);
router.put('/password', protect, auth.updatePassword);

module.exports = router;
