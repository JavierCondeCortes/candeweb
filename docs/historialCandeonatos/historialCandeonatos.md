# Historial de Candeonatos

## Objetivo

Crear un apartado histórico que represente correctamente un Candeonato como un campeonato compuesto por diferentes carreras o rondas.

Cada edición debe permitir consultar:

- Información general del campeonato.
- Circuitos y rondas disputadas.
- Clasificación general por puntos.
- Posiciones y resultados de cada carrera, cuando la API los facilite.
- Estadísticas de pilotos y del campeonato.
- Sanciones, equipos y transferencias, si existen.

El apartado debe seguir el sistema visual definido en `docs/design.md` y diferenciar claramente la página promocional de una edición activa de su historial deportivo.

## Fuente de datos

API pública facilitada:

```text
https://fatcatrace.xyz/api/torneo/42
```

El identificador final representa el torneo:

```text
GET https://fatcatrace.xyz/api/torneo/{torneoId}
```

Fuentes públicas complementarias comprobadas:

```text
GET https://fatcatrace.xyz/tournaments
GET https://fatcatrace.xyz/ronda/{iracingId}
```

La primera enumera las ediciones visibles. La segunda devuelve una tabla HTML con posición, nombre,
equipo, vueltas, tiempos e incidentes de una sesión; el backend la convierte de forma defensiva a
JSON antes de entregarla al frontend.

Ejemplo actual:

- `torneoId`: `42`.
- Nombre devuelto por Fat Cat Race: `Candeonato Bandido`; editorialmente se presenta como
  `Candeonato New Era`, subtítulo `New Era Edition`, sin modificar sus resultados deportivos.
- Organizador: `Candemor Racing Team`.

### Observación técnica

En la comprobación realizada el 11 de agosto de 2026, el endpoint respondió con código `200`,
contenido JSON y la cabecera CORS `Access-Control-Allow-Origin: *`.

Aunque actualmente puede consultarse desde el navegador, la aplicación debe aislar la API detrás de un servicio y un adaptador. No se debe acoplar la interfaz directamente a los nombres o tipos recibidos.

## Conceptos del dominio

### Candeonato

Una edición completa del campeonato. Contiene rondas, clasificación, participantes y estadísticas acumuladas.

### Ronda

Una sesión puntuable del campeonato. La API utiliza `ronda_no` como orden y `is_heat` para indicar si la ronda es una manga.

### Evento de circuito

Agrupación visual opcional de rondas celebradas en el mismo circuito. La respuesta actual contiene dos rondas consecutivas por circuito: una con `is_heat = 0` y otra con `is_heat = 1`.

Esta agrupación es una inferencia visual y no debe convertirse en una regla de negocio hasta que la API proporcione un identificador de evento o se confirme el formato.

### Clasificación general

Acumulado por piloto con puntos, participaciones, posiciones, incidentes y logros.

### Resultado de carrera

La ruta pública de cada sesión permite recuperar posición, piloto, equipo, vueltas, tiempo total,
tiempo medio e incidentes. No contiene los puntos concedidos por carrera, que permanecen sin mostrar
hasta disponer de una fuente confirmada.

## Estructura observada de la API

La respuesta contiene estas propiedades principales:

| Propiedad               | Tipo observado  | Contenido                               |
| ----------------------- | --------------- | --------------------------------------- |
| `torneo`                | Objeto          | Configuración general del campeonato    |
| `rondas`                | Array           | Metadatos de las rondas                 |
| `entryList`             | Array           | Lista de inscritos                      |
| `teams`                 | Array           | Equipos                                 |
| `organizer`             | Objeto          | Organizador                             |
| `schedule`              | Array           | Calendario adicional                    |
| `pPe`                   | Array           | Puntos acumulados observados por equipo |
| `pPd`                   | Array           | Clasificación y estadísticas por piloto |
| `transfers`             | Array           | Transferencias de equipo                |
| `sanciones`             | Array           | Sanciones                               |
| `totalInscritos`        | Número          | Total de inscritos declarado            |
| `totalVueltas`          | String numérico | Vueltas acumuladas                      |
| `totalIncidentes`       | String numérico | Incidentes acumulados                   |
| `totalPuntosdeLicencia` | String numérico | Puntos de licencia acumulados           |

