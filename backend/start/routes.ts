/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import openapi from '@foadonis/openapi/services/main'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('/', [controllers.Tasks, 'index'])
        router.post('/', [controllers.Tasks, 'store'])
        router.get(':id', [controllers.Tasks, 'show'])
        router.patch(':id/status', [controllers.TaskStatuses, 'update'])
        router.put(':id/due-date', [controllers.TaskDueDates, 'update'])
      })
      .prefix('tasks')
      .as('tasks')
      .use(middleware.auth())
  })
  .prefix('/api/v1')

/**
 * La documentación de la API: el documento OpenAPI y la interfaz que lo pinta.
 *
 * Se registra sin argumentos, que es la llamada que documenta el paquete. El
 * grupo cuelga de `/api` y no de `/api/v1` a propósito: el documento describe la
 * API entera, incluidas las versiones que vengan, así que versionarlo junto a
 * las rutas lo dejaría desfasado en cuanto exista una v2.
 *
 * Va fuera del grupo de arriba y sin `middleware.auth()`: una documentación que
 * exige un token para leerse no la lee quien más la necesita, que es quien
 * todavía no sabe cómo conseguir uno.
 */
openapi.registerRoutes()
