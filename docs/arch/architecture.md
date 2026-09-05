# Arquitectura de FlowSync — diagrama de contenedores

Este diagrama es el nivel 2 del modelo C4 (contenedores): las piezas que se ejecutan por
separado en FlowSync y por dónde se hablan entre ellas. Son cuatro: la **SPA de React**, que
sirve Vite en el puerto 5173 y corre entera en el navegador; el **almacenamiento del
navegador**, donde la SPA guarda el token de sesión bajo la clave `flowsync.token`; la **API
HTTP de AdonisJS**, que escucha en el 3333 y es el único sitio donde vive la lógica de
negocio; y el **fichero SQLite** `backend/tmp/db.sqlite3`, al que la API accede con Lucid.
Las flechas están etiquetadas con los endpoints reales declarados en `backend/start/routes.ts`
y consumidos desde `frontend/src/lib/api.ts` — ni más ni menos. No aparece nada que no se
pueda leer hoy en el repositorio: no hay proxy, ni caché, ni cola, ni servicios externos, y
las dos guardas de auth configuradas se dibujan como una sola porque solo la de tokens
(`api`) se usa en alguna ruta.

```mermaid
C4Container
    title Diagrama de contenedores - FlowSync

    Person(miembro, "Miembro del equipo", "Se registra, entra y gestiona las tareas del espacio compartido")

    System_Boundary(flowsync, "FlowSync") {
        Container(spa, "SPA FlowSync", "React 19, react-router 8, Tailwind v4, servida por Vite 8 en :5173", "Pantallas de login, registro, lista de tareas, detalle de tarea y perfil. Guarda la sesion en memoria y rehidrata el token contra la API al arrancar. No calcula reglas de negocio: el vencimiento se lo pregunta a la API")

        ContainerDb(storage, "Almacenamiento del navegador", "localStorage", "Una sola clave, flowsync.token, con el access token opaco. Es lo que hace que la sesion sobreviva a una recarga")

        Container(api, "API FlowSync", "AdonisJS 7, TypeScript 6, VineJS 4 en :3333", "Rutas bajo /api/v1 con controladores de una responsabilidad, validadores VineJS, modelos Lucid y transformers. Un serializer propio envuelve toda respuesta en data. Aqui vive la unica definicion de tarea vencida")

        ContainerDb(db, "Base de datos", "SQLite via better-sqlite3, fichero backend/tmp/db.sqlite3", "Tablas users, auth_access_tokens y tasks. tasks.assignee_id y auth_access_tokens.tokenable_id apuntan a users con ON DELETE CASCADE. El esquema se genera desde las migraciones")
    }

    Rel(miembro, spa, "Usa en el navegador", "HTTP :5173")

    Rel(spa, storage, "Escribe el token al entrar, lo lee al arrancar y lo borra al salir", "API de localStorage")

    Rel(spa, api, "Autenticacion: POST /auth/signup, POST /auth/login, GET /account/profile, POST /account/logout", "JSON sobre HTTP")
    Rel(spa, api, "Tareas: GET /tasks, POST /tasks, GET /tasks/:id, PATCH /tasks/:id/status, PUT /tasks/:id/due-date", "JSON sobre HTTP con Authorization Bearer")

    Rel(api, db, "Consulta y persiste usuarios, tokens y tareas; precarga el responsable de cada tarea", "Lucid 22 / SQL")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

## Lo que hay dentro de la API

Detalle verificable de la ruta que sigue una peticion, para que el diagrama no se lea como una caja negra:

| Endpoint | Controlador | Validador | Transformer |
|---|---|---|---|
| `POST /api/v1/auth/signup` | `NewAccountController.store` | `signupValidator` | `UserTransformer` |
| `POST /api/v1/auth/login` | `AccessTokensController.store` | `loginValidator` | `UserTransformer` |
| `GET /api/v1/account/profile` | `ProfileController.show` | — | `UserTransformer` |
| `POST /api/v1/account/logout` | `AccessTokensController.destroy` | — | — |
| `GET /api/v1/tasks` | `TasksController.index` | `listTasksValidator` | `TaskTransformer` + `TaskAssigneeTransformer` |
| `POST /api/v1/tasks` | `TasksController.store` | `createTaskValidator` | `TaskTransformer` |
| `GET /api/v1/tasks/:id` | `TasksController.show` | `taskReferenceDayValidator` | `TaskDetailTransformer` |
| `PATCH /api/v1/tasks/:id/status` | `TaskStatusesController.update` | `updateTaskStatusValidator` | `TaskTransformer` |
| `PUT /api/v1/tasks/:id/due-date` | `TaskDueDatesController.update` | `setTaskDueDateValidator` | `TaskDetailTransformer` |

Los grupos `account` y `tasks` van protegidos con `middleware.auth()`; `auth` es publico.
`silent_auth_middleware` y `force_json_response_middleware` corren sobre todas las peticiones
(`backend/start/kernel.ts`). Los modelos son solo dos, `User` y `Task`, relacionados por
`Task.assignee` (`belongsTo`, clave `assigneeId`).
