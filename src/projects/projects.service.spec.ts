import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project } from './project.entity';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'uuid-001',
  name: 'Test Project',
  description: 'A fixture project',
  status: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  tasks: [],
};

// ─── Repository mock factory ──────────────────────────────────────────────────

const mockProjectRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  remove: jest.fn(),
});

type MockRepository = ReturnType<typeof mockProjectRepository>;

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: MockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useFactory: mockProjectRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    repo = module.get<MockRepository>(getRepositoryToken(Project));
  });

  // ── is defined ──────────────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new project', async () => {
      // Arrange
      const dto = { name: 'New Project', description: 'desc' };
      repo.create.mockReturnValue(mockProject);
      repo.save.mockResolvedValue(mockProject);

      // Act
      const result = await service.create(dto);

      // Assert
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(mockProject);
      expect(result).toEqual(mockProject);
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      // Arrange
      repo.find.mockResolvedValue([mockProject]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(repo.find).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockProject);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a project if it exists', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProject);

      // Act
      const result = await service.findOne('uuid-001');

      // Assert
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-001' } });
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException if project does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent')).rejects.toThrow(
        new NotFoundException('Project with ID "non-existent" not found'),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should merge and save the updated project', async () => {
      // Arrange
      const updateDto = { name: 'Updated Name' };
      const updatedProject = { ...mockProject, name: 'Updated Name' };
      repo.findOne.mockResolvedValue(mockProject);
      repo.merge.mockReturnValue(undefined); // merge modifies in-place
      repo.save.mockResolvedValue(updatedProject);

      // Act
      const result = await service.update('uuid-001', updateDto);

      // Assert
      expect(repo.merge).toHaveBeenCalledWith(mockProject, updateDto);
      expect(repo.save).toHaveBeenCalledWith(mockProject);
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when updating a non-existent project', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the project successfully', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockProject);
      repo.remove.mockResolvedValue(undefined);

      // Act
      await service.remove('uuid-001');

      // Assert
      expect(repo.remove).toHaveBeenCalledWith(mockProject);
    });

    it('should throw NotFoundException when removing a non-existent project', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
