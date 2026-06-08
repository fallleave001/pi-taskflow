<div align="center">

<img src="./assets/hero.png" alt="pi-taskflow — orquestación DAG declarativa para subagentes de Pi: stateful, reanudable, contexto aislado" width="900">

<p>
  <a href="https://www.npmjs.com/package/pi-taskflow"><img src="https://img.shields.io/npm/v/pi-taskflow?style=flat-square&color=B692FF&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/pi-taskflow"><img src="https://img.shields.io/npm/dm/pi-taskflow?style=flat-square&color=6E8BFF&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-43D9AD?style=flat-square" alt="MIT license"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/runtime%20deps-0-43D9AD?style=flat-square" alt="zero runtime dependencies"></a>
  <a href="https://github.com/heggria/pi-taskflow/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/heggria/pi-taskflow/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/tests-394-6E8BFF?style=flat-square" alt="394 tests"></a>
  <a href="#whats-inside"><img src="https://img.shields.io/badge/dogfooded-%E2%9C%93-43D9AD?style=flat-square" alt="dogfooded"></a>
  <a href="https://pi.dev"><img src="https://img.shields.io/badge/for-Pi%20coding%20agent-B692FF?style=flat-square" alt="for the Pi coding agent"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="../README.zh-CN.md">简体中文</a> ·
  <a href="../README.hi.md">हिन्दी</a> ·
  <b>Español</b> ·
  <a href="../README.ar.md">العربية</a>
</p>

<p><strong>Orquestación DAG declarativa para <a href="https://pi.dev">Pi</a> subagentes.</strong><br/>
Abranquen · compuerten · reanuden · guarden como comando — los resultados intermedios nunca saturan tu contexto.</p>

```bash
pi install npm:pi-taskflow
```

</div>

---

**Los subagentes son de lanzar y olvidar. Los taskflows lanzan, abranquen, pausan, compuertan, reanudan y se guardan como un comando.**

Ya conoces la herramienta de subagentes integrada con `task` / `tasks` / `chain`. `pi-taskflow` habla la *misma* abreviatura — así que tus delegaciones existentes se vuelven instantáneamente **rastreables, reanudables y guardables como un comando de una palabra `/tf:<name>`**. Cuando superas la abreviatura, el DSL completo te ofrece un DAG real: abranque dinámico sobre docenas de elementos, enrutamiento condicional, compuertas de calidad, aprobaciones humanas, reintentos y un límite de gasto duro.

Y durante todo el tiempo, **solo la fase final llega a tu conversación.** Cada transcripción intermedia se queda en el runtime, nunca en tu ventana de contexto.

## Por qué existe esto

Aquí está el muro contra el que chocas con subagentes puros: describes un plan de varios pasos en prosa, el modelo lo re-deriva en cada ejecución, las transcripciones intermedias inundan tu contexto, y en el momento en que una llamada al modelo falla, empiezas de nuevo desde cero. No hay reutilización, no hay recuperación, no hay estructura.

`pi-taskflow` mueve el plan **fuera del prompt y dentro de una definición declarativa.** El runtime posee el DAG, los bucles, los reintentos y el estado intermedio. Declaras un pipeline una vez y lo ejecutas cien veces — por nombre.

<div align="center">
<img src="./assets/context-isolation.png" alt="Con subagentes puros cada transcripción inunda tu contexto; con pi-taskflow las transcripciones se quedan en el runtime y solo el resultado final regresa" width="900">
</div>

> Cuando un trabajo necesita doce pasos con abranque de ramas y una compuerta de revisión, necesitas orquestación — no un prompt con suerte.

