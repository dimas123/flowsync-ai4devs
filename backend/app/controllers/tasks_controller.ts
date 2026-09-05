import Task, { DEFAULT_LIST_STATUSES, TASK_STATUSES } from '#models/task'
import {
  createTaskValidator,
  listTasksValidator,
  taskReferenceDayValidator,
  toCalendarDay,
} from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskTransformer from '#transformers/task_transformer'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSchema,
} from '@foadonis/openapi/decorators'
import { ErrorResponse, TaskDetailResponse, TaskListResponse, TaskResponse } from '#openapi/schemas'

export default class TasksController {
  /**
   * La lista del espacio: una sola, la misma para todo el mundo, sin filtrar
   * por quién la pide. El responsable va precargado en la misma consulta —
   * es el 100 % de los accesos y resolverlo tarea a tarea sería el error caro
   * y evidente aquí.
   *
   * Admite acotarse por estado, y aquí hay tres caminos que no se cruzan:
   * un estado válido devuelve solo el suyo (aunque no haya ninguna, y eso es
   * una lista vacía legítima, no un error); no pedir nada devuelve lo que
   * sigue abierto; y un estado que no existe ni siquiera llega, porque el
   * validador lo corta antes con un 422. Devolverlo vacío sería el fallo
   * silencioso que esta lista no se puede permitir.
   *
   * Acotar es solo lectura: ninguna tarea cambia por consultarla.
   */
  @ApiOperation({
    summary: 'La lista compartida del espacio',
    description:
      'Una sola lista, la misma para cualquier cuenta que pida el mismo alcance, ordenada de la más reciente a la más antigua. Llega entera: no se pagina ni se recorta.',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [...TASK_STATUSES],
    description:
      'Acota la lista a un único estado. Su ausencia NO significa «todas»: significa la vista por defecto, que es lo pendiente y lo que está en curso, dejando fuera lo hecho.',
  })
  @ApiResponse({
    status: 200,
    type: () => TaskListResponse,
    description:
      'Las tareas del alcance pedido. Una lista vacía aquí es una respuesta legítima: significa que no hay ninguna tarea en ese estado, no que algo haya fallado.',
  })
  @ApiResponse({
    status: 401,
    type: () => ErrorResponse,
    description: 'Falta el token o no es válido. No se devuelve ninguna tarea.',
  })
  @ApiResponse({
    status: 422,
    type: () => ErrorResponse,
    description:
      'El `status` pedido no es ninguno de los tres. Se responde con un error sobre ese campo y NUNCA con una lista vacía: pedir algo que no existe y no encontrar nada tienen que ser distinguibles desde fuera.',
  })
  async index({ request, serialize }: HttpContext) {
    const { status } = await request.validateUsing(listTasksValidator)

    const query = Task.query().preload('assignee')

    if (status) {
      query.where('status', status)
    } else {
      // Sin filtro no es «todas»: lo hecho se queda fuera.
      query.whereIn('status', [...DEFAULT_LIST_STATUSES])
    }

    const tasks = await query
      .orderBy('createdAt', 'desc')
      // Desempate estable: dos tareas creadas en el mismo milisegundo tienen
      // la misma marca de tiempo, y sin esto su orden relativo sería el que
      // quisiera la base de datos.
      .orderBy('id', 'desc')

    return serialize(TaskTransformer.transform(tasks))
  }

  /**
   * Una tarea suelta, con todo lo que tiene: es la única lectura que informa
   * del vencimiento, y por eso es la única que exige el día de quien mira.
   */
  @ApiOperation({
    summary: 'Una tarea suelta, con su vencimiento',
    description:
      'La única lectura que informa del vencimiento, y por eso la única que exige el día de quien mira. Se recibe entera aunque la lleve otra persona.',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'today',
    required: true,
    schema: { type: 'string', format: 'date', example: '2026-09-05' },
    description:
      'El día del calendario de quien consulta, `AAAA-MM-DD`. Es obligatorio y no tiene valor por defecto a propósito: sustituirlo por el día del servidor daría la lectura equivocada a quien mire desde otro huso, y lo haría en silencio.',
  })
  @ApiResponse({
    status: 200,
    type: () => TaskDetailResponse,
    description: 'La tarea, con su fecha de vencimiento —o su ausencia— y su condición de vencida.',
  })
  @ApiResponse({
    status: 401,
    type: () => ErrorResponse,
    description: 'Falta el token o no es válido. No se devuelve ninguna tarea.',
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
      'Falta `today` o no es una fecha que exista. El sistema no responde usando su propio día.',
  })
  async show({ params, request, serialize }: HttpContext) {
    const { today } = await request.validateUsing(taskReferenceDayValidator)
    const task = await Task.findOrFail(params.id)
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task, toCalendarDay(today)))
  }

  /**
   * Crear cuesta un título. El responsable y el estado no se leen de la
   * petición ni aunque vengan: los pone el sistema.
   */
  @ApiOperation({
    summary: 'Crear una tarea',
    description:
      'El título es el único dato que se pide. El responsable —quien envía la petición— y el estado `pending` los pone el sistema, y no se leen del cuerpo ni aunque vengan.',
  })
  @ApiBearerAuth()
  @ApiSchema(createTaskValidator)
  @ApiResponse({
    status: 201,
    type: () => TaskResponse,
    description: 'La tarea ya creada, a nombre de quien la envía y en estado `pending`.',
  })
  @ApiResponse({
    status: 401,
    type: () => ErrorResponse,
    description: 'Falta el token o no es válido. No se crea nada.',
  })
  @ApiResponse({
    status: 422,
    type: () => ErrorResponse,
    description:
      'El título falta, está vacío, es solo espacios o pasa de 200 caracteres. No se crea ninguna tarea y no se guarda ninguna versión recortada.',
  })
  async store({ request, response, auth, serialize }: HttpContext) {
    const { title } = await request.validateUsing(createTaskValidator)
    const user = auth.getUserOrFail()

    // El estado va explícito y no se deja al valor por defecto de la columna:
    // el modelo recién creado no vuelve a leerse de la base de datos, así que
    // ese defecto no llegaría a la respuesta.
    const task = await Task.create({ title, status: 'pending', assigneeId: user.id })
    await task.load('assignee')

    // El estado se marca aparte y el cuerpo se devuelve: `serialize()` entrega
    // una promesa que resuelve el pipeline al devolverla, y pasársela a
    // `response.created()` deja la respuesta con el cuerpo vacío.
    response.status(201)
    return serialize(TaskTransformer.transform(task))
  }
}
