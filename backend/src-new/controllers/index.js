module.exports = {
  auth: require('./auth.controller'),
  users: require('./users.controller'),
  teams: require('./teams.controller'),
  projects: require('./projects.controller'),
  tasks: require('./tasks.controller'),
  surveys: require('./surveys.controller'),
  settings: require('./settings.controller'),
  projectTemplates: require('./project-templates.controller'),
  reporting: require('./reporting.controller'),
  taskDependencies: require('./task-dependencies.controller')
};
