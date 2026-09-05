# Capability `tasks`

La lista de trabajo del equipo: **una sola lista compartida**, la misma para todo el mundo, donde apuntar algo cuesta escribir un título y donde el responsable y el estado de cada tarea se leen sin abrir nada. Es lo que permite responder «¿en qué anda cada uno?» sin preguntar a nadie.

Sobre eso hay tres cosas más: el estado se cambia desde la propia fila, cada tarea puede tener una fecha de vencimiento —o no tenerla, que es lo normal—, y la lista se puede acotar por estado.

> **La fuente de verdad de esta capability es [`openspec/specs/tasks/spec.md`](../../../openspec/specs/tasks/spec.md).** Este README es un índice: dice dónde está cada cosa, no qué debe hacer. Cuando quieras saber **qué** tiene que pasar, ve a la spec; aquí solo encontrarás el camino hasta ella y hasta el código. Si alguna vez este documento y la spec no coinciden, manda la spec — ver [ADR 0001](../../adr/0001-openspec-como-fuente-de-verdad.md).

## Endpoints

Todos bajo `/api/v1`, todos con `Authorization: Bearer <token>` obligatorio (`start/routes.ts` aplica `middleware.auth()` al grupo entero).

| Método | Ruta | Controlador | Devuelve |
|---|---|---|---|
| `GET` | `/api/v1/tasks` | `TasksController.index` | La lista. Sin `?status=` da lo pendiente y lo que está en curso; **no** «todas» |
| `POST` | `/api/v1/tasks` | `TasksController.store` | `201` con la tarea creada |
| `GET` | `/api/v1/tasks/:id` | `TasksController.show` | Una tarea con su fecha y su condición de vencida. Exige `?today=AAAA-MM-DD` |
| `PATCH` | `/api/v1/tasks/:id/status` | `TaskStatusesController.update` | La tarea con su nuevo estado |
| `PUT` | `/api/v1/tasks/:id/due-date` | `TaskDueDatesController.update` | La tarea con su fecha ya actualizada |

El estado y la fecha tienen controlador propio en vez de colgar de un `update` genérico: por ahí se colarían el título y el responsable, que hoy no se pueden tocar.

**La forma exacta de cada petición y cada respuesta no se copia aquí.** El servidor la publica, generada del propio código: arranca el backend y abre **<http://localhost:3333/api>** (interfaz Scalar), o pide el documento en **`/api.json`** / **`/api.yaml`**. Los parámetros, los códigos y los esquemas salen de los decoradores de los controladores y de los validadores VineJS, así que no pueden desincronizarse de lo que la API hace.

## Reglas de negocio

Cada regla es un requisito de la spec. **La tabla no las enuncia: las nombra y las enlaza**, y dice en qué punto del código se decide cada una. Para leer la regla, sigue el enlace.

### Del sistema

