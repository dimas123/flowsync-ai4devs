import type Task from '#models/task'
import { BaseTransformer } from '@adonisjs/core/transformers'
import TaskAssigneeTransformer from '#transformers/task_assignee_transformer'

/**
 * Una tarea tal y como la devuelve la lista.
 *
 * El responsable se serializa con `TaskAssigneeTransformer` y no con
 * `UserTransformer`: el segundo es la cuenta entera —email y fechas incluidos—
 * y aquí solo se puede enseñar lo justo para identificar a quien la lleva.
 * Reutilizarlo por no repetir la forma del usuario es exactamente lo que hizo
 * que la lista filtrara el email de todo el equipo.
 */
export default class TaskTransformer extends BaseTransformer<Task> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status', 'createdAt', 'updatedAt']),
      assignee: TaskAssigneeTransformer.transform(this.whenLoaded(this.resource.assignee)),
    }
  }
}