Los significados de `pPe`, `pPd` y algunos flags de `torneo` se han inferido por su contenido. Deben
confirmarse con el propietario de la API antes de utilizarlos como contrato definitivo.

### Contraste entre ediciones

En la revisión del 11 de agosto de 2026 se compararon los torneos `34`, `35`, `36`, `38`, `42`,
`46`, `47`, `48`, `49` y `50`:

- `pPe` contiene objetos con `equipo_id`, `torneo_id` y `total_puntos`. En el torneo `34`, el
  `equipo_id: 149` coincide con el equipo `Candeonato` incluido en `teams`; esto permite describirlo
  como puntos observados por equipo, pero no confirma sus reglas de cálculo.
- Los torneos mostrados por la web de origen como finalizados devuelven `status: 2`; los que aparecen
  en inscripción devuelven `status: 0`. Se documenta como correlación observada, no como contrato,
  porque la fuente no publica una tabla oficial de estados.
- `status_label` continuó devolviendo `upcoming` en todas las rondas consultadas, incluidas ediciones
  finalizadas. No debe utilizarse para calcular el estado editorial.

## Datos observados del torneo 42

### Resumen

| Dato                                  | Valor observado |
| ------------------------------------- | --------------: |
| Rondas                                |               6 |
| Circuitos diferentes                  |               3 |
| Registros en clasificación de pilotos |              33 |
| Vueltas acumuladas                    |            1357 |
| Incidentes acumulados                 |            1292 |
| Inscritos declarados                  |               0 |
| Equipos                               |               0 |
| Sanciones                             |               0 |
| Transferencias                        |               0 |

### Rondas

| Ronda | Circuito                       | Variante             | Vueltas |  SOF | Manga | Estado recibido |
| ----: | ------------------------------ | -------------------- | ------: | ---: | ----- | --------------- |
|     1 | Virginia International Raceway | Full Course          |       7 | 2346 | No    | `upcoming`      |
|     2 | Virginia International Raceway | Full Course          |       7 | 2346 | Sí    | `upcoming`      |
|     3 | Motorsport Arena Oschersleben  | Grand Prix           |       9 | 2344 | No    | `upcoming`      |
|     4 | Motorsport Arena Oschersleben  | Grand Prix           |       9 | 2344 | Sí    | `upcoming`      |
|     5 | Summit Point Raceway           | Summit Point Raceway |      11 | 2283 | No    | `upcoming`      |
|     6 | Summit Point Raceway           | Summit Point Raceway |      11 | 2283 | Sí    | `upcoming`      |

Todas las rondas devuelven `fecha: null` en la comprobación actual.

### Primeros registros de clasificación

El JSON del torneo devuelve la clasificación ordenada por `puntos_totales` y solo incluye
`piloto_id`. La tabla pública AJAX `GET /resultados/ftct/drivers_unf/{torneoId}` aporta posición,
nombre, equipo y las mismas estadísticas acumuladas. El servidor solo relaciona ambos registros
cuando puntos, rondas, vueltas, victorias, podios, top cinco e incidentes coinciden y la pareja es
única en las dos fuentes. Si la firma falta o se repite, conserva los registros sin relacionarlos.

| Posición derivada | Piloto ID | Puntos | Rondas | Podios | Victorias | Vueltas rápidas |
| ----------------: | --------: | -----: | -----: | -----: | --------: | --------------: |
|                 1 |    801380 |    165 |      6 |      4 |         0 |               1 |
|                 2 |   1027444 |    164 |      6 |      3 |         1 |               3 |
|                 3 |    566535 |    161 |      6 |      3 |         1 |               1 |

La posición mostrada es derivada del orden del array. Si dos pilotos tienen los mismos puntos, la interfaz no debe inventar un criterio de desempate.

## Campos relevantes

### Torneo

| Campo            | Uso propuesto                                              |
| ---------------- | ---------------------------------------------------------- |
| `id`             | Identificador estable de la edición                        |
| `nombre`         | Título visible                                             |
| `season`         | Temporada, si existe                                       |
| `series`         | Serie, si existe                                           |
| `status`         | Estado interno; necesita tabla de equivalencias confirmada |
| `title_sponsor`  | Patrocinador principal                                     |
| `comments`       | Información adicional                                      |
| `sistemapts`     | Sistema de puntuación; no mostrar sin documentación        |
| `heat_racing`    | Indica formato con mangas                                  |
| `multiclass`     | Indica campeonato multiclase                               |
| `driver_change`  | Indica cambio de piloto                                    |
| `safety`         | Indica uso de métricas de seguridad                        |
| `team_transfers` | Indica si existen transferencias                           |
| `hidden`         | Posible visibilidad del torneo                             |