| Regla | Dónde se decide |
|---|---|
| [Creación de una tarea con solo el título](../../../openspec/specs/tasks/spec.md#requirement-creación-de-una-tarea-con-solo-el-título) | `backend/app/controllers/tasks_controller.ts` → `store()` |
| [Ninguna tarea sin título](../../../openspec/specs/tasks/spec.md#requirement-ninguna-tarea-sin-título) | `backend/app/validators/task.ts` → `createTaskValidator` (`trim()` antes de `minLength(1)`) |
| [Aviso ante un título demasiado largo](../../../openspec/specs/tasks/spec.md#requirement-aviso-ante-un-título-demasiado-largo) | `backend/app/validators/task.ts` → `createTaskValidator` (`maxLength(200)`) |
| [Una sola lista compartida del espacio](../../../openspec/specs/tasks/spec.md#requirement-una-sola-lista-compartida-del-espacio) | `backend/app/controllers/tasks_controller.ts` → `index()` |
| [Lo que cada tarea muestra de su responsable](../../../openspec/specs/tasks/spec.md#requirement-lo-que-cada-tarea-muestra-de-su-responsable) | `backend/app/transformers/task_assignee_transformer.ts` |
| [Tres estados fijos](../../../openspec/specs/tasks/spec.md#requirement-tres-estados-fijos) | `backend/app/models/task.ts` → `TASK_STATUSES`, y `backend/database/schema_rules.ts` |
| [Cambio de estado de cualquier tarea](../../../openspec/specs/tasks/spec.md#requirement-cambio-de-estado-de-cualquier-tarea) | `backend/app/controllers/task_statuses_controller.ts` |
| [Las tareas exigen sesión](../../../openspec/specs/tasks/spec.md#requirement-las-tareas-exigen-sesión) | `backend/start/routes.ts` → `.use(middleware.auth())` sobre el grupo |
| [Fecha de vencimiento opcional](../../../openspec/specs/tasks/spec.md#requirement-fecha-de-vencimiento-opcional) | `backend/database/migrations/*_add_due_date_to_tasks_table.ts` y `schema_rules.ts` |
| [Fijar, cambiar y retirar la fecha de vencimiento](../../../openspec/specs/tasks/spec.md#requirement-fijar-cambiar-y-retirar-la-fecha-de-vencimiento) | `backend/app/controllers/task_due_dates_controller.ts` |
| [Cuándo una tarea está vencida](../../../openspec/specs/tasks/spec.md#requirement-cuándo-una-tarea-está-vencida) | `backend/app/models/task.ts` → `isOverdueOn()` — **la única definición del sistema** |
| [El día de referencia lo pone quien mira](../../../openspec/specs/tasks/spec.md#requirement-el-día-de-referencia-lo-pone-quien-mira) | `backend/app/validators/task.ts` → `taskReferenceDayValidator`, `setTaskDueDateValidator` |
| [Consulta de una tarea suelta](../../../openspec/specs/tasks/spec.md#requirement-consulta-de-una-tarea-suelta) | `backend/app/controllers/tasks_controller.ts` → `show()` |
| [La lista no lleva el vencimiento](../../../openspec/specs/tasks/spec.md#requirement-la-lista-no-lleva-el-vencimiento) | `task_transformer.ts` frente a `task_detail_transformer.ts`: son dos, y por eso la lista no puede enseñarlo |
| [Acotar la lista por estado](../../../openspec/specs/tasks/spec.md#requirement-acotar-la-lista-por-estado) | `backend/app/controllers/tasks_controller.ts` → `index()` y `listTasksValidator` |
| [Un filtro válido sin resultados es una lista vacía legítima](../../../openspec/specs/tasks/spec.md#requirement-un-filtro-válido-sin-resultados-es-una-lista-vacía-legítima) | `backend/app/controllers/tasks_controller.ts` → `index()` |
| [Un estado que no existe se rechaza, no se responde vacío](../../../openspec/specs/tasks/spec.md#requirement-un-estado-que-no-existe-se-rechaza-no-se-responde-vacío) | `backend/app/validators/task.ts` → `listTasksValidator` (`vine.enum`) |

### De la interfaz

| Regla | Dónde se decide |
|---|---|
| [Pantalla de la lista del equipo](../../../openspec/specs/tasks/spec.md#requirement-pantalla-de-la-lista-del-equipo) | `frontend/src/pages/tasks-page.tsx` |
| [El espacio sin tareas](../../../openspec/specs/tasks/spec.md#requirement-el-espacio-sin-tareas) | `frontend/src/pages/tasks-page.tsx` |
| [Crear una tarea desde la lista](../../../openspec/specs/tasks/spec.md#requirement-crear-una-tarea-desde-la-lista) | `frontend/src/pages/tasks-page.tsx` |
| [Aviso al intentar crear sin un título válido](../../../openspec/specs/tasks/spec.md#requirement-aviso-al-intentar-crear-sin-un-título-válido) | `frontend/src/pages/tasks-page.tsx` y `src/lib/api.ts` (traducción del error) |
| [Cambiar el estado desde la propia fila](../../../openspec/specs/tasks/spec.md#requirement-cambiar-el-estado-desde-la-propia-fila) | `frontend/src/components/task-item.tsx` (el control) y `tasks-page.tsx` (la llamada) |
| [Una sola vista de tareas, sin señales de presencia](../../../openspec/specs/tasks/spec.md#requirement-una-sola-vista-de-tareas-sin-señales-de-presencia) | `frontend/src/routes/app-routes.tsx` — se cumple por lo que **no** hay |
| [Pantalla de una tarea](../../../openspec/specs/tasks/spec.md#requirement-pantalla-de-una-tarea) | `frontend/src/pages/task-page.tsx` |
| [Poner y quitar la fecha desde la pantalla de la tarea](../../../openspec/specs/tasks/spec.md#requirement-poner-y-quitar-la-fecha-desde-la-pantalla-de-la-tarea) | `frontend/src/pages/task-page.tsx` |
| [Aviso ante una fecha que no vale](../../../openspec/specs/tasks/spec.md#requirement-aviso-ante-una-fecha-que-no-vale) | `frontend/src/pages/task-page.tsx` y `src/lib/api.ts` |
| [La señal de tarea vencida](../../../openspec/specs/tasks/spec.md#requirement-la-señal-de-tarea-vencida) | `frontend/src/pages/task-page.tsx` |
| [No tener fecha no se penaliza](../../../openspec/specs/tasks/spec.md#requirement-no-tener-fecha-no-se-penaliza) | `frontend/src/pages/task-page.tsx` y `components/task-item.tsx` |
| [El control para acotar la lista](../../../openspec/specs/tasks/spec.md#requirement-el-control-para-acotar-la-lista) | `frontend/src/components/task-filter.tsx` |
| [El filtro se pide en la dirección de la lista](../../../openspec/specs/tasks/spec.md#requirement-el-filtro-se-pide-en-la-dirección-de-la-lista) | `frontend/src/pages/tasks-page.tsx` → `useSearchParams` |
| [Una lista sin filas no significa siempre lo mismo](../../../openspec/specs/tasks/spec.md#requirement-una-lista-sin-filas-no-significa-siempre-lo-mismo) | `frontend/src/pages/tasks-page.tsx` |
| [Lo que sale de la vista no se pierde](../../../openspec/specs/tasks/spec.md#requirement-lo-que-sale-de-la-vista-no-se-pierde) | `frontend/src/pages/tasks-page.tsx` |

## Cómo se prueba en local

### Levantarlo

```bash
# backend, en http://localhost:3333
cd backend
npm install
cp .env.example .env && node ace generate:key   # solo la primera vez
node ace migration:run                          # crea tmp/db.sqlite3 y regenera database/schema.ts
npm run dev

# frontend, en http://localhost:5173
cd frontend
npm install
npm run dev
```

### La suite automática

```bash
cd backend
node ace test                       # las dos suites
node ace test --files=assignee      # solo el fichero de tasks
```

**Lo que hay que saber antes de fiarse:** de los 23 tests del proyecto, `tasks` tiene **tres**, todos en `tests/functional/tasks/assignee.spec.ts`, y cubren un único requisito —[Lo que cada tarea muestra de su responsable](../../../openspec/specs/tasks/spec.md#requirement-lo-que-cada-tarea-muestra-de-su-responsable). Los otros 31 requisitos **no tienen ni un test**. El frontend no tiene runner instalado, así que las 15 reglas de interfaz solo se comprueban a mano.

Ojo también con la base de datos: `config/database.ts` define una sola conexión SQLite a `tmp/db.sqlite3` sin override por entorno, así que las suites functional escriben en **el mismo fichero** que el servidor de desarrollo. Si añades tests que escriben, aísla con los hooks de `testUtils.db()`.

### A mano, contra el servidor

Con el backend arrancado. Primero un token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3333/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Ada Lovelace","email":"ada@flowsync.test","password":"contrasena8","passwordConfirmation":"contrasena8"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
```

Y después los caminos que más se rompen:

```bash
# crear, listar y acotar
curl -s -X POST http://localhost:3333/api/v1/tasks -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"Revisar el informe"}'
curl -s "http://localhost:3333/api/v1/tasks" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3333/api/v1/tasks?status=done" -H "Authorization: Bearer $TOKEN"

# los dos vacíos que NO significan lo mismo: 422 con error de campo vs 200 con lista vacía
curl -s -w " [%{http_code}]\n" "http://localhost:3333/api/v1/tasks?status=archivado" -H "Authorization: Bearer $TOKEN"
curl -s -w " [%{http_code}]\n" "http://localhost:3333/api/v1/tasks?status=in_progress" -H "Authorization: Bearer $TOKEN"

# el día de referencia es obligatorio: sin él, 422 y no el reloj del servidor
curl -s -w " [%{http_code}]\n" "http://localhost:3333/api/v1/tasks/1" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3333/api/v1/tasks/1?today=$(date +%F)" -H "Authorization: Bearer $TOKEN"

# fijar y retirar la fecha
curl -s -X PUT "http://localhost:3333/api/v1/tasks/1/due-date" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"today\":\"$(date +%F)\",\"dueDate\":\"2020-01-01\"}"
curl -s -X PUT "http://localhost:3333/api/v1/tasks/1/due-date" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"today\":\"$(date +%F)\",\"dueDate\":null}"
```

El penúltimo debe devolver `isOverdue: true` y el último `isOverdue: false` con `dueDate: null`. Y los dos vacíos deben diferenciarse: `422` señalando el campo `status` frente a `200` con `{"data": []}`.

### Antes de dar algo por terminado

```bash
cd backend  && npm run lint && npm run format && npm run typecheck && node ace test
cd frontend && npm run lint && npm run build   # el typecheck del frontend vive dentro de build
```

## Mapa del código

**Backend**

- `app/controllers/tasks_controller.ts`, `task_statuses_controller.ts`, `task_due_dates_controller.ts`
- `app/models/task.ts` — `TASK_STATUSES`, `DEFAULT_LIST_STATUSES`, `isOverdueOn()`
- `app/validators/task.ts` — los cinco validadores y `toCalendarDay()`
- `app/transformers/task_transformer.ts`, `task_detail_transformer.ts`, `task_assignee_transformer.ts`
- `app/openapi/schemas.ts` — las formas que publica el documento OpenAPI
- `database/migrations/*_create_tasks_table.ts`, `*_add_due_date_to_tasks_table.ts`, y `database/schema_rules.ts`
- `start/routes.ts` — el grupo `tasks`

**Frontend**

- `src/pages/tasks-page.tsx`, `src/pages/task-page.tsx`
- `src/components/task-item.tsx`, `src/components/task-filter.tsx`
- `src/lib/api.ts` — `listTasks`, `createTask`, `getTask`, `updateTaskStatus`, `setTaskDueDate`
- `src/lib/types.ts` — espejo de los transformers del backend

**Historia**

Los tres changes que construyeron esta capability, con su porqué y sus alternativas descartadas, están en `openspec/changes/archive/`: `add-task-list`, `add-task-status-filter` y `add-task-due-date`.
