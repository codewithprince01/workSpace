const { Project, ProjectMember } = require('../models');

/**
 * Middleware to detect project ownership and role
 * Checks if current user is the owner of the project
 * Sets req.isProjectOwner and req.projectRole
 */
exports.checkProjectRole = async (req, res, next) => {
  try {
    // Get project_id from params, body, or query
    // Frontend may send as 'current_project_id' in query
    const projectId = req.params.id || req.params.projectId || req.body.project_id || req.query.project_id || req.query.current_project_id;
    
    if (!projectId) {
      return next(); // No project context, skip
    }

    // ── Super Admin Bypass ────────────────────────────────────────────────────
    // Super admins who have switched into an org get synthetic owner access to
    // all projects within that org — no ProjectMember row required.
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      req.isProjectOwner = true;
      req.projectRole    = 'owner';
      req.projectMemberId = null;
      return next();
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Find the project
    const project = await Project.findById(projectId).select('owner_id');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user is the project owner
    const isOwner = project.owner_id.toString() === req.user._id.toString();
    
    // Find user's project membership
    const membership = await ProjectMember.findOne({
      project_id: projectId,
      user_id: req.user._id,
      is_active: true
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project'
      });
    }

    // Set role context
    req.isProjectOwner = isOwner;
    req.projectRole = isOwner ? 'owner' : membership.role;
    req.projectMemberId = membership._id;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require project owner permission
 * Must be used after checkProjectRole
 */
exports.requireProjectOwner = (req, res, next) => {
  if (!req.isProjectOwner) {
    return res.status(403).json({
      success: false,
      message: 'Only project owner can perform this action'
    });
  }
  next();
};

/**
 * Middleware to require admin permission (owner or admin role)
 * Must be used after checkProjectRole
 */
exports.requireProjectAdmin = (req, res, next) => {
  if (!req.isProjectOwner && req.projectRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only project owner or admin can perform this action'
    });
  }
  next();
};

/**
 * Middleware to require reports access (owner or admin for reporting features)
 * Must be used after checkProjectRole
 * Admins and Owners can access reports
 */
exports.requireReportsAccess = (req, res, next) => {
  // Check if user has admin or owner role for the current project
  if (!req.isProjectOwner && req.projectRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Reports are only available to project owners and admins'
    });
  }
  
  next();
};

