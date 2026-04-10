const jwt = require('jsonwebtoken');
const { User, Team, TeamMember } = require('../models');
const constants = require('../config/constants');
const mongoose = require('mongoose');

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
const sendTokenResponse = (user, statusCode, res, message = null) => {
  const token = generateToken(user._id);
  
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/'
  };
  
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
          is_admin: user.is_admin,
          owner: user.owner, // Ensure owner flag is passed
          team_id: user.last_team_id, // Add persistent team ID
          setup_completed: user.setup_completed || false
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

    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password
    });
    
    // Create default team for user
    const team = await Team.create({
      name: `${name}'s Team`,
      owner_id: user._id
    });
    
    // Add user as team member
    await TeamMember.create({
      team_id: team._id,
      user_id: user._id,
      role: 'owner'
    });
    
    sendTokenResponse(user, 201, res, 'Account created successfully');
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

    // Check ownership
    const ownerMembership = await TeamMember.findOne({ user_id: user._id, role: 'owner', is_active: true });
    // Attach to user instance (will be used in sendTokenResponse)
    user.owner = !!ownerMembership;

    sendTokenResponse(user, 200, res, 'Login successful');
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
      return res.json({
        success: true,
        authenticated: false
      });
    }
    
    const ownerMembership = await TeamMember.findOne({ user_id: user._id, role: 'owner', is_active: true });
    
    const userObj = user.toJSON();
    userObj.owner = !!ownerMembership;
    
    // Map last_team_id to team_id for frontend compatibility
    if (user.last_team_id) {
        userObj.team_id = user.last_team_id;

        // Get user's TEAM-level role (not project role - that's fetched per-project)
        const teamMember = await TeamMember.findOne({
          team_id: user.last_team_id,
          user_id: user._id,
          is_active: true
        });

        if (teamMember) {
          userObj.team_role = teamMember.role;
        }

        // Note: Project-specific roles are fetched via GET /api/projects/:id/role
    }

    res.json({
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
 * @desc    Update password
 * @route   PUT /api/auth/password
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    sendTokenResponse(user, 200, res, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};
