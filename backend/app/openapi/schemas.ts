import { TASK_STATUSES } from '#models/task'
import { ApiProperty, ApiPropertyOptional } from '@foadonis/openapi/decorators'

/**
 * Las formas que la API devuelve, declaradas para el documento OpenAPI.
 *
 * Son clases y no esquemas sueltos porque así el documento las publica como
 * componentes con nombre y las respuestas las referencian con `$ref` en vez de
 * repetirlas. Describen el contrato de salida; quien lo produce sigue siendo el
 * transformer correspondiente de `app/transformers/`.
 *
 * El lado de entrada NO se declara aquí: sale de los validadores VineJS vía
 * `@ApiSchema(...)`, que no pueden desincronizarse porque son los mismos objetos
 * que validan la petición.
 */

/**
 * El responsable tal y como viaja junto a una tarea. Espejo de
 * `TaskAssigneeTransformer`, con su misma razón de ser: aquí no hay email.
 */
export class TaskAssignee {
  @ApiProperty({ type: 'integer' })
  id!: number

  @ApiProperty({
    type: 'string',
    nullable: true,
    description:
      'Nulo si la cuenta se registró sin nombre. Las iniciales siguen llegando, para que la interfaz pueda representarla sin recurrir a su email.',
  })
  fullName!: string | null

  @ApiProperty({ type: 'string', example: 'AL' })
  initials!: string
}

/**
 * Una tarea tal y como la devuelve la lista.
 *
 * Es una clase distinta de `TaskDetail` y no la misma con campos opcionales,
 * exactamente por el motivo por el que hay dos transformers: la lista no debe
 * poder enseñar el vencimiento, y la forma de garantizarlo es que el objeto que
 * devuelve no lo contenga.
 */
export class Task {
  @ApiProperty({ type: 'integer' })
  id!: number

  @ApiProperty({ type: 'string', maxLength: 200 })
  title!: string

  @ApiProperty({ enum: [...TASK_STATUSES] })
  status!: string

  @ApiProperty({ type: () => TaskAssignee })
  assignee!: TaskAssignee

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: string
}

/**
 * Una tarea con todo lo que tiene. Solo la consulta de una tarea suelta y el
 * cambio de fecha devuelven esta forma.
 */
export class TaskDetail {
  @ApiProperty({ type: 'integer' })
  id!: number

  @ApiProperty({ type: 'string', maxLength: 200 })
  title!: string

  @ApiProperty({ enum: [...TASK_STATUSES] })
  status!: string

  @ApiProperty({ type: () => TaskAssignee })
  assignee!: TaskAssignee

  @ApiProperty({
    type: 'string',
    format: 'date',
    nullable: true,
    example: '2026-09-30',
    description:
      'Un día del calendario, sin hora ni huso, o nulo si la tarea no tiene fecha. Sin fecha es el estado normal de una tarea, no un dato pendiente de rellenar.',
  })
  dueDate!: string | null

  @ApiProperty({
    type: 'boolean',
    description:
      'Resuelto por el servidor contra el `today` de la petición: hay fecha, esa fecha es anterior a ese día, y el estado no es `done`. Vencer hoy todavía no es estar vencida. Quien consume no compara fechas.',
  })
  isOverdue!: boolean

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: string

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: string
}

/**
 * El envoltorio `{ data: ... }` que pone `ApiSerializer` a toda respuesta.
 * Se declara una clase por forma envuelta porque OpenAPI no tiene genéricos.
 */
export class TaskResponse {
  @ApiProperty({ type: () => Task })
  data!: Task
}

export class TaskListResponse {
  @ApiProperty({ type: () => [Task] })
  data!: Task[]
}

export class TaskDetailResponse {
  @ApiProperty({ type: () => TaskDetail })
  data!: TaskDetail
}

/**
 * Un error suelto. `rule`, `field` y `meta` solo viajan en los `422` de VineJS;
 * un `401` o un `404` traen únicamente el mensaje.
 */
export class ApiErrorItem {
  @ApiProperty({ type: 'string' })
  message!: string

  @ApiPropertyOptional({ type: 'string', example: 'enum' })
  rule?: string

  @ApiPropertyOptional({ type: 'string', example: 'status' })
  field?: string

  @ApiPropertyOptional({
    type: 'object',
    description: 'Datos de la regla. En un `enum` trae `choices` con los valores admitidos.',
  })
  meta?: Record<string, unknown>
}

export class ErrorResponse {
  @ApiProperty({ type: () => [ApiErrorItem] })
  errors!: ApiErrorItem[]
}
