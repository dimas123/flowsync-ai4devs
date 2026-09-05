import Task from '#models/task'
import { updateTaskStatusValidator } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskTransformer from '#transformers/task_transformer'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSchema } from '@foadonis/openapi/decorators'
import { ErrorResponse, TaskResponse } from '#openapi/schemas'

export default class TaskStatusesController {
  /**
   * El estado es lo único mutable de una tarea en este momento, y por eso
   * tiene endpoint propio en vez de colgar de un update genérico: por ese
   * update acabarían colándose el título y el responsable, que son historias
   * que todavía no se han especificado.
   *
   * Cualquier persona con sesión puede cambiar el estado de cualquier tarea,
   * en cualquier dirección. No hay permisos por responsable ni transiciones
   * prohibidas: volver de «hecho» a «pendiente» es justamente lo que arregla
   * un clic dado por error.
   */
  @ApiOperation({
    summary: 'Cambiar el estado de una tarea',
    description:
      'Cualquier cuenta con sesión puede cambiar el estado de cualquier tarea, en cualquier dirección. No hay permisos por responsable ni transiciones prohibidas: volver de `done` a `pending` es lo que arregla un clic dado por error.',
  })
  @ApiBearerAuth()
  @ApiSchema(updateTaskStatusValidator)
  @ApiResponse({
    status: 200,
    type: () => TaskResponse,
    description:
      'La tarea con su nuevo estado. Su título y su responsable siguen siendo los mismos.',
  })
  @ApiResponse({
    status: 401,
    type: () => ErrorResponse,
    description: 'Falta el token o no es válido. Nada cambia.',
  })
  @ApiResponse({
    status: 404,
    type: () => ErrorResponse,
    description: 'No hay ninguna tarea con ese identificador.',
  })
  @ApiResponse({
    status: 422,
    type: () => ErrorResponse,
    description:
      'El estado no es ninguno de los tres. La tarea conserva el que tenía y el estado inventado no pasa a existir.',
  })
  async update({ params, request, serialize }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    const { status } = await request.validateUsing(updateTaskStatusValidator)

    task.status = status
    await task.save()
    await task.load('assignee')

    return serialize(TaskTransformer.transform(task))
  }
}
