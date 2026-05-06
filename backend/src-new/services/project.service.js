const { Project, ProjectMember, TaskStatus, ProjectInvitation, Notification, User } = require('../models');
const constants = require('../config/constants');
const emailService = require('./email.service');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { sanitizeText, sanitizeRich } = require('../utils/sanitize');

/**
 * Project Service
 * Handles business logic for projects
 */

/**
 * Create a new project with defaults
 */
exports.createProject = async (data, ownerId) => {
  const {
    name, description, notes, key, team_id,
    color_code, start_date, end_date, status, health,
    category_id, client_id, client_name, project_manager_id,
    working_days, man_days, hours_per_day,
    use_manual_progress, use_weighted_progress, use_time_progress
  } = data;

  // 1. Generate project key if not provided
  const projectKey = key || name.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

  // 2. Create project
  const project = await Project.create({
    name: sanitizeText(name),
    description: sanitizeRich(description ?? notes ?? null),
    notes: sanitizeRich(notes ?? description ?? null),
    key: projectKey,
    team_id,
    owner_id: ownerId,
    color_code: color_code || constants.TASK_STATUS_COLORS.TODO,
    status: status || 'active',
    health: health || 'good',
    category_id,
    client_id,
    client_name: client_name ? sanitizeText(client_name) : null,
    project_manager_id: project_manager_id || ownerId,
    start_date,
    end_date,
    working_days: Number(working_days) || 0,
    man_days: Number(man_days) || 0,
    hours_per_day: Number(hours_per_day) || 8,
    use_manual_progress: !!use_manual_progress,
    use_weighted_progress: !!use_weighted_progress,
    use_time_progress: !!use_time_progress,
  });

  // 3. Add owner as project member
  await ProjectMember.create({
    project_id: project._id,
    user_id: ownerId,
    role: 'owner'
  });

  // 4. Create default task statuses
  await exports.createDefaultStatuses(project._id);

  return project;
};

/**
 * @desc    Create default task statuses for a project
 * @param   {String} projectId
 */
exports.createDefaultStatuses = async (projectId) => {
  const defaultStatuses = [
    { name: 'To Do', category: 'todo', color_code: '#75c9c0', sort_order: 0, is_default: true },
    { name: 'In Progress', category: 'doing', color_code: '#3b7ad4', sort_order: 1 },
    { name: 'Done', category: 'done', color_code: '#70a6f3', sort_order: 2 }
  ];

  for (const statusObj of defaultStatuses) {
    await TaskStatus.create({
      ...statusObj,
      project_id: projectId
    });
  }
};

/**
 * Handle project invitation
 */
exports.inviteMember = async (projectId, email, role, inviterId, inviterName) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  // Create token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await ProjectInvitation.create({
    project_id: projectId,
    inviter_id: inviterId,
    email: email.toLowerCase(),
    role,
    token,
    expires_at: expiresAt
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/workspace/invite/project/${token}`;

  await emailService.sendProjectInviteEmail(email, inviterName, project.name, inviteLink, role);

  return invitation;
};
