# 1. Las delta-specs de OpenSpec como fuente de verdad viva

## Contexto

FlowSync tiene hoy tres sitios donde alguien podría buscar «qué debe hacer el sistema», y los tres existen de verdad en el repositorio:

- `docs/prd/` — el problema y el alcance consensuado del MVP, cerrados el 2026-08-07.
- `docs/backlog/` — las historias de usuario con sus criterios de aceptación. Su `README.md` ya reclama autoridad: «el artefacto que dirige la implementación es el de este repositorio: los criterios de aceptación».
- `openspec/` — dos specs vivas y tres changes archivados.

`openspec/config.yaml` declara `schema: spec-driven` y nada más: las secciones de contexto, reglas por artefacto y guía por operación están todas comentadas, tal como las dejó el configurador.

**Lo que hay en `openspec/specs/`** son dos capabilities, escritas en RFC 2119 (`SHALL` / `NO SHALL`) con escenarios `WHEN`/`THEN`, que cubren tanto la API como la interfaz:

| Capability | Requisitos | Escenarios | Líneas |
|---|---|---|---|
| `auth` | 19 | 45 | 307 |
| `tasks` | 32 | 124 | 753 |

**Lo que hay en `openspec/changes/archive/`** son tres changes, los tres fechados el 2026-08-13: `add-task-list`, `add-task-status-filter` y `add-task-due-date`. Cada uno lleva cinco artefactos: `.openspec.yaml` (esquema y fecha), `proposal.md` (el porqué, lo que cambia y lo que queda **fuera** de alcance a propósito), `design.md` (las decisiones técnicas numeradas, con riesgos y trade-offs), `tasks.md` (la lista de trabajo con casillas) y `specs/<capability>/spec.md` — el **delta**.

El delta es el mecanismo del que trata este ADR. No es un parche de texto: son requisitos completos bajo dos cabeceras, `## ADDED Requirements` y `## MODIFIED Requirements`. Un requisito modificado se **reescribe entero, con todos sus escenarios**, y sustituye al que había. Así, cuando `add-task-status-filter` hizo que la vista por defecto dejara de ser «todas», no añadió una excepción: reescribió el requisito *Una sola lista compartida del espacio*, que afirmaba lo contrario, y con él otros tres que esa misma verdad volvía falsos.

Esa mecánica deja una propiedad comprobable, y la comprobé simulando la aplicación de los tres deltas:

| Capability | ADDED en el archivo | MODIFIED en el archivo | Requisitos en la spec viva |
|---|---|---|---|
| `tasks` | 14 + 7 + 11 = **32** | 5 | **32** |
| `auth` | 1 | 3 | **19** |

La spec viva de `tasks` es **exactamente** lo que sale de aplicar los tres deltas: los mismos 32 requisitos, los mismos 124 escenarios, ninguna diferencia. Se puede reconstruir desde cero y cada requisito tiene un change que dice por qué existe.

Con una condición que no es menor: **solo cuadra en un orden**, `add-task-list` → `add-task-due-date` → `add-task-status-filter`. En el otro orden posible salen 122 escenarios y un requisito distinto del vivo. Y ese orden no es el que uno supondría: el filtro por estado se implementó **antes** que el vencimiento —el `design.md` de `add-task-due-date` ya describe la lista «que desde FS-142 se acota por estado»—, pero se **especificó después**. El propio `proposal.md` de `add-task-due-date` lo deja escrito: la spec viva describía entonces `GET /api/v1/tasks` como «todas las tareas del espacio», «que dejó de ser cierto cuando se implementó el filtro por estado (FS-142) sin actualizar `openspec/`». De ahí que su reescritura de *Una sola vista de tareas, sin señales de presencia* no incluya los dos escenarios del filtro: cuando se escribió, el filtro no estaba en la spec. Los tres `.openspec.yaml` dicen `created: 2026-08-13` y los directorios ordenan alfabéticamente en otra secuencia, así que el orden correcto solo se deduce leyendo la prosa.

Hay además un antecedente que pesa más que la teoría. Al contrastar el documento OpenAPI recién generado contra `specs/tasks/spec.md` apareció un fallo real: `GET /api/v1/tasks?status=archivado` respondía `200` con lista vacía en vez de `422`, de modo que «lo que has pedido no existe» y «no hay nada de eso» eran indistinguibles desde fuera. El requisito *Un estado que no existe se rechaza, no se responde vacío* y su escenario *El error no se confunde con la ausencia* fueron los que zanjaron que aquello era un bug y no una alternativa legítima. La spec funcionó como oráculo, no como documentación.

## Decisión

**`openspec/specs/` es la fuente de verdad viva de FlowSync: lo que dice un requisito es lo que el sistema debe hacer, y cualquier desacuerdo entre el código y la spec es un defecto hasta que un change diga lo contrario.**

En concreto:

1. **Las specs vivas no se editan a mano.** Cambian solo por aplicación de un delta en `openspec/changes/<id>/specs/<capability>/spec.md`.
2. **Todo cambio de comportamiento pasa por un change**, incluso —como ya ocurrió con `add-task-status-filter` y `add-task-due-date`— cuando el código ya está escrito y lo que falta es la especificación.
3. **Un requisito que deja de ser cierto se reescribe entero bajo `## MODIFIED Requirements`**, nunca se contradice desde otro sitio. La spec viva no puede contener dos requisitos que se lleven la contraria.
4. **El change se archiva con sus cinco artefactos**, y el archivo no se reescribe: es el registro de por qué el sistema es como es, incluidas las decisiones de no hacer algo.
5. **`docs/prd/` y `docs/backlog/` quedan como origen, no como autoridad.** El PRD dice qué problema resolvemos y las historias qué se pidió; la spec dice qué hace el sistema. Cuando una historia y un requisito no coincidan, manda el requisito, y la discrepancia se resuelve escribiendo un change —no editando la historia a posteriori.
6. **Ante una duda de comportamiento se cita el escenario**, por su nombre, igual que se citó *El error no se confunde con la ausencia*.