Los flags numéricos deben transformarse de `0 | 1` a booleanos dentro del adaptador.

### Ronda

| Campo          | Uso propuesto                    |
| -------------- | -------------------------------- |
| `id`           | Identificador de la ronda        |
| `torneo_id`    | Relación con el campeonato       |
| `iracing_id`   | Identificador externo de iRacing |
| `nombre`       | Nombre de la sesión              |
| `ronda_no`     | Orden de la ronda                |
| `circuito`     | Circuito                         |
| `variante`     | Configuración del circuito       |
| `fecha`        | Fecha; puede ser `null`          |
| `sof`          | Strength of Field                |
| `team_event`   | Indica carrera por equipos       |
| `laps`         | Número de vueltas                |
| `is_heat`      | Indica manga o heat              |
| `status_label` | Estado textual recibido          |

### Clasificación por piloto (`pPd`)

| Campo             | Uso propuesto                                                |
| ----------------- | ------------------------------------------------------------ |
| `piloto_id`       | Identificador del piloto                                     |
| `puntos_totales`  | Puntos acumulados                                            |
| `rondas`          | Rondas contabilizadas                                        |
| `suma_posiciones` | Suma de posiciones; no equivale a posición media sin cálculo |
| `total_incidents` | Incidentes acumulados                                        |
| `total_laps`      | Vueltas completadas                                          |
| `total_warnings`  | Avisos acumulados                                            |
| `victorias`       | Victorias                                                    |
| `podios`          | Podios                                                       |
| `top_5`           | Resultados entre los cinco primeros                          |
| `top_10`          | Resultados entre los diez primeros                           |
| `vueltas_rapidas` | Vueltas rápidas                                              |
| `poles`           | Poles                                                        |
| `custom_team`     | Equipo personalizado, si existe                              |

`puntos_totales`, `suma_posiciones`, `total_incidents`, `total_laps` y otros acumulados llegan como strings numéricos. Se deben convertir y validar antes de ordenar, calcular o formatear.

## Inconsistencias y datos ausentes

La interfaz debe tolerar estas condiciones observadas:

- `totalInscritos` devuelve `0`, aunque `pPd` contiene 33 pilotos.
- Todas las rondas aparecen como `upcoming`, aunque ya existen puntos y estadísticas acumuladas.
- Todas las fechas son `null`.
- `schedule` está vacío.
- `entryList` está vacío. La tabla nominal no publica `piloto_id`, por lo que la relación solo puede
  establecerse mediante una coincidencia estadística completa y única.
- Existe desglose de posiciones y telemetría básica por sesión, pero no de puntos por piloto y ronda.
- No se devuelve una posición explícita en la clasificación.
- No se documenta el criterio de desempate.
- No existe un identificador explícito que agrupe manga y carrera principal.
- Varios significados internos de `status` y flags no están documentados.

### Reglas defensivas

- No mostrar `0 inscritos` si la clasificación contiene pilotos; mostrar `Dato no disponible` o derivar un valor con una etiqueta clara.
- No usar `status_label` como única fuente para decidir si una carrera se disputó.
- Mostrar `Fecha por confirmar` cuando `fecha` sea `null`.
- No unir nombres a `piloto_id` por posición ni por puntos solamente. Admitir la relación únicamente
  cuando la firma estadística completa es única y volver a las fuentes independientes si falla.
- Presentar bajo demanda únicamente los campos observados en la tabla pública de cada sesión.
- Indicar expresamente que la fuente no publica puntos por carrera.
- Mantener el último estado válido si una actualización de la API falla.

## Arquitectura de información recomendada

### Índice histórico

Ruta sugerida:

```text
/candeonatos
```

Contenido:

- Encabezado `Historial de Candeonatos`.
- Resumen de la historia de la competición.
- Selector o retícula de ediciones.
- Estado de cada edición: próxima, activa o finalizada.
- Ganador, número de rondas y temporada cuando los datos existan.
- Enlace hacia el detalle de cada edición.

### Detalle de una edición

Ruta sugerida:

```text
/candeonatos/{torneoId}
```