| | subagent (integrado) | **pi-taskflow** |
|---|---|---|
| **Quién dirige** | el modelo, turno a turno | el runtime, desde una definición |
| **Topología** | cadena / plano paralelo | **DAG con concurrencia por capas + enrutamiento** |
| **Resultados intermedios** | en tu ventana de contexto | **en el runtime — no en tu contexto** |
| **Escala** | un puñado de tareas | **abranque `map` dinámico sobre docenas de ítems** |
| **Reutilizable** | re-descrito cada vez | **guardado como `/tf:<name>`** |
| **Reanudable** | ✗ | **✓ entre sesiones — fases cacheadas se saltan automáticamente** |
| **Compuertas de calidad** | ✗ | **fases `gate` que se detienen en `VERDICT: BLOCK`** |
| **Enrutamiento condicional** | ✗ | **guardas `when` + uniones OR `join: any`** |
| **Tolerancia a fallos** | ✗ | **`retry` por fase + re-intento automático en errores transitorios** |
| **Humano en el circuito** | ✗ | **fases `approval` (aprobar / rechazar / editar)** |
| **Control de costos** | ✗ | **`budget` global (límites USD / tokens)** |
| **Composición** | ✗ | **fases `flow` ejecutan sub-flujos guardados** |
| **Progreso en vivo** | opaco mientras se ejecuta | **renderizado DAG en vivo con tiempos y costos** |
| **Ergonomía** | JSON en línea cada vez | **abreviatura (`task`/`tasks`/`chain`) *o* DSL** |

No reemplaza la herramienta de subagentes. Les da a tus subagentes un DAG, una memoria y un nombre.

## Comparado con otras extensiones de Pi

El ecosistema de Pi ahora tiene **20+ extensiones de delegación, flujo de trabajo y orquestación** — cada una excelente para lo que hace. Aquí hay un mapa honesto de dónde se sitúa `pi-taskflow` (verificado con el último lanzamiento npm de cada paquete, junio 2026). Para el desglose completo — cada paquete, fortalezas *y* debilidades — consulta [`PI-ECOSYSTEM.md`](./PI-ECOSYSTEM.md). Para el panorama más amplio fuera de Pi (LangGraph, Temporal, CrewAI, Mastra…) consulta [`COMPETITORS.md`](./COMPETITORS.md).

*(La tabla de comparación completa está en el [README en inglés](../README.md).)*

> 📖 Documentación completa disponible en el [README en inglés](../README.md)

## Inicio en 30 segundos

**1. Instalación** — un comando:

```bash
pi install npm:pi-taskflow
```

