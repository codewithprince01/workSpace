const jwt = require('jsonwebtoken');
const { User, Team, TeamMember } = require('../models');
const constants = require('../config/constants');
const mongoose = require('mongoose');
const emailService = require('../services/email.service');

/**
 * Check if database is connected
 */
const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1; // 1 = connected
};

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, constants.JWT_SECRET, {
    expiresIn: constants.JWT_EXPIRES_IN
  });
};

/**
 * Send token response
 */
const sendTokenResponse = async (user, statusCode, res, message = null) => {
  const token = generateToken(user._id);
  
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/'
  };

  let teamLogoUrl = null;
  if (user.last_team_id) {
    const team = await Team.findById(user.last_team_id);
    if (team) teamLogoUrl = team.logo_url;
  }
  
  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      authenticated: true,
      message,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          is_admin: user.owner || user.is_admin || false,
          role: user.role || 'user',
          is_super_admin: user.role === 'super_admin',
          owner: user.owner || false,
          team_id: user.last_team_id,
          team_logo_url: teamLogoUrl,
          setup_completed: user.setup_completed || false,
          super_admin_active_team: user.super_admin_active_team || null,
          super_admin_manage_mode: user.super_admin_manage_mode || false
        },
        token
      }
    });
};

/**
 * @desc    Register user
 * @route   POST /api/auth/signup
 * @access  Public
 */
