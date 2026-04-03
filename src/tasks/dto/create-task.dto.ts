import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsUUID, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '../task.entity';

export class CreateTaskDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsNumber()
  @Min(0)
  @IsOptional()
  effort?: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
