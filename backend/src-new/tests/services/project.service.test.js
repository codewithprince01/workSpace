const projectService = require('../../services/project.service');
const { Project, ProjectMember, TaskStatus } = require('../../models');

// Mock the models
jest.mock('../../models', () => ({
  Project: {
    create: jest.fn(),
    findById: jest.fn()
  },
  ProjectMember: {
    create: jest.fn(),
    findOne: jest.fn()
  },
  TaskStatus: {
    create: jest.fn()
  },
  ProjectInvitation: {
    create: jest.fn(),
    findOne: jest.fn()
  },
  Notification: {
    create: jest.fn()
  },
  TeamMember: {
    findOne: jest.fn()
  },
  User: {
    findOne: jest.fn()
  }
}));

describe('Project Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a project and its default statuses', async () => {
      const mockProject = { _id: 'proj1', name: 'Test Project', toObject: () => ({ name: 'Test Project' }) };
      Project.create.mockResolvedValue(mockProject);
      
      const userId = 'user1';
      const data = { name: 'Test Project', team_id: 'team1' };

      const result = await projectService.createProject(data, userId);

      expect(Project.create).toHaveBeenCalled();
      expect(ProjectMember.create).toHaveBeenCalledWith(expect.objectContaining({
        project_id: 'proj1',
        user_id: userId,
        role: 'owner'
      }));
      expect(TaskStatus.create).toHaveBeenCalled(); // Default statuses
      expect(result).toBe(mockProject);
    });
  });
});