Orden recomendado:

1. Hero compacto de la edición.
2. Resumen estadístico.
3. Clasificación general.
4. Calendario y rondas.
5. Resultados por carrera, cuando estén disponibles.
6. Estadísticas destacadas.
7. Sanciones y equipos, si existen.
8. Navegación hacia otras ediciones.

La página promocional `/candeonato` puede enlazar a la edición actual del historial sin duplicar toda la tabla deportiva.

## Componentes de interfaz

### 1. Selector de edición

- Mostrar nombre y temporada.
- Usar un `select` nativo en móvil y pestañas o enlaces en escritorio.
- Mantener la edición en la URL para poder compartirla.
- No cargar todas las ediciones simultáneamente.

### 2. Resumen del campeonato

Mostrar únicamente valores fiables:

- Rondas.
- Circuitos.
- Vueltas acumuladas.
- Pilotos clasificados.
- Incidentes, si su contexto está explicado.

Los datos deben aparecer en una retícula editorial, no como tarjetas flotantes independientes.

### 3. Clasificación general

Columnas iniciales recomendadas:

| Columna    | Móvil | Escritorio |
| ---------- | ----- | ---------- |
| Posición   | Sí    | Sí         |
| Piloto     | Sí    | Sí         |
| Puntos     | Sí    | Sí         |
| Rondas     | No    | Sí         |
| Victorias  | No    | Sí         |
| Podios     | No    | Sí         |
| Incidentes | No    | Opcional   |

Comportamiento:

- Mantener posición, piloto y puntos visibles en móvil.
- Permitir expandir una fila para ver estadísticas secundarias.
- Resaltar el podio sin depender únicamente del color.
- Formatear puntos enteros sin decimales innecesarios.
- Incluir título o texto accesible en abreviaturas como `SOF`.
- No usar una tabla con scroll horizontal como única solución móvil.
- Si la clasificación nominal no está disponible, mostrar un identificador neutral como
  `Piloto 801380` y explicar el origen del dato.

### 4. Calendario y rondas

Cada ronda debe mostrar:

- Número de ronda.
- Circuito y variante.
- Fecha o `Por confirmar`.
- Vueltas.
- SOF.
- Tipo: manga, carrera principal o equipo.
- Estado fiable cuando pueda determinarse.

Se puede agrupar visualmente por circuito, pero se debe conservar el número real de cada ronda.

### 5. Resultados por carrera

Este componente queda pendiente de encontrar la fuente de datos adecuada.

Cuando exista, debe incluir:

- Posición final.
- Piloto.
- Equipo.
- Puntos obtenidos.
- Diferencia de posiciones, si existe parrilla de salida.
- Vuelta rápida.
- Incidentes.
- Estado: finalizó, abandono, descalificación o DNS.

### 6. Evolución de puntos

Una gráfica de evolución solo debe construirse si se dispone de puntos por piloto y ronda.

Requisitos:

- No calcular una progresión ficticia a partir del total final.
- Mostrar tabla equivalente accesible.
- Permitir seleccionar pocos pilotos para evitar ruido.
- Usar color, patrón y etiqueta para diferenciar series.
- Respetar `prefers-reduced-motion`.

### 7. Estadísticas destacadas

Posibles métricas:

- Más victorias.
- Más podios.
- Más vueltas rápidas.
- Más poles.
- Mayor número de vueltas.
- Mejor promedio de posición, solo si la fórmula está validada.

Evitar destacar incidentes como si fueran un logro.

## Estados de la interfaz

### Cargando

- Mostrar skeletons con la misma geometría del contenido.
- Mantener encabezado, navegación y explicación disponibles.
- No bloquear toda la página con un spinner.

### Error

- Explicar que no se pudieron actualizar los resultados.
- Ofrecer botón `Reintentar`.
- Mantener datos anteriores si existe caché.
- Enlazar opcionalmente a la fuente pública.

### Vacío

- Diferenciar entre campeonato todavía sin resultados y dato ausente.
- No mostrar tablas vacías con encabezados sin contexto.

### Datos parciales

- Renderizar las secciones disponibles.
- Ocultar componentes sin datos en vez de mostrar ceros engañosos.
- Indicar `Datos parciales` cuando falten nombres, fechas o resultados.

## Modelo TypeScript recomendado

El modelo externo refleja la API y el modelo interno normaliza los datos.

