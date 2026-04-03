import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const { projectId, parentId, ...rest } = createTaskDto;
    
    // Obtain the max project key number using PostgreSQL split_part
    const query = this.taskRepository.createQueryBuilder('task')
      .where('task.projectId = :projectId', { projectId })
      .select("MAX(CAST(SPLIT_PART(task.projectKey, '-', 2) AS INTEGER))", 'maxVal');
      
    const result = await query.getRawOne();
    const nextNumber = (parseInt(result?.maxVal) || 0) + 1;
    const projectKey = `TASK-${nextNumber}`;

    const task = this.taskRepository.create({
      ...rest,
      projectId,
      parentId,
      projectKey,
    });

    return this.taskRepository.save(task);
  }

  async findAll(query: { projectId?: string; status?: TaskStatus; priority?: TaskPriority }): Promise<Task[]> {
    const filter: any = { ...query };
    
    // By default return only root tasks UNLESS the user explicitly passed a parentId in their query.
    // In this case, we'll assume the basic list doesn't get a parentId query, so we enforce parentId: IsNull()
    if (!filter.hasOwnProperty('parentId')) {
      filter.parentId = IsNull();
    }

    return this.taskRepository.find({ where: filter });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['children'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    this.taskRepository.merge(task, updateTaskDto);
    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepository.remove(task);
  }

  async getTree(id: string): Promise<any> {
    // Check if real
    const root = await this.findOne(id);

    const rawResult = await this.taskRepository.query(`
      WITH RECURSIVE task_tree AS (
        SELECT *
        FROM tasks
        WHERE id = $1

        UNION ALL

        SELECT t.*
        FROM tasks t
        INNER JOIN task_tree tt ON t."parentId" = tt.id
      )
      SELECT * FROM task_tree;
    `, [id]);

    return this.buildTree(rawResult, id);
  }

  private buildTree(tasks: any[], rootId: string) {
    const map = new Map<string, any>();
    tasks.forEach(t => map.set(t.id, { ...t, children: [] }));
    let root = null;
    
    tasks.forEach(t => {
      if (t.id === rootId) {
        root = map.get(t.id);
      } else {
        const parent = map.get(t.parentId);
        if (parent) {
          parent.children.push(map.get(t.id));
        }
      }
    });
    
    return root;
  }

  async getProjectTree(projectId: string): Promise<any[]> {
    const tasks = await this.taskRepository.find({
      where: { projectId },
      order: { createdAt: 'ASC' }
    });

    return this.buildTreeMultiple(tasks);
  }

  private buildTreeMultiple(tasks: any[]) {
    const map = new Map<string, any>();
    tasks.forEach(t => map.set(t.id, { ...t, children: [] }));
    const roots: any[] = [];
    
    tasks.forEach(t => {
      if (!t.parentId) {
        roots.push(map.get(t.id));
      } else {
        const parent = map.get(t.parentId);
        if (parent) {
          parent.children.push(map.get(t.id));
        }
      }
    });
    
    return roots;
  }

  async getEffortAnalytics(id: string): Promise<any> {
    // Check if task exists
    await this.findOne(id);

    const rawResult = await this.taskRepository.query(`
      WITH RECURSIVE task_tree AS (
        SELECT id, effort, status
        FROM tasks
        WHERE id = $1

        UNION ALL

        SELECT t.id, t.effort, t.status
        FROM tasks t
        INNER JOIN task_tree tt ON t."parentId" = tt.id
      )
      SELECT status, SUM(COALESCE(effort, 0)) as total
      FROM task_tree
      GROUP BY status;
    `, [id]);

    const result = {
      todoEffort: 0,
      inProgressEffort: 0,
      doneEffort: 0,
      totalEffort: 0,
    };

    rawResult.forEach((row: any) => {
      const val = parseFloat(row.total);
      if (row.status === TaskStatus.TODO) result.todoEffort += val;
      if (row.status === TaskStatus.IN_PROGRESS) result.inProgressEffort += val;
      if (row.status === TaskStatus.DONE) result.doneEffort += val;
      result.totalEffort += val;
    });

    return result;
  }
}
