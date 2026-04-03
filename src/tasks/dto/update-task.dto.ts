import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

// Para omitir la posibilidad de modificar proyecto o parent en el PATCH, o si lo permitimos lo dejamos normal.
// Según el requerimiento: Update task (title, description, status, priority, effort, dueDate).
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId', 'parentId'] as const)
) {}
