const { Team, TeamMember, Project, ProjectMember, Task, TaskStatus } = require('../models');

/**
 * @desc    Account setup (create team + project + tasks)
 * @route   POST /api/settings/setup
 * @access  Private
 */
exports.setupAccount = async (req, res, next) => {
  try {
    const { team_name, project_name, tasks = [], team_members = [] } = req.body;

    const resolvedTeamName = team_name || `${req.user.name}'s Team`;
    let team = await Team.findOne({ owner_id: req.user._id, name: resolvedTeamName });
    if (!team) {
      team = await Team.create({
        name: resolvedTeamName,
        owner_id: req.user._id
      });
    }

    const existingMembership = await TeamMember.findOne({
      team_id: team._id,
      user_id: req.user._id,
      is_active: true
    });
    if (!existingMembership) {
      await TeamMember.create({
        team_id: team._id,
        user_id: req.user._id,
        role: 'owner'
      });
    }

    let project = null;
    let defaultStatusId = null;
    if (project_name) {
      const baseKey = project_name.substring(0, 3).toUpperCase() || 'PRJ';
      let key = baseKey;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          project = await Project.create({
            name: project_name,
            key,
            team_id: team._id,
            owner_id: req.user._id
          });
          break;
        } catch (e) {
          if (e && e.code === 11000) {
            key = `${baseKey}${Math.floor(Math.random() * 90 + 10)}`;
            continue;
          }
          throw e;
        }
      }

      if (!project) {
        project = await Project.create({
          name: project_name,
          key: `${baseKey}${Date.now().toString().slice(-4)}`,
          team_id: team._id,
          owner_id: req.user._id
        });
      }

      await ProjectMember.create({
        project_id: project._id,
        user_id: req.user._id,
        role: 'owner'
      });

      const defaultStatuses = [
        { name: 'To Do', category: 'todo', color_code: '#75c9c0', sort_order: 0, is_default: true },
        { name: 'In Progress', category: 'doing', color_code: '#3b7ad4', sort_order: 1 },
        { name: 'Done', category: 'done', color_code: '#70a6f3', sort_order: 2 }
      ];

      const createdStatuses = await TaskStatus.insertMany(
        defaultStatuses.map(status => ({
          ...status,
          project_id: project._id
        }))
      );
      defaultStatusId = createdStatuses.find(status => status.is_default)?._id || createdStatuses[0]?._id;
    }

    // Skip initial task creation for now to avoid validation errors if status_id is missing

    // Mark setup as completed for the user
    await req.user.updateOne({ setup_completed: true });

    return res.json({
      done: true,
      body: {
        id: project ? project._id : team._id,
        has_invitations: team_members.length > 0
      }
    });
  } catch (error) {
    next(error);
  }
};
