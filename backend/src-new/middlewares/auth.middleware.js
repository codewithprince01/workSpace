const jwt = require('jsonwebtoken');
const { User } = require('../models');
const constants = require('../config/constants');

/**
 * Protect routes - Verify JWT token.
 *
 * KEY: also applies super-admin org context on every request so ALL
 * downstream controllers (projects, tasks, home, calendar …) automatically
 * filter by the switched team — no per-route middleware needed.
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Check session
    else if (req.session && req.session.userId) {
      req.user = await User.findById(req.session.userId);
      if (req.user) {
        _applySuperAdminContext(req);
        return next();
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, constants.JWT_SECRET);

    // Always fetch fresh user from DB — super_admin_active_team changes dynamically
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    req.user = user;

    // Apply super-admin org context override
    _applySuperAdminContext(req);

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

/**
 * Internal helper — overrides req.user.last_team_id for super admins who have
 * switched into another organisation.  Called inside protect() so it applies
 * to EVERY authenticated route automatically.
 */
function _applySuperAdminContext(req) {
  const user = req.user;
  if (!user) return;

  const isSuperAdmin = user.role === 'super_admin';
  const activeTeam   = user.super_admin_active_team || null;

  req.isSuperAdmin         = isSuperAdmin;
  req.superAdminActiveTeam = activeTeam;
  req.superAdminManageMode = user.super_admin_manage_mode || false;

  // ── KEY FIX ───────────────────────────────────────────────────────────────
  // If a super admin has switched into another org, redirect all DB queries
  // to that org's team_id by overriding last_team_id for this request.
  // This makes projects, tasks, home-page, calendar, reporting, etc. all
  // return data for the target org without any per-controller changes.
  if (isSuperAdmin && activeTeam) {
    req.user.last_team_id = activeTeam;
  }
  // ─────────────────────────────────────────────────────────────────────────
}


/**
 * Optional auth - Attach user if token exists
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (token) {
      const decoded = jwt.verify(token, constants.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Authorize roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'User role is not authorized to access this route'
      });
    }
    next();
  };
};

/**
 * Admin only
 */
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Super Admin only - blocks non-super-admins entirely
 */
exports.superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};

/**
 * Attach isSuperAdmin flag to req for use in controllers
 * Does NOT block — just enriches req with context info
 */
exports.attachSuperAdminContext = (req, res, next) => {
  if (req.user) {
    req.isSuperAdmin = req.user.role === 'super_admin';
    // The team the super admin is currently viewing (may differ from their own team)
    req.superAdminActiveTeam = req.user.super_admin_active_team || null;
    req.superAdminManageMode = req.user.super_admin_manage_mode || false;

    // IF in super admin context, override last_team_id so the rest of the app 
    // filters by the target team automatically.
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      // In-memory override for the duration of this request
      req.user.last_team_id = req.superAdminActiveTeam;
    }
  } else {
    req.isSuperAdmin = false;
    req.superAdminActiveTeam = null;
    req.superAdminManageMode = false;
  }
  next();
};

/**
 * Utility to check if user should have full access to team projects
 */
exports.hasFullTeamAccess = (req) => {
  if (req.user?.role === 'super_admin' && req.user?.super_admin_active_team) {
    return true;
  }
  // Admins/Owners usually have access to all projects in their team anyway 
  // but let's keep it specific to super admins for now.
  return false;
};