```ts
interface TournamentApiResponse {
  torneo: TournamentApi;
  rondas: RoundApi[];
  entryList: unknown[];
  teams: unknown[];
  organizer: OrganizerApi | null;
  schedule: unknown[];
  pPe: unknown[];
  pPd: DriverStandingApi[];
  transfers: unknown[];
  sanciones: unknown[];
  totalInscritos: number;
  totalVueltas: string;
  totalIncidentes: string;
  totalPuntosdeLicencia: string;
}

interface RoundApi {
  id: number;
  torneo_id: number;
  iracing_id: number | null;
  nombre: string;
  ronda_no: number;
  circuito: string;
  variante: string;
  fecha: string | null;
  sof: number | null;
  team_event: 0 | 1;
  laps: number | null;
  is_heat: 0 | 1;
  status_label: string | null;
}

interface DriverStandingApi {
  piloto_id: number;
  torneo_id: number;
  puntos_totales: string;
  rondas: number;
  suma_posiciones: string;
  total_incidents: string;
  total_laps: string;
  total_warnings: string;
  victorias: number;
  podios: number;
  top_5: number;
  top_10: number;
  vueltas_rapidas: number;
  poles: number;
  custom_team: string | null;
}

interface ChampionshipViewModel {
  id: number;
  name: string;
  organizerName: string | null;
  rounds: ChampionshipRound[];
  standings: DriverStanding[];
  stats: ChampionshipStats;
  warnings: string[];
}
```

El adaptador debe:

- Convertir strings numéricos con comprobación de errores.
- Convertir flags `0 | 1` a booleanos.
- Ordenar rondas por `ronda_no`.
- Preservar el orden recibido de la clasificación hasta conocer el desempate oficial.
- Generar etiquetas de datos ausentes.
- Registrar inconsistencias sin romper el renderizado.

## Arquitectura Angular recomendada

```text
src/app/
├── core/
│   ├── models/
│   │   ├── championship-api.model.ts
│   │   └── championship.model.ts
│   └── services/
│       ├── championship-adapter.service.ts
│       └── championship-api.service.ts
└── pages/
    └── championship-history/
        ├── components/
        │   ├── championship-stats/
        │   ├── edition-selector/
        │   ├── points-evolution/
        │   ├── race-results/
        │   ├── rounds-list/
        │   └── standings-table/
        ├── championship-detail-page.*
        └── championship-history-page.*
```

## Caché y resiliencia

- Mantener la URL base y los IDs de torneo en configuración.
- No repetir el ID `42` en componentes o plantillas.
- Para una edición activa, usar caché corta y revalidación.
- Para una edición finalizada, guardar una instantánea estable o utilizar caché prolongada.
- Añadir timeout y reintento controlado.
- No realizar reintentos infinitos.
- Conservar el último resultado válido en caso de error temporal.
- Crear fixtures JSON anonimizados o estables para pruebas.

Una copia histórica es recomendable porque una API pública puede cambiar, desaparecer o modificar retrospectivamente sus datos.

La edición de metadatos, la selección de la edición destacada y la creación de snapshots se detallan
en [Administración de contenidos](../admin/admin.md). El panel no debe permitir alterar
silenciosamente posiciones o puntos recibidos de la fuente deportiva.

## Diseño visual

- Usar el fondo negro y la retícula del sistema Neon Motorsport.
- Títulos de edición con `Dog Rough` cuando se trate de la marca Candeonato.
- Etiquetas, posiciones y puntos con tipografía monoespaciada.
- Magenta para edición activa, posición y acciones.
- Lima para puntos, datos confirmados y foco.
- Separar filas con bordes; evitar una tarjeta por cada piloto.
- Usar esquinas rectas y superficies de bajo contraste.
- Mantener el ancho de lectura y de tablas dentro de `76rem`.

## Accesibilidad

- Usar una tabla semántica cuando se presente una clasificación tabular.
- Incluir `caption` que identifique edición y tipo de clasificación.
- Marcar encabezados con `scope="col"` y `scope="row"`.
- No depender del color para podio, líder o variaciones de posición.
- Mantener orden de lectura lógico al adaptar la tabla a móvil.
- Ofrecer una alternativa textual para cualquier gráfica.
- Permitir operar filtros y selectores con teclado.
- Anunciar actualizaciones manuales mediante una región `aria-live="polite"`.
- No anunciar cada refresco automático.
- Mantener objetivos táctiles mínimos de `44 × 44px`.
- Respetar movimiento reducido y colores forzados.

