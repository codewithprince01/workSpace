const { Project, ProjectMember, TaskStatus, Task, ProjectInvitation, Notification, User } = require('../models');
const constants = require('../config/constants');
const emailService = require('../services/email.service');
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * @desc    Get user's role in project
 * @route   GET /api/projects/:id/role
 * @access  Private
 */
exports.getUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── Super Admin Bypass ─────────────────────────────────────────────────
    // checkProjectRole already validated the request; here we short-circuit
    // any additional DB lookups so super admins always get 'owner' role.
    if (req.isSuperAdmin && req.superAdminActiveTeam) {
      return res.json({
        done: true,
        body: { role: 'owner', project_id: id }
      });
    }
    // ──────────────────────────────────────────────────────────────────────
    
    // First check if user is the project owner
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        done: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is project owner
    if (project.owner_id && project.owner_id.toString() === req.user._id.toString()) {
      return res.json({
        done: true,
        body: {
          role: 'owner',
          project_id: id
        }
      });
    }
    
    // Check ProjectMember for other roles
    const member = await ProjectMember.findOne({
      project_id: id,
      user_id: req.user._id,
      is_active: true
    });
    
    if (!member) {
      return res.status(403).json({
        done: false,
        message: 'User is not a member of this project'
      });
    }
    
    res.json({
      done: true,
      body: {
        role: member.role,
        project_id: id
      }
    });
  } catch (error) {
    next(error);
  }
};
