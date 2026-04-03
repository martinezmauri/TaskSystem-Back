import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TasksService } from './tasks.service';
import { Task, TaskStatus, TaskPriority } from './task.entity';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-uuid-001';

const mockTask = {
  id: 'task-uuid-001',
  projectKey: 'TASK-1',
  title: 'Root Task',
  description: 'fixture',
  status: TaskStatus.TODO,
  priority: TaskPriority.MEDIUM,
  effort: 4,
  dueDate: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  projectId: PROJECT_ID,
  parentId: undefined,
  project: undefined,
  parent: undefined,
  children: [],
} as unknown as Task;

// ─── QueryBuilder chain mock ──────────────────────────────────────────────────

function buildQueryBuilderMock(getRawOneResult: Record<string, any>) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(getRawOneResult),
  };
  return qb;
}

// ─── Repository mock factory ──────────────────────────────────────────────────

const mockTaskRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
  query: jest.fn(),
});

type MockRepository = ReturnType<typeof mockTaskRepository>;

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('TasksService', () => {
  let service: TasksService;
  let repo: MockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useFactory: mockTaskRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repo = module.get<MockRepository>(getRepositoryToken(Task));
  });

  // ── is defined ──────────────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should generate TASK-1 for the first task in a project (no previous tasks)', async () => {
      // Arrange – no prior tasks: maxVal is null → nextNumber = 1
      const qb = buildQueryBuilderMock({ maxVal: null });
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.create.mockReturnValue(mockTask);
      repo.save.mockResolvedValue(mockTask);

      const dto = {
        title: 'Root Task',
        projectId: PROJECT_ID,
        parentId: undefined,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        effort: 4,
      };

      // Act
      const result = await service.create(dto);

      // Assert – key chain calls
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(qb.where).toHaveBeenCalledWith('task.projectId = :projectId', {
        projectId: PROJECT_ID,
      });
      expect(qb.getRawOne).toHaveBeenCalled();

      // The created task should receive projectKey = 'TASK-1'
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectKey: 'TASK-1',
          projectId: PROJECT_ID,
        }),
      );
      expect(result).toEqual(mockTask);
    });

    it('should increment projectKey when previous tasks exist (maxVal = 3 → TASK-4)', async () => {
      // Arrange – 3 prior tasks: maxVal = '3' → nextNumber = 4
      const qb = buildQueryBuilderMock({ maxVal: '3' });
      repo.createQueryBuilder.mockReturnValue(qb);
      const expectedTask = { ...mockTask, projectKey: 'TASK-4' };
      repo.create.mockReturnValue(expectedTask);
      repo.save.mockResolvedValue(expectedTask);

      const dto = {
        title: 'Fourth Task',
        projectId: PROJECT_ID,
        parentId: undefined,
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        effort: 2,
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectKey: 'TASK-4' }),
      );
      expect(result.projectKey).toBe('TASK-4');
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should apply parentId: IsNull() when no parentId is provided in the query', async () => {
      // Arrange
      repo.find.mockResolvedValue([mockTask]);

      // Act
      const result = await service.findAll({ projectId: PROJECT_ID });

      // Assert – IsNull() must be set on the filter
      expect(repo.find).toHaveBeenCalledWith({
        where: {
          projectId: PROJECT_ID,
          parentId: IsNull(),
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should NOT override parentId when it is explicitly provided', async () => {
      // Arrange
      repo.find.mockResolvedValue([]);
      const queryWithParent = {
        projectId: PROJECT_ID,
        parentId: 'task-uuid-001',
      } as any;

      // Act
      await service.findAll(queryWithParent);

      // Assert – parentId is kept as-is, not overridden with IsNull()
      expect(repo.find).toHaveBeenCalledWith({
        where: { projectId: PROJECT_ID, parentId: 'task-uuid-001' },
      });
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a task with its children relation loaded', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockTask);

      // Act
      const result = await service.findOne('task-uuid-001');

      // Assert – relations must include children
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'task-uuid-001' },
        relations: ['children'],
      });
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent')).rejects.toThrow(
        new NotFoundException('Task with ID "non-existent" not found'),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should merge and save the updated task', async () => {
      // Arrange
      // Usamos "as any" para evitar el choque de tipos entre DTO (string) y Entidad (Date)
      const dto = { status: TaskStatus.DONE } as any;
      const updatedTask = {
        ...mockTask,
        status: TaskStatus.DONE,
      } as unknown as Task;

      repo.findOne.mockResolvedValue(mockTask);
      repo.merge.mockReturnValue(undefined);
      repo.save.mockResolvedValue(updatedTask);

      // Act
      const result = await service.update('task-uuid-001', dto);

      // Assert
      expect(repo.merge).toHaveBeenCalledWith(mockTask, dto);
      expect(repo.save).toHaveBeenCalledWith(mockTask);
      expect(result.status).toBe(TaskStatus.DONE);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove a task successfully', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockTask);
      repo.remove.mockResolvedValue(undefined);

      // Act
      await service.remove('task-uuid-001');

      // Assert
      expect(repo.remove).toHaveBeenCalledWith(mockTask);
    });

    it('should throw NotFoundException if task does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getEffortAnalytics ────────────────────────────────────────────────────────

  describe('getEffortAnalytics', () => {
    it('should parse raw CTE rows and compute totals grouped by status', async () => {
      // Arrange – simulate CTE returning 3 rows with float strings (PostgreSQL SUM returns strings)
      repo.findOne.mockResolvedValue(mockTask); // findOne check inside getEffortAnalytics
      repo.query.mockResolvedValue([
        { status: 'TODO', total: '10.5' },
        { status: 'IN_PROGRESS', total: '4' },
        { status: 'DONE', total: '3.25' },
      ]);

      // Act
      const result = await service.getEffortAnalytics('task-uuid-001');

      // Assert – floats correctly parsed and accumulated
      expect(result.todoEffort).toBeCloseTo(10.5);
      expect(result.inProgressEffort).toBeCloseTo(4);
      expect(result.doneEffort).toBeCloseTo(3.25);
      expect(result.totalEffort).toBeCloseTo(17.75);
    });

    it('should return all zeros when the task has no effort data', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockTask);
      repo.query.mockResolvedValue([]);

      // Act
      const result = await service.getEffortAnalytics('task-uuid-001');

      // Assert
      expect(result).toEqual({
        todoEffort: 0,
        inProgressEffort: 0,
        doneEffort: 0,
        totalEffort: 0,
      });
    });

    it('should throw NotFoundException if the task does not exist', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getEffortAnalytics('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call the CTE query with the correct task ID parameter', async () => {
      // Arrange
      repo.findOne.mockResolvedValue(mockTask);
      repo.query.mockResolvedValue([{ status: 'TODO', total: '5' }]);

      // Act
      await service.getEffortAnalytics('task-uuid-001');

      // Assert – the raw query must receive the ID as first positional param
      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE'),
        ['task-uuid-001'],
      );
    });
  });
});
