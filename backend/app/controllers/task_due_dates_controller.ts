import Task from '#models/task'
import { setTaskDueDateValidator, toCalendarDay } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@foadonis/openapi/decorators'
import { ErrorResponse, TaskDetailResponse } from '#openapi/schemas'

export default class TaskDueDatesController {
  /**
   * Fijar, cambiar y retirar la fecha de vencimiento son la misma operación, y
   * por eso comparten endpoint: quitar la fecha no es borrar un recurso, es
   * poner el valor «sin fecha», que es un valor legítimo del campo.
   *
   * Endpoint propio en vez de un update genérico de la tarea, por el mismo
   * motivo que el estado: por ahí se colarían el título y el responsable, que
   * este change no permite tocar.
   *
   * Cualquiera con sesión puede cambiar la fecha de cualquier tarea, igual que
   * el estado. No se comprueba quién es el responsable.
   */
  @ApiOperation({
    summary: 'Fijar, cambiar o retirar la fecha de vencimiento',
    description:
      'Las tres son la misma operación: quitar la fecha no borra un recurso, pone el valor «sin fecha», que es un valor legítimo del campo. Cualquiera con sesión puede hacerlo sobre cualquier tarea.',
  })
  @ApiBearerAuth()
  /**
   * El cuerpo va a mano y no con `@ApiSchema(setTaskDueDateValidator)` como en
   * los otros dos: `vine.date()` no tiene traducción a JSON Schema y el
   * validador se describiría a sí mismo como un campo sin tipo y otro cuyo
   * único valor posible es `null`. Documentar el día del calendario es
   * justamente lo que aquí no se puede perder.
   */
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        today: {
          type: 'string',
          format: 'date',
          example: '2026-09-05',
          description:
            'El día del calendario de quien pide, `AAAA-MM-DD`. Obligatorio: la respuesta devuelve la tarea con su condición de vencida ya resuelta contra él, para que aplazar una tarea vencida deje de mostrarla vencida en esta misma respuesta.',
        },
        dueDate: {
          type: 'string',
          format: 'date',
          nullable: true,
          example: '2026-09-30',
          description:
            'La nueva fecha, o `null` para retirarla. Una fecha ya pasada se acepta sin advertir nada, y la tarea pasa a estar vencida.',
        },
      },
      required: ['today', 'dueDate'],
    },
  })
  @ApiResponse({
    status: 200,
    type: () => TaskDetailResponse,
    description:
      'La tarea con su fecha ya actualizada y su vencimiento resuelto. Su título, su responsable y su estado siguen siendo exactamente los mismos.',
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
      'Falta `today`, o alguna de las dos fechas es imposible o está mal formada. La tarea conserva intacta la fecha que tuviera antes.',
  })
  async update({ params, request, serialize }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    const { today, dueDate } = await request.validateUsing(setTaskDueDateValidator)

    // El `DateTime` del validador se queda aquí: hacia dentro, una fecha de
    // vencimiento es un día en texto y nunca un instante.
    task.dueDate = dueDate === null ? null : toCalendarDay(dueDate)
    await task.save()
    await task.load('assignee')

    // Se devuelve ya resuelta contra el día de quien pide, para que aplazar una
    // tarea vencida deje de mostrarla vencida en esta misma respuesta.
    return serialize(TaskDetailTransformer.transform(task, toCalendarDay(today)))
  }
}
