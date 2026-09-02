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
 * Por eso cada test afirma sobre las dos lecturas **de una vez** en lugar de
 * repetir la aserción dentro de un bucle: una aserción por lectura corta el
 * test en la primera que falle y deja la otra sin ejecutar, que es justo la
 * comparación que se ha venido a hacer.
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
    login.assertStatus(200)
    const token = login.body().data.token as string

    const creada = await client
      .post('/api/v1/tasks')
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'Revisar el informe' })

    creada.assertStatus(201)

    return { token, id: creada.body().data.id as number }
  }

  /**
   * El responsable de esa tarea según cada una de las dos lecturas del espacio,
   * emparejado con el nombre de la lectura para que el fallo diga cuál de las
   * dos es la que incumple.
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
    if (!enLaLista) {
      throw new Error(`la tarea ${id} no aparece en la lista del espacio`)
    }

    return [
      ['lista', enLaLista.assignee],
      ['suelta', suelta.body().data.assignee],
    ] as Array<[string, any]>
  }

  test('el responsable llega con su nombre y sus iniciales', async ({ client, assert }) => {
    const { token, id } = await tareaDe(client, 'Ada Lovelace', 'ada@example.com')

    const lecturas = await responsableSegunCadaLectura(client, token, id)

    assert.deepEqual(
      lecturas.map(([lectura, assignee]) => [lectura, assignee.fullName, assignee.initials]),
      [
        ['lista', 'Ada Lovelace', 'AL'],
        ['suelta', 'Ada Lovelace', 'AL'],
      ]
    )
  })

  test('el responsable no trae el email ni ningún otro dato de la cuenta', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, 'Ada Lovelace', 'ada@example.com')

    const lecturas = await responsableSegunCadaLectura(client, token, id)

    // El requisito dice «ningún otro dato de esa cuenta», no solo el email, así
    // que se fija la forma entera y no la ausencia de una lista de sospechosos:
    // añadir un campo aquí tiene que ser una decisión, no un descuido.
    //
    // Va antes que la comprobación del email porque es la más ancha de las dos.
    // Las claves se comparan como una sola cadena y no como listas: el diff de
    // la aserción recorta cualquier lista de más de un elemento a «…(2)», y el
    // fallo dejaría de decir qué campo sobra ni en cuál de las dos lecturas.
    assert.equal(
      lecturas
        .map(([lectura, assignee]) => `${lectura}: ${Object.keys(assignee).sort().join(', ')}`)
        .join(' | '),
      'lista: fullName, id, initials | suelta: fullName, id, initials'
    )

    // Se busca sobre el JSON entero y no por la clave `email`: el email podría
    // llegar bajo otro nombre y una aserción por propiedad no lo vería.
    assert.deepEqual(
      lecturas
        .filter(([, assignee]) => JSON.stringify(assignee).includes('ada@example.com'))
        .map(([lectura]) => lectura),
      [],
      'lecturas que filtran el email del responsable'
    )
  })

  test('una cuenta sin nombre llega con el nombre nulo y las iniciales igualmente', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, null, 'sin-nombre@example.com')

    const lecturas = await responsableSegunCadaLectura(client, token, id)

    assert.deepEqual(
      lecturas.map(([lectura, assignee]) => [lectura, assignee.fullName]),
      [
        ['lista', null],
        ['suelta', null],
      ]
    )

    // De las iniciales, aquí solo se exige que lleguen y que basten para pintar
    // a esa persona sin recurrir a su email. Cómo se derivan es el requisito
    // «Iniciales de la cuenta» de auth, y lo cubre `auth/initials.spec.ts`.
    assert.deepEqual(
      lecturas
        .filter(
          ([, assignee]) =>
            typeof assignee.initials !== 'string' ||
            assignee.initials === '' ||
            assignee.initials.includes('@')
        )
        .map(([lectura]) => lectura),
      [],
      'lecturas cuyas iniciales no sirven para representar a la cuenta'
    )
  })
})