exports.signup = async (req, res, next) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.'
      });
    }

    const { name, email, password, team_name } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create user — setup_completed=true so we skip account-setup flow
    const user = await User.create({
      name,
      email,
      password,
      setup_completed: true
    });
    
    // Use organization name from signup form, fallback to user name
    const resolvedTeamName = (team_name && team_name.trim())
      ? team_name.trim()
      : `${name}'s Team`;

    // Create team for user
    const team = await Team.create({
      name: resolvedTeamName,
      owner_id: user._id
    });
    
    // Add user as owner of the team
    await TeamMember.create({
      team_id: team._id,
      user_id: user._id,
      role: 'owner'
    });

    // Set last_team_id so organization auto-selects after login
    user.last_team_id = team._id;
    await user.save({ validateBeforeSave: false });
    
    await sendTokenResponse(user, 201, res, 'Account created successfully');
  } catch (error) {
    console.error('Signup error:', error);
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({
        success: false,
        message: 'Database operation timed out. Please try again.'
      });
    }
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.'
      });
    }

    const { email, password } = req.body;

    // Find user (never log password or full headers)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    // Store userId in session for session-based auth
    req.session.userId = user._id;

    // ── Auto-provision team for any user with setup not complete ───────────
    // Covers: Super Admin-provisioned users, team-invited users, and any edge
    // case where setup_completed is false. The setup screen is skipped entirely.
    if (!user.setup_completed) {
      try {
        const existingMembership = await TeamMember.findOne({ user_id: user._id, role: 'owner' });
        if (!existingMembership) {
          // Use first name as the organization name
          const firstName = user.name.trim().split(' ')[0];
          const team      = await Team.create({ name: firstName, owner_id: user._id });
          await TeamMember.create({ team_id: team._id, user_id: user._id, role: 'owner' });
          user.last_team_id = team._id;
        } else {
          if (!user.last_team_id) user.last_team_id = existingMembership.team_id;
        }
        // Mark setup complete → frontend goes directly to /workspace/home
        user.setup_completed = true;
        await user.save({ validateBeforeSave: false });
      } catch (teamErr) {
        console.error('[Auto-setup] Failed to create team:', teamErr);
        // Non-fatal — user can still proceed
      }
    }

    // Check ownership
    const ownerMembership = await TeamMember.findOne({ user_id: user._id, role: 'owner', is_active: true });
    user.owner = !!ownerMembership;

    // If user has no last_team_id, auto-assign their first team (owner team)
    if (!user.last_team_id && ownerMembership) {
      user.last_team_id = ownerMembership.team_id;
      await user.save({ validateBeforeSave: false });
    }

    await sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({
        success: false,
        message: 'Database operation timed out. Please try again.'
      });
    }
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   GET /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    
    // Destroy session
    if (req.session) {
      req.session.destroy();
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get user's teams
    const teamMemberships = await TeamMember.find({ user_id: user._id, is_active: true })
      .populate('team_id');
    
    const userObj = user.toJSON();
    if (user.last_team_id) {
        userObj.team_id = user.last_team_id;
    }

    res.json({
      success: true,
      data: {
        user: userObj,
        teams: teamMemberships.map(tm => tm.team_id)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify token / Check auth status
 * @route   GET /api/auth/verify
 * @access  Public
 */
exports.verify = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        return res.json({
          success: true,
          authenticated: true,
          data: { user }
        });
      }
    }
    
    if (!token) {
      return res.json({
        success: true,
        authenticated: false
      });
    }
    
    const decoded = jwt.verify(token, constants.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      res.clearCookie('token');
      return res.set('Cache-Control', 'no-store').json({
        success: true,
        authenticated: false
      });
    }
    
    const ownerMembership = await TeamMember.findOne({ user_id: user._id, role: 'owner', is_active: true });
    
    const userObj = user.toJSON();
    userObj.owner = !!ownerMembership;
    userObj.is_super_admin = user.role === 'super_admin';
    
    // ── Super Admin Context Override ──────────────────────────────────
    if (userObj.is_super_admin && user.super_admin_active_team) {
        const targetTeam = await Team.findById(user.super_admin_active_team);
        if (targetTeam) {
            userObj.team_id = targetTeam._id.toString();
            userObj.team_name = targetTeam.name; // Pass team name for frontend display
            userObj.team_logo_url = targetTeam.logo_url;
            userObj.team_role = 'super_admin';
            userObj.super_admin_active_team = targetTeam._id.toString();
        }
    } 
    // ── Normal Team Logic ─────────────────────────────────────────────
    else if (user.last_team_id) {
        userObj.team_id = user.last_team_id;

        const teamMember = await TeamMember.findOne({
          team_id: user.last_team_id,
          user_id: user._id,
          is_active: true
        });

        const team = await Team.findById(user.last_team_id);
        if (team) {
          userObj.team_name = team.name;
          userObj.team_logo_url = team.logo_url;
        }

        if (teamMember) {
          userObj.team_role = teamMember.role;
          // Reflect correct admin/owner access for the ACTIVE team
          userObj.is_admin  = teamMember.role === 'owner' || teamMember.role === 'admin';
          userObj.owner     = teamMember.role === 'owner';
        } else {
          // Fallback: check if user owns any team (e.g. their personal org)
          userObj.is_admin = !!ownerMembership;
          userObj.owner    = !!ownerMembership;
        }
    }


    res.set('Cache-Control', 'no-store').json({
      success: true,
      authenticated: true,
      data: { user: userObj }
    });
  } catch (error) {
    res.json({
      success: true,
      authenticated: false
    });
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log(`[ForgotPassword] Request for: ${email}`);
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.log(`[ForgotPassword] User NOT found for: ${email}`);
      // For security, don't reveal if user exists. Just return "If exists..."
      return res.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent.'
      });
    }

    console.log(`[ForgotPassword] User found: ${user.email} (${user._id})`);

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash and store
    user.password_reset_token = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.password_reset_expires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save({ validateBeforeSave: false });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/workspace/reset-password?token=${resetToken}`;
    
    const message = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #1890ff;">Password Reset Request</h2>
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click on the button below to complete the process within the next hour:</p>
        
        <div style="margin: 40px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #1890ff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #9eadb6; font-size: 12px;">Workspace Security Team</p>
      </div>
    `;

    console.log(`[ForgotPassword] Attempting to send email to ${user.email}...`);    let emailResult = await emailService.sendEmail({
      to: String(user.email || '').trim().toLowerCase(),
      subject: 'Password Reset Request',
      html: message
    });

    // One retry to handle transient SMTP/provider failures.
    if (!emailResult.success) {
      console.error(`[ForgotPassword] Email send FAILED (attempt 1): ${emailResult.error}`);
      emailResult = await emailService.sendEmail({
        to: String(user.email || '').trim().toLowerCase(),
        subject: 'Password Reset Request',
        html: message
      });
    }

    if (!emailResult.success) {
      console.error(`[ForgotPassword] Email send FAILED (final): ${emailResult.error}`);
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          success: true,
          message: 'Email delivery failed in non-production. Use reset_url from response.',
          reset_url: resetUrl,
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Unable to send reset email right now. Please try again in a few minutes.'
      });
    }

    console.log(`[ForgotPassword] Email send SUCCESS: ${emailResult.messageId}`);

    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent.',
        reset_url: resetUrl,
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.'
    });
  } catch (error) {
    console.error(`[ForgotPassword] CRITICAL ERROR:`, error);
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const crypto = require('crypto');
    const resetToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      password_reset_token: resetToken,
      password_reset_expires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    user.password_changed_at = Date.now();
    
    await user.save();

    await sendTokenResponse(user, 200, res, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/password
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { password, new_password, confirm_password } = req.body;
    
    if (!password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required'
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check current password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Check if new passwords match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }
    
    user.password = new_password;
    await user.save();
    
    await sendTokenResponse(user, 200, res, 'Password updated successfully');
  } catch (error) {
    console.error('Update password error:', error);
    next(error);
  }
};

module.exports = {
  signup: exports.signup,
  login: exports.login,
  logout: exports.logout,
  verify: exports.verify,
  forgotPassword: exports.forgotPassword,
  resetPassword: exports.resetPassword,
  updatePassword: exports.updatePassword,
  getMe: exports.getMe
};

