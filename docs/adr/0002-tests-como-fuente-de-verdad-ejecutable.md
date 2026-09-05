# 2. Los tests de integración como única fuente de verdad ejecutable

## Contexto

El [ADR 0001](./0001-openspec-como-fuente-de-verdad.md) puso `openspec/specs/` como fuente de verdad viva, y la decisión se ganó su sitio: el escenario *El error no se confunde con la ausencia* fue lo que zanjó que un `GET /api/v1/tasks?status=archivado` respondiendo `200` con lista vacía era un defecto y no una alternativa legítima. La spec funcionó como oráculo.

Pero ese mismo ADR registró, en sus consecuencias, el coste que ha acabado decidiendo este: **nada comprobaba que la spec fuera verdad**. El `422` estaba escrito desde el 2026-08-13 y el código devolvía `200` hasta el 2026-09-05. Veintitrés días en los que la fuente de verdad decía una cosa y el sistema hacía otra, con la suite en verde y sin que nada fallara. La spec era la autoridad por acuerdo, no por mecanismo, y un acuerdo no se entera de nada.

Los demás costes que 0001 anotó no se corrigieron solos en el año siguiente:

- El orden en que hay que aplicar los deltas para reconstruir la spec seguía sin estar guardado en ninguna parte legible por máquina.
- `auth` seguía sin genealogía: 15 de sus 19 requisitos sin ningún change que los introdujera.
- `docs/backlog/` seguía reclamando autoridad sobre el mismo comportamiento, sin que nada arbitrara.
- Cada cambio seguía pagando por adelantado el coste de escribir el delta, y `MODIFIED` seguía siendo opaco en el diff.

Lo que sí cambió es el otro lado. La suite de integración salió de donde estaba en septiembre de 2026 —23 tests, todos de `auth` salvo uno de `tasks`, y ni un runner instalado en el frontend— y pasó a cubrir el comportamiento de las capabilities, a correr en integración continua y a bloquear la entrega cuando algo se rompe.

Eso reordena la pregunta. Ya no es cuál de los dos artefactos tiene autoridad sobre el comportamiento, sino **cuál de los dos se entera cuando el sistema deja de cumplirlo**. Un requisito incumplido nunca ha parado un merge; un test en rojo sí. Mantener los dos significa mantener dos descripciones del mismo comportamiento, de las cuales solo una se ejecuta, y pagar por la que no.

## Decisión

**Los tests de integración son la única fuente de verdad ejecutable de FlowSync. Un comportamiento que no tenga un test que lo sostenga no es un requisito: es una intención.**

En concreto:

1. **`openspec/specs/` se congela, no se borra.** Deja de mantenerse y pasa a ser documento histórico, igual que `openspec/changes/archive/`. Se marca como congelada en su cabecera con la fecha y un enlace a este ADR, para que nadie la lea creyendo que describe el sistema de hoy.
2. **Cambiar el comportamiento es cambiar su test, en el mismo commit que el código.** No hay artefacto que escribir antes ni después: la especificación y la implementación entran juntas o no entran.
3. **El vocabulario se conserva.** Cada test que herede un escenario de la spec congelada lo cita por su nombre, para que la genealogía sobreviva al cambio de formato y `El error no se confunde con la ausencia` siga siendo algo que se puede nombrar en una discusión.
4. **Lo que ningún test puede sostener se declara, no se calla.** Los requisitos de ausencia y los de interfaz que no lleguen a tener cobertura se recogen en una lista explícita de *lo que dejamos de garantizar*, con su motivo. Dejar de comprobarlos es una decisión; dejar de mencionarlos sería un descuido.
5. **`docs/prd/` y `docs/backlog/` siguen siendo origen, no autoridad**, igual que bajo 0001. Lo que cambia es con quién compiten.
6. **El porqué se muda a dos sitios:** los ADR para las decisiones estructurales, y los comentarios del propio test para lo que un `assert` no explica por sí solo.

## Estado

Aceptada el 2027-09-05. Reemplaza al [ADR 0001](./0001-openspec-como-fuente-de-verdad.md).