## Priorización

### Fase 1 — Datos disponibles

- [x] Crear servicio y modelos de la API.
- [x] Crear adaptador y validación defensiva.
- [x] Implementar resumen del campeonato.
- [x] Implementar clasificación general agregada.
- [x] Implementar lista de rondas.
- [x] Añadir estados de carga, error, vacío y datos parciales.
- [x] Enlazar la edición desde `/candeonato`.

### Fase 2 — Historial de ediciones

- [x] Confirmar en el listado público de Fat Cat Race los IDs `46`, `42`, `38`, `36`, `35` y `34`.
- [x] Crear el índice `/candeonatos`.
- [x] Añadir selector de edición con las ediciones publicadas desde administración.
- [x] Guardar metadatos editoriales que no entrega la API.
- [x] Definir y aplicar la estrategia de snapshots para ediciones activas y terminadas.

### Fase 3 — Resultados detallados

- [x] Localizar la ruta pública `GET /ronda/{iracingId}` y transformarla en JSON desde el backend.
- [x] Relacionar `piloto_id` con nombre y equipo solo ante una coincidencia estadística completa,
      exacta y única; conservar los casos ambiguos sin relación.
- [x] Implementar posiciones, nombres, equipos, vueltas, tiempos e incidentes de cada sesión bajo
      demanda y con caché de 24 horas.
- [x] Conservar y mostrar posiciones, puntos y sanciones según el sistema publicado por Fat Cat
      Race, sin recalcularlos en Candeweb.
- [ ] Implementar evolución de puntos cuando Fat Cat Race publique el desglose por ronda.
- [ ] Añadir estadísticas derivadas únicamente si Fat Cat Race confirma sus fórmulas.

## Información pendiente

La fuente oficial sitúa actualmente el torneo `42` dentro de `Finalizados`, por lo que el estado
editorial inicial se ha corregido a `finished`. Esto confirma el caso observado `status: 2`, pero no
documenta por sí solo el contrato completo de valores posibles ni convierte `status_label` en una
fecha fiable: las seis sesiones siguen devolviendo `upcoming` y `fecha: null` pese a tener
resultados.

- [x] IDs de las ediciones que aparecen en el archivo público de Fat Cat Race a fecha de la última
      revisión: `46`, `42`, `38`, `36`, `35` y `34`.
- [x] Fuentes de nombres: `GET /resultados/ftct/drivers_unf/{torneoId}` para la clasificación y
      `GET /ronda/{iracingId}` para cada sesión. Ninguna publica `piloto_id`; la primera se concilia
      con `pPd` solo cuando las estadísticas forman una pareja única.
- [x] Fuente de resultados por sesión: `GET /ronda/{iracingId}`, convertida a JSON por
      `/api/public/rounds/{iracingId}/results`.
- [ ] Significado oficial de `status` y `status_label`.
- [ ] Significado oficial de `pPe` y `pPd`.
- [ ] Criterio de desempate de la clasificación.
- [ ] Regla que relaciona mangas y carreras principales.
- [ ] Sistema de puntuación utilizado.
- [ ] Fechas reales de las rondas.
- [ ] Confirmación de si sanciones ya están incluidas en `puntos_totales`.

Estas incógnitas pertenecen al sistema deportivo de Fat Cat Race. Hasta que su contrato las
documente, Candeweb tratará la clasificación recibida como resultado oficial: no inferirá reglas,
no resolverá empates por su cuenta y no alterará puntos o sanciones.

## Criterios de aceptación

- [x] Se entiende que una edición contiene varias carreras.
- [x] La clasificación general muestra puntos y posición de forma clara.
- [x] Las rondas conservan el orden proporcionado por la API.
- [x] Los datos nulos o inconsistentes no rompen la página.
- [x] No se inventan nombres, fechas, resultados ni desempates.
- [x] La interfaz distingue datos disponibles, parciales y ausentes.
- [x] La tabla es usable en móvil, teclado y lector de pantalla.
- [x] La edición puede compartirse mediante una URL propia.
- [x] La página conserva datos válidos ante un fallo temporal.
- [x] La implementación incluye pruebas del adaptador y de los estados de interfaz.