> **Opcional:** ejecuta `/tf init` una vez para mapear los 18 agentes integrados con roles de modelo
> (`fast`, `strong`, `thinker`, …) a tus propios modelos — un selector interactivo.
> Puedes saltarlo y los agentes usarán el modelo predeterminado de Pi. Consulta [Roles de modelo](#model-roles).

**2. Ejecución** — solo pídeselo al modelo en una sesión de Pi:

> *Ejecuta una cadena: primero explora el flujo de autenticación, luego resume los hallazgos.*

El modelo llama a la herramienta `taskflow` automáticamente. Obtienes progreso en vivo, tiempos por paso, costo de tokens y un registro de ejecución guardado — **el mismo esfuerzo que la herramienta integrada, ahora rastreada y reanudable.**

**3. Guardado** — di *"guárdalo"* y tienes `/tf:<name>` para siempre.

Eso es todo. Puedes estar ejecutando tu primer flujo de trabajo antes de que se enfríe tu café — sin escribir una sola definición de fase.

### La abreviatura (misma forma que la herramienta integrada)

```jsonc
// Single — un agente, un trabajo
{ "task": "Summarize the architecture of src/", "agent": "explorer" }

// Parallel — lanza varios a la vez, las salidas se fusionan
{ "tasks": [
  { "task": "Audit auth in src/api",             "agent": "analyst" },
  { "task": "Audit input validation in src/api", "agent": "analyst" }
] }

// Chain — secuencial; cada paso ve la salida anterior
{ "chain": [
  { "task": "List the public API of src/lib", "agent": "scout" },
  { "task": "Write docs for:\n{previous.output}", "agent": "writer" }
] }
```

`agent` es opcional (por defecto usa el primer agente descubierto). Añade un `name` para etiquetar la ejecución y habilitar su guardado como comando.

## Míralo ejecutarse

Esto no es un mockup. **Esto es stdout de una ejecución real** — el flujo `self-improve` que escribe y verifica sus propios suites de prueba, interceptado en pleno vuelo por una compuerta de calidad:

```
⊗ taskflow self-improve  6/7 · blocked · $0.095
    ✓ discover            agent   deepseek-v4-flash  10t ↑38k ↓6.7k $0.011
  ┌ ✓ write-runner-tests  agent   claude-sonnet-4-6  10t ↑13 ↓6.6k $0.020
  ├ ✓ write-store-tests   agent   claude-sonnet-4-6  10t ↑11 ↓10k $0.018
  ├ ✓ write-agents-tests  agent   claude-sonnet-4-6  10t ↑28 ↓13k $0.030
  └ ✓ fix-stability       agent   claude-sonnet-4-6  10t ↑13 ↓3.9k $0.012
    ✓ verify              gate    BLOCK 3 type errors in test files  deepseek-v4-flash
    ⊘ report              reduce  skipped · Gate blocked  ↳ fix-stability
```

**El diseño *es* el DAG.** Sin panel, sin registros que grep — lees la barra de progreso y entiendes todo el pipeline:

- **Encabezado** — `⊗` = bloqueado (una compuerta lo detuvo); `6/7` fases procesadas; costo agregado `$0.095`.
- **Iconos de estado** — `✓` hecho · `◐` ejecutando · `✗` fallido · `⊘` saltado · `○` pendiente.
- **Riel `┌ ├ └`** — fases en la misma capa del DAG, ejecutándose concurrentemente. Las cuatro tareas `write-*`/`fix-stability` se abrancan desde `discover`. Un margen en blanco = una capa de fase única.
- **`↳`** — una dependencia larga que salta capas. `report` depende de `verify` adyacente *y* de `fix-stability` dos capas atrás, por lo que solo esa arista de salto está anotada.
- **Compuerta** — `verify` emitió `VERDICT: BLOCK`, así que el runtime saltó `report` y terminó la ejecución como `blocked`, mostrando la razón en línea.
- **Detalle** — por fase: modelo, conteos de tokens (`↑`in `↓`out), costo, tiempo. Las fases de abranque también muestran progreso de sub-tareas (`3/15 2✗ 8▸`).

## Ve a lo declarativo

La abreviatura es tu rampa de entrada. El DSL es donde `pi-taskflow` demuestra su valor — abranque dinámico, enrutamiento estructurado y compuertas de calidad.

> 📖 Documentación completa del DSL disponible en el [README en inglés](../README.md)

### Abranque y reducción

```jsonc
{
  "name": "summarize-files",
  "description": "Discover files, summarize each, produce one report",
  "args": { "dir": { "default": "." } },
  "concurrency": 8,
  "phases": [
    { "id": "discover", "type": "agent", "agent": "scout",
      "task": "List source files under {args.dir} (non-recursive).\nOutput ONLY a JSON array [{\"file\":\"\"}]. No prose.",
      "output": "json" },
    { "id": "summarize", "type": "map",
      "over": "{steps.discover.json}", "as": "item", "agent": "scout",
      "task": "Read {item.file} and give a one-sentence summary.",
      "dependsOn": ["discover"] },
    { "id": "report", "type": "reduce", "from": ["summarize"], "agent": "writer",
      "task": "Combine into a short overview:\n{steps.summarize.output}",
      "dependsOn": ["summarize"], "final": true }
  ]
}
```

1. **`discover`** lista cada archivo y emite un array JSON.
2. **`summarize`** es un `map` — abranca un subagente por archivo, limitado a 8 concurrentes, con `{item.file}` vinculado a cada ruta.
3. **`report`** es un `reduce` — fusiona todos los resúmenes en una visión general limpia.

Los resúmenes intermedios nunca entran en tu contexto. El runtime los posee; tú obtienes el informe. **Grábalo una vez → `/tf:summarize-files dir=src` para siempre.**

### Enruta, compuerta, reintenta, aprueba y limita el gasto

```jsonc
{
  "name": "triage-and-fix",
  "budget": { "maxUSD": 1.5 },
  "phases": [
    { "id": "triage", "type": "agent", "agent": "analyst", "output": "json",
      "task": "Classify the bug. Output ONLY {\"severity\":\"high\"} or {\"severity\":\"low\"}." },
    { "id": "deep",  "when": "{steps.triage.json.severity} == high", "dependsOn": ["triage"],
      "agent": "executor-code", "task": "Root-cause and patch it.",
      "retry": { "max": 2, "backoffMs": 500 } },
    { "id": "quick", "when": "{steps.triage.json.severity} == low",  "dependsOn": ["triage"],
      "agent": "executor-fast", "task": "Apply the quick fix." },
    { "id": "approve", "type": "approval", "join": "any", "dependsOn": ["deep", "quick"],
      "task": "Review the fix before it ships." },
    { "id": "ship", "type": "agent", "dependsOn": ["approve"],
      "task": "Open a PR with the change.", "final": true }
  ]
}
```

> 📖 Documentación completa de tipos de fase, DSL, interpolación, comandos, reanudación, almacenamiento, agentes, roles de modelo, ejemplos y más disponible en el [README en inglés](../README.md)

## Lo que hay dentro

<div align="center">

**0 dependencias de runtime** · **394 tests** · **10 tipos de fase** · **reanudación entre sesiones** · **memoización entre ejecuciones** · **~4.9k LOC de runtime**

</div>

- **Cero dependencias de runtime.** Sin campo `dependencies` — el runtime está construido enteramente con módulos nativos de Node (`fs` / `path` / `os` / `child_process` / `crypto`). El bloqueo de archivos es `fs.openSync("wx")`, no una biblioteca de terceros.
- **371 tests en 14 suites** cubriendo concurrencia, bloqueo atómico de archivos (regresiones de carrera de 8 procesos), endurecimiento contra path traversal, reanudación entre sesiones, frescura de caché entre ejecuciones (aislamiento de claves flow/thinking/tools, invalidación de huellas, evicción TTL/LRU), veredictos de compuerta, límites de presupuesto, reintento/backoff, flujos de aprobación, terminación de bucles, juzgamiento de torneos, composición de sub-flujos, aislamiento de callbacks, watchdog inactivo, configuración init de roles de modelo y parseModelFromLabel con regresión de nombre de modelo parenthesizado — más una prueba end-to-end en vivo que lanza subagentes reales y una prueba dogfood de caché entre ejecuciones.
- **Endurecido por diseño.** Defensa contra path traversal (léxica + `realpath`), validación de runId, sanitización de HTML/errores, escrituras atómicas, robo de bloqueos obsoletos mediante `rename`, y un watchdog inactivo que mata subagentes atascados.
- **Dogfooded.** Cada nueva característica debe sobrevivir el propio flujo `self-improve` del proyecto antes de lanzarse.

## 🍽️ Nos comemos nuestro propio dog food

Cada característica de `pi-taskflow` se lanza **a través de `pi-taskflow`.**

Nuestro flujo `self-improve` es un DAG de 10 fases — audita el código base, parchea defectos, verifica corrección, comprueba calidad y muestra el informe — todo declarativamente. Está guardado como `/tf:self-improve` y se ejecuta antes de cada lanzamiento. Ningún otro orquestador de agentes en el ecosistema Pi se construye a sí mismo consigo mismo.

| Campaña | Escala | Fases | Resultado |
|----------|-------|--------|---------|
| [v0.0.8 dogfood](./docs/dogfooding-v0.0.8-report.md) | Auditoría completa del codebase → triaje → arreglo → verificación | 10 fases, 234 tests | 13 arreglos, todos pasan |
| [v0.0.6 self-audit](./docs/self-audit-report.md) | inventario → mapa de auditoría → compuerta → aprobación → mapa de arreglos → reducción | 9 fases | 11 defectos críticos arreglados |
| [Dogfood de caché entre ejecuciones](./docs/rfc-cross-run-memoization.md) | Runtime real + almacenamiento en disco | Suite de pruebas dedicada | Corrección de caché bajo huellas adversariales |
| [Revisión cruzada adversarial](./docs/brainstorm-adversarial-review-report.md) | Revisión adversarial multi-agente | `tournament` + `gate` | Arreglo de clave de caché P0 enviado |
| [Revisión de rediseño de Init](./docs/issue-necessity-review-report.md) | Auditoría de necesidad → comprobaciones paralelas → veredicto | 7 fases | Plan de rediseño completo validado |

> **Meta:** usamos el abranque `map` de `pi-taskflow`, veredictos `gate`, `approval` humano en el circuito, `tournament` mejor-de-N, `loop` hasta-completar y caché `cross-run` — para construir `pi-taskflow`.

> 📖 Para el estado, límites, desarrollo, contribuciones y licencia, consulta el [README en inglés](../README.md)

---

Si esto te ahorra una ventana de contexto, deja una ⭐ en GitHub — realmente ayuda.

<div align="center">

[MIT](./LICENSE)

</div>