## Estado

**Reemplazada el 2027-09-05 por [2. Los tests de integración como única fuente de verdad ejecutable](./0002-tests-como-fuente-de-verdad-ejecutable.md).** Lo que sigue es el estado que tuvo mientras estuvo vigente, y se conserva sin tocar: el contexto y la decisión de abajo son lo que se creía y se decidió entonces.

Aceptada el 2026-09-05.

Es un registro *a posteriori*: la práctica lleva vigente desde los tres changes del 2026-08-13, y este ADR la hace explícita en vez de introducirla. Queda pendiente reflejarla en `CLAUDE.md`, que hoy no menciona `openspec/` en ninguna parte.

## Consecuencias

### Lo que ganamos

- **Historia reconstruible, y verificada.** Para `tasks` no hay que creerse nada: aplicar los tres deltas devuelve la spec viva clavada, 32 requisitos y 124 escenarios. De cada requisito se puede rastrear el change que lo introdujo o lo cambió, con el `proposal.md` que explica por qué.
- **Un oráculo, no documentación.** Un escenario con `WHEN`/`THEN` resuelve discusiones. Ya lo hizo una vez, y el resultado fue un bug corregido en vez de una opinión.
- **La spec no acumula mentiras.** Reescribir el requisito entero obliga a enfrentarse a lo que deja de ser cierto en el momento de cambiarlo. La alternativa habitual —añadir el comportamiento nuevo y dejar el viejo requisito ahí— es exactamente cómo una spec se vuelve papel mojado.
- **Las decisiones de no hacer quedan escritas.** Que no haya tests de `tasks`, que la lista viva no exista, que no se pueda filtrar por responsable: los `proposal.md` los recogen como decisiones explícitas con su motivo, así que nadie los reabre creyendo que fueron un descuido.
- **La deriva conocida se declara.** Cuando `add-task-due-date` se escribió sabiendo que la spec ya no describía el sistema, lo anotó en su propuesta en vez de callarlo. El formato deja sitio para decir «esto que vas a leer ya no es cierto».

### Lo que nos cuesta

- **Reconstruir depende de un orden que el archivo no guarda.** Los tres changes dicen `created: 2026-08-13`, sus directorios ordenan alfabéticamente en una secuencia distinta de la buena, y el orden que hace cuadrar la spec no es el orden en que se implementó el comportamiento. Aplicados en el otro orden se pierden dos escenarios —*El estado es la única dimensión* y *El filtro es una lente mía*— sin que nada falle ni avise. La propiedad más valiosa de esta decisión se sostiene hoy sobre leerse la prosa de los `design.md`.
- **Especificar después de implementar hace que la spec mienta durante un rato, y se sabe.** Entre que el filtro se implementó y que se especificó, la spec viva afirmaba que la lista devolvía «todas las tareas del espacio». Estaba escrito, se sabía, y aun así fue el estado del repositorio durante ese tiempo. El flujo no impide esa ventana: solo obliga a documentarla.
- **Nada comprueba que la spec sea verdad.** El `422` del filtro llevaba escrito en la spec desde el 2026-08-13 y el código devolvía `200` hasta el 2026-09-05. La spec es la fuente de verdad por acuerdo, no por mecanismo: no hay ni un test que ate un escenario a su comportamiento, y en el frontend no hay siquiera runner de tests para intentarlo.
- **La reconstruibilidad es de `tasks`, no del repositorio.** 15 de los 19 requisitos de `auth` no tienen ningún change que los introdujera: la capability venía hecha del punto de partida y solo se tocó de refilón. Presentar «la spec se reconstruye desde el archivo» como propiedad del proyecto sería falso, y quien vaya a `auth` buscando el porqué de un requisito no lo va a encontrar.
- **Dos artefactos reclaman autoridad, y nadie arbitra automáticamente.** `docs/backlog/README.md` dice que mandan los criterios de aceptación; este ADR dice que mandan los requisitos. Se solapan en contenido y pueden separarse en cualquier momento sin que nada avise. Esta decisión pone orden entre ellos, pero no elimina el solape: seguimos manteniendo dos descripciones del mismo comportamiento.
- **`MODIFIED` es caro y opaco en el diff.** Cambiar una frase obliga a copiar el requisito entero con todos sus escenarios, y el delta no enseña qué cambió dentro: hay que compararlo a mano con la versión viva. Es justo lo que escondió que `add-task-due-date` se dejara dos escenarios por el camino.
- **Peso.** 1.060 líneas de spec viva para un backend de seis controladores. Cada cambio de comportamiento paga por adelantado el coste de escribir el delta, y ese coste no baja con el tamaño del cambio: documentar que un campo pasa a ser opcional cuesta casi lo mismo que documentar una capability nueva.
- **Archivado no significa terminado.** Los changes archivados conservan 9 casillas sin marcar, todas de verificación manual. El archivo registra la intención y el diseño con fidelidad; el estado real de la comprobación, no.
- **Se depende de una herramienta y de su convención.** El valor está en el formato —`ADDED`/`MODIFIED`, requisitos completos, escenarios `WHEN`/`THEN`—, pero el flujo lo conducen las skills de OpenSpec. Si se dejan de usar, nada impide que alguien edite `openspec/specs/` a mano y rompa en un commit la propiedad que justifica todo esto.
