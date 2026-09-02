import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Lo que cada tarea enseña de su responsable. Cubre los tres scenarios del
 * requisito «Lo que cada tarea muestra de su responsable» de
 * `openspec/specs/tasks/spec.md`: que se le identifica, que no se filtra nada
 * de su cuenta, y que una cuenta sin nombre sigue siendo representable.
 *
 * Los tres se comprueban a la vez en la lista y en la tarea suelta, porque el
 * scenario del email dice «suelta o dentro de la lista» y las dos respuestas
 * las construyen transformers distintos: una sola de las dos no demuestra nada
 * de la otra.
 *
 * El aislamiento es una transacción global, por el mismo motivo que en
 * `tests/functional/auth/`: la suite functional pega contra el mismo fichero
 * SQLite que el servidor de desarrollo.
 */
test.group('Tasks | responsable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const DIA_DE_REFERENCIA = '2026-09-02'

  /**
   * Deja creada una cuenta con una tarea a su nombre y devuelve el token de esa
   * cuenta junto al id de la tarea. La tarea se crea por la API y no a mano
   * porque es la propia creación la que decide quién es el responsable.
   */
  async function tareaDe(client: any, fullName: string | null, email: string) {
    await User.create({ fullName, email, password: 'secreto123' })

    const login = await client.post('/api/v1/auth/login').json({ email, password: 'secreto123' })
    const token = login.body().data.token as string

    const creada = await client
      .post('/api/v1/tasks')
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'Revisar el informe' })

    creada.assertStatus(201)

    return { token, id: creada.body().data.id as number }
  }

  /**
   * El responsable tal y como lo devuelven las dos lecturas del espacio, para
   * poder afirmar lo mismo de ambas sin repetir las peticiones en cada test.
   */
  async function responsableSegunCadaLectura(client: any, token: string, id: number) {
    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)
    lista.assertStatus(200)

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: DIA_DE_REFERENCIA })
      .header('Authorization', `Bearer ${token}`)
    suelta.assertStatus(200)

    const enLaLista = lista.body().data.find((tarea: any) => tarea.id === id)

    return {
      lista: enLaLista.assignee,
      suelta: suelta.body().data.assignee,
    }
  }

  test('el responsable llega con su nombre y sus iniciales', async ({ client, assert }) => {
    const { token, id } = await tareaDe(client, 'Ada Lovelace', 'ada@example.com')

    const responsable = await responsableSegunCadaLectura(client, token, id)

    for (const [lectura, assignee] of Object.entries(responsable)) {
      assert.equal(assignee.fullName, 'Ada Lovelace', `en la lectura «${lectura}»`)
      assert.equal(assignee.initials, 'AL', `en la lectura «${lectura}»`)
    }
  })

  test('el responsable no trae el email ni ningún otro dato de la cuenta', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, 'Ada Lovelace', 'ada@example.com')

    const responsable = await responsableSegunCadaLectura(client, token, id)

    for (const [lectura, assignee] of Object.entries(responsable)) {
      // Se comprueba también sobre el JSON entero: el email podría llegar bajo
      // otra clave y las aserciones por propiedad no lo verían.
      assert.notInclude(
        JSON.stringify(assignee),
        'ada@example.com',
        `el email sale en la lectura «${lectura}»`
      )
      assert.notProperty(assignee, 'email', `en la lectura «${lectura}»`)
      assert.notProperty(assignee, 'password', `en la lectura «${lectura}»`)

      // El requisito dice «ningún otro dato de esa cuenta», no solo el email:
      // lo justo para identificarlo en la lista y nada más.
      assert.deepEqual(
        Object.keys(assignee).sort(),
        ['fullName', 'id', 'initials'],
        `en la lectura «${lectura}»`
      )
    }
  })

  test('una cuenta sin nombre llega con el nombre nulo y las iniciales igualmente', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, null, 'sin-nombre@example.com')

    const responsable = await responsableSegunCadaLectura(client, token, id)

    for (const [lectura, assignee] of Object.entries(responsable)) {
      assert.isNull(assignee.fullName, `en la lectura «${lectura}»`)

      // Las iniciales tienen que seguir llegando: son lo que permite pintar a
      // esa persona sin recurrir a su email.
      assert.isString(assignee.initials, `en la lectura «${lectura}»`)
      assert.isNotEmpty(assignee.initials, `en la lectura «${lectura}»`)
      assert.notInclude(
        assignee.initials,
        '@',
        `las iniciales delatan el email en la lectura «${lectura}»`
      )
    }
  })
})