*Nota de honestidad: este documento se redactó el 2026-09-05 como escenario, para ensayar cómo se registraría el relevo. Recoge la decisión tal y como se tomaría, no una que ya se haya tomado; el contexto anterior a septiembre de 2026 está verificado contra el repositorio, y lo posterior es la premisa del ejercicio.*

## Consecuencias

### Lo que ganamos

- **La fuente de verdad no puede mentir sin que se note.** Es la diferencia entera respecto a 0001: veintitrés días de divergencia silenciosa dejan de ser posibles, porque la divergencia es lo que hace fallar la suite.
- **Un artefacto en vez de dos.** Se acaba el trabajo de mantener sincronizadas una prosa y un código que describen lo mismo, y con él la clase de fallo que consistía en actualizar solo uno.
- **El coste se paga cuando toca.** Ni antes, escribiendo el delta de algo que aún puede cambiar, ni después, documentando comportamiento ya entregado —que es como se abrió la ventana en que la spec mintió a sabiendas.
- **Cambiar de opinión es barato.** Rectificar un comportamiento es editar su test, no reescribir un requisito entero con todos sus escenarios para cambiar una frase.
- **Desaparece la fragilidad del orden.** No hay deltas que aplicar en una secuencia que el archivo no guarda: el estado del sistema es el estado de la suite en ese commit.

### Lo que nos cuesta

- **Los requisitos de ausencia se quedan sin quien los sostenga.** 19 de los 32 requisitos de `tasks` contienen una prohibición. Un test no demuestra que algo no exista: puede comprobar que la lista no acepta filtrar por responsable, pero no que no haya ninguna vista de «mis tareas» en ninguna parte, ni que el catálogo de estados no se pueda ampliar, ni que la lista no muestre señales de presencia. Esos requisitos pasan de norma escrita a costumbre, y las costumbres se pierden con la gente.
- **La mitad de `tasks` es interfaz.** 15 de sus 32 requisitos empiezan por «La interfaz SHALL». En septiembre de 2026 el frontend no tenía ni runner de tests. Esta decisión obliga a adoptar uno y sostenerlo, o a aceptar que esos 15 requisitos dejan de estar escritos en ningún sitio que se ejecute —y son justo los que describen lo que ve quien usa el producto.
- **La cobertura pasa a definir el contrato.** Al decidir que sin test no hay requisito, cada hueco de la suite recorta el producto en silencio. La spec al menos afirmaba cosas que nadie comprobaba; a partir de aquí, lo que nadie comprueba deja de afirmarse.
- **Un test puede consagrar el bug.** Si el test del filtro se hubiera escrito contra lo que el código hacía entonces —`200` con lista vacía—, el defecto habría pasado a ser la especificación, y en verde. La spec podía equivocarse sobre el código; el test puede equivocarse sobre la intención, y encima lo hará con la autoridad de estar pasando.
- **Se pierde la prosa que decía por qué.** «Pedir algo que no existe y no encontrar nada SHALL ser distinguible desde fuera» es una norma con su razón dentro. El `assert` que la comprueba no la explica. Parte se recupera en comentarios, pero el registro deja de ser legible para quien no programa: el PRD y el backlog se quedan sin puente hacia lo que el sistema hace de verdad.
- **Se acaba la genealogía.** El archivo de changes se conserva, pero deja de crecer. Las alternativas descartadas y los «fuera de alcance a propósito» que hoy viven en los `proposal.md` se quedan sin sitio, salvo que se escriba un ADR por cada decisión de ese tamaño —y no se va a hacer.
- **La verdad queda rehén de la implementación.** Un refactor arrastra sus tests. Cuando el código y su especificación cambian en el mismo commit y por la misma mano, ya no hay nada externo que diga cuál de los dos estaba bien. Esa independencia era precisamente lo que hacía útil a la spec el día que encontró el `422`.
- **Volver atrás es mucho más caro que llegar aquí.** Reconstruir una especificación en prosa a partir de una suite de tests es bastante más difícil que lo contrario. Esta decisión es notablemente menos reversible que la que reemplaza.
- **Y no arregla el solape que 0001 dejó abierto.** `docs/backlog/` seguirá describiendo el mismo comportamiento con otras palabras y sin nada que lo arbitre.
