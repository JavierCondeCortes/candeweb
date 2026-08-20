# Página de inicio de la comunidad

## Jerarquía de marca

La página de inicio presenta **Candemor Racing Team**, también denominado **Candemor**. Candemor es
la comunidad y el equipo principal: su identidad, sus miembros, sus directos, su contenido y sus
actividades deben dominar la portada.

El **Candeonato** no es la identidad general de la web. Es un campeonato organizado periódicamente
por Candemor y compuesto por diferentes carreras, posiciones y puntos. En la portada debe aparecer
como uno de sus eventos destacados, con acceso a su landing e historial, sin sustituir la
presentación de Candemor ni convertirse en la acción principal del hero.

## Objetivo

Crear una página de inicio que presente la comunidad, muestre su canal de Twitch y conduzca al
visitante hacia dos acciones principales:

1. Ver el directo o conocer a los streamers.
2. Descubrir los eventos de la comunidad, especialmente el Candeonato.

La página debe seguir el sistema visual descrito en `docs/design.md`: estilo Neon Motorsport, base oscura, titulares editoriales, acentos magenta y lima, movimiento controlado y accesibilidad por defecto.

La sustitución de miembros ficticios, la edición destacada, los sponsors y los valores globales se
gestionan mediante el panel definido en [Administración de contenidos](../admin/admin.md).

## Recomendación principal

La portada actual del Candeonato no debería desaparecer. La arquitectura recomendada es:

- `/`: nueva página de inicio de la comunidad.
- `/candeonato`: página existente del evento.
- Rutas futuras opcionales: `/equipo`, `/eventos`, `/galeria` y `/tienda`.

En la primera versión no es necesario crear todas las rutas. Las secciones pueden vivir en la portada y convertirse en páginas independientes cuando tengan contenido suficiente.

## Estructura recomendada

1. Navegación global.
2. Hero con vídeo, identidad de la comunidad y estado de Twitch.
3. Presentación breve de la comunidad.
4. Miembros y streamers del equipo.
5. Experiencias y contenido destacado.
6. Evento destacado: Candeonato.
7. Patrocinadores y colaboradores.
8. Merchandising.
9. Contacto y footer.

### Por qué se recomienda este orden

- El hero explica quiénes somos y ofrece una acción inmediata.
- La presentación define la identidad de Candemor antes de introducir cualquiera de sus proyectos.
- El equipo y el contenido aportan confianza, personalidad y continuidad a la comunidad.
- El Candeonato aparece como una prueba tangible de lo que organiza Candemor, no como la identidad
  principal de la web.
- Patrocinadores y merchandising quedan después del contenido principal para no convertir la portada en una tienda.
- La página termina tras el evento y un footer con el acceso al canal oficial.

## 1. Navegación global

### Contenido

- Marca o logotipo con enlace al inicio.
- Enlaces: `Comunidad`, `Equipo`, `Contenido`, `Sponsors` y `Candeonato actual`.
- Acceso confirmado a Twitch: `https://www.twitch.tv/candemorracingteam`.
- Indicador `En directo` únicamente cuando exista una emisión activa.

### Comportamiento

- [x] Mantener la navegación visible al inicio del hero.
- [x] Usar navegación compacta o menú desplegable accesible en móvil.
- [x] Marcar la página actual con `aria-current` en el enlace de identidad del hero.
- [x] Permitir cerrar el menú móvil con su botón y con `Escape`.
- [x] Evitar más de seis enlaces principales.
- [x] Incluir `Saltar al contenido` como primer enlace enfocable.
- [x] Implementar los destinos internos con `routerLink` y fragmentos para que funcionen también al
      regresar desde otra ruta; activar el desplazamiento a anclas y reservar margen superior.

### Recomendación visual

Fondo transparente sobre el hero y fondo negro translúcido con blur al hacer scroll. La navegación debe conservar bordes rectos y utilizar etiquetas monoespaciadas.

## 2. Hero con vídeo y Twitch

### Objetivo

Comunicar en pocos segundos qué es la comunidad y ofrecer la acción más relevante según el estado del streamer.

### Contenido recomendado

- Eyebrow: categoría o lema breve.
- `h1`: nombre de la comunidad.
- Propuesta de valor de una o dos frases, máximo `60ch`.
- Acción primaria dinámica:
  - En directo: `Ver directo`.
  - Sin directo: `Conocer al equipo` o `Ver último contenido`.
- Acción secundaria: `Conocer al equipo` o `Explorar contenido`.
- Estado de Twitch con avatar, canal, categoría y número de espectadores cuando los datos estén disponibles.

El texto `CANDEMOR` del `h1` usa la fuente local `Dog Rough`; el subtítulo `Racing Team` conserva la
voz monoespaciada de interfaz. La acción `Conocer al equipo` apunta siempre al fragmento `#equipo`.

### Estados necesarios

- `loading`: skeleton o texto `Consultando directo…` sin bloquear el hero.
- `live`: indicador visible, nombre del canal, categoría y enlace al directo.
- `offline`: mensaje breve y alternativa útil.
- `error`: la página funciona con contenido editorial y enlace directo a Twitch.
- `sin endpoint`: utilizar los eventos oficiales `ONLINE` y `OFFLINE` del reproductor de Twitch;
  si el script no responde, mostrar el canal sin afirmar que está emitiendo.

### Canal confirmado

- Login: `candemorracingteam`.
- Nombre visible: `CandemorRacingTeam`.
- URL: `https://www.twitch.tv/candemorracingteam`.
- El enlace directo debe funcionar aunque la consulta automática del estado falle o todavía no
  exista backend.

### Integración técnica recomendada

- [x] Detectar el estado actual mediante los eventos oficiales `Twitch.Player.ONLINE` y
      `Twitch.Player.OFFLINE`, sin reproducción automática ni sonido.
- [x] Consultar `GET /helix/streams?user_login=candemorracingteam` desde
      `/api/public/stream-status` cuando existen las credenciales del servidor.
- [x] Realizar la autenticación y la llamada a Twitch desde el backend mediante un token de
      aplicación; si falta el secreto, usar el detector oficial del reproductor.
- [x] No exponer el secreto de Twitch en Angular ni guardarlo en el repositorio.
- [x] Cachear el estado durante `90 segundos` para evitar solicitudes innecesarias.
- [x] Mantener una lista configurable de hasta seis canales de la comunidad desde el panel.
- [x] Si hay varios canales activos, priorizar el canal oficial y después el orden editorial
      configurado.
- [x] Mantener el detector silenciado, sin autoplay y fuera de la interfaz; el contenido se abre en
      Twitch únicamente después de pulsar `Ver directo`.
- [x] Configurar automáticamente el dominio actual mediante el parámetro `parent` del reproductor.
- [x] No depender del autoplay; el detector oficial se crea con `autoplay: false` y `muted: true`.

El canal principal continúa siendo `candemorracingteam`. El panel permite añadir cinco canales
adicionales, uno por línea y en orden de prioridad. El backend consulta todos los logins en una sola
petición a Helix, selecciona primero el oficial si está emitiendo y, si no, el siguiente canal
activo. La respuesta combinada mantiene la caché de `90 segundos`. El reproductor oculto de fallback
se limita al canal oficial cuando Helix no está disponible.

Referencias oficiales: [Get Streams](https://dev.twitch.tv/docs/api/reference#get-streams) y [Twitch Video & Clips](https://dev.twitch.tv/docs/embed/video-and-clips/).

### Vídeo ambiental

El vídeo fuente confirmado es `public/exampleVideo.mp4`. Para la web se utiliza
`public/media/home-example-optimized.mp4`, derivado del mismo contenido a `1080p/30 fps`, junto con
posters específicos para escritorio y móvil. El original se conserva sin modificaciones.

- [x] Ocupar todo el alto visible con `min-height: 100svh`.
- [x] Proporcionar poster optimizado como respaldo.
- [x] Reproducir inicialmente sin sonido.
- [x] Mantener los controles de pausar, silenciar y ver vídeo sin interfaz.
- [x] Usar una viñeta que garantice el contraste del texto.
- [x] Ocultar o pausar el vídeo con `prefers-reduced-motion`.
- [x] No usar simultáneamente el vídeo ambiental y un embed de Twitch reproduciéndose.

## 3. Presentación de la comunidad

### Contenido

- Eyebrow: `La comunidad`.
- Título corto: una idea, no una descripción genérica.
- Entradilla que responda a: quiénes somos, qué hacemos y para quién.
- Tres valores o pilares como máximo.
- Imagen o clip editorial de la comunidad.

### Recomendación

Usar una composición asimétrica de texto e imagen. Evitar tres tarjetas idénticas si los valores pueden expresarse mediante una lista editorial con números o líneas divisorias.

### Pendiente de contenido

- [ ] Redactar una propuesta de valor de una frase.
- [ ] Definir tres valores reales de la comunidad.
- [ ] Seleccionar una imagen horizontal de buena calidad.
- [ ] Añadir texto alternativo que describa la escena y su intención.

## 4. Miembros y streamers

### Contenido de cada miembro

- Fotografía o retrato coherente con el sistema visual.
- Nombre visible y alias.
- Rol dentro de la comunidad.
- Descripción breve, máximo dos líneas.
- Enlace de Twitch solo si existe.
- Enlace `Web` solo si existe, para una página personal o profesional HTTPS.
- Estado `En directo` si la integración lo confirma.
- Redes adicionales únicamente si son relevantes.

El enlace se presentará con el texto accesible `Web de {nombre}` y no como una URL desnuda. Si se
abre en otra pestaña, se indicará visualmente y utilizará `noopener` y `noreferrer`.

### Interacción recomendada

En escritorio puede utilizarse una composición por capas con un parallax muy ligero. En móvil debe convertirse en una lista o scroll horizontal con controles normales.

- [x] Limitar el desplazamiento parallax a `12–24px`.
- [x] Desactivarlo con `prefers-reduced-motion`.
- [x] No vincular información esencial exclusivamente al hover.
- [x] Mantener las tarjetas y sus enlaces accesibles con teclado.
- [x] Evitar que varias animaciones se ejecuten simultáneamente.
- [x] Usar imágenes con proporción y tratamiento consistentes.

### Recomendación de alcance

Mostrar entre cuatro y seis miembros en la portada. Si hay más, añadir `Ver todo el equipo` y mover el listado completo a una página propia.

### Perfiles de demostración actuales

La primera versión incluye cinco retratos y nombres **ficticios** para validar el diseño. No deben
presentarse como miembros reales y se sustituirán cuando exista el contenido oficial.

| Nombre ficticio | Red mostrada                    |
| --------------- | ------------------------------- |
| Alex Vega       | Twitch oficial de Candemor      |
| Lucía Torres    | Ninguna; mostrar solo su nombre |
| Dani Romero     | Twitch oficial de Candemor      |
| Nora Ruiz       | Ninguna; mostrar solo su nombre |
| Marcos León     | Twitch oficial de Candemor      |

Todos los enlaces de ejemplo que muestran Twitch utilizan la URL confirmada del equipo. No se crean
usuarios o redes ficticias.

## 5. Experiencias y contenido destacado

Se recomienda presentar esta sección como una galería editorial, no como un carrusel automático.

### Tipos de contenido

- Clips destacados de Twitch.
- Momentos de eventos.
- Colaboraciones.
- Directos especiales.
- Logros o hitos de la comunidad.

### Diseño

- Una pieza principal de gran formato.
- Dos o cuatro piezas secundarias.
- Imagen previa, categoría, creador y duración.
- Botón `Ver experiencia` o `Ver clip`.
- Carga del reproductor solo después de la interacción.

- [ ] Mantener proporción `16 / 9`.
- [x] Evitar autoplay y reproducción múltiple.
- [x] Proporcionar nombre accesible a cada enlace.
- [x] Indicar visualmente si el enlace abre Twitch u otro sitio externo.
- [x] Preparar un estado honesto cuando todavía no haya contenido curado.

## 6. Evento destacado: Candeonato

### Objetivo

Presentar el Candeonato como un campeonato que Candemor organiza periódicamente y conectarlo con la
página específica del evento ya desarrollada.

### Contenido

- Relación explícita: `Un evento organizado por Candemor`.
- Número y edición actual del Candeonato.
- Estado: inscripciones abiertas, próximas, cerradas o evento finalizado.
- Fecha o información pendiente claramente identificada.
- Imagen o fragmento del vídeo del evento.
- Acción principal: `Ver el Candeonato`.
- Acción contextual opcional: `Inscribirme` cuando proceda.

### Recomendación visual

Usar un bloque destacado a dos columnas con borde magenta, datos monoespaciados en lima y un único
recurso visual. No repetir el hero completo del Candeonato dentro de la portada ni darle más peso que
a la presentación de Candemor.

- [x] Crear una fuente de datos única para el estado y la edición del evento.
- [x] Enlazar a `/candeonato`.
- [x] No inventar fecha, plazas o circuitos si no están confirmados.
- [x] Mostrar la edición actual seleccionada desde administración; New Era corresponde al torneo
      Fat Cat Race `42` y usa su vídeo de fondo propio.
- [x] Reutilizar en el evento destacado la composición visual de la vista previa privada del panel:
      media 16:9, identidad, resumen, estado, temporada e inicio de la edición actual. La fecha final
      sigue disponible en administración e historial, pero no se muestra en este bloque promocional.
- [x] Mostrar el cartel por defecto y permitir que cada visitante cambie entre `Ver cartel` y `Ver
vídeo`; el vídeo solo se carga cuando se solicita.
- [x] Añadir sobre el cartel seleccionado un control circular para abrirlo en un modal de gran
      formato, cerrable mediante botón, fondo o tecla `Escape`. El modal centra el cartel, aprovecha
      todo el alto visible y conserva la imagen completa sin recortes.

## 7. Patrocinadores y colaboradores

### Recomendación

Priorizar una retícula de logotipos o una franja con desplazamiento manual. Un carrusel automático continuo puede dificultar la lectura y distraer del contenido.

Si se utiliza movimiento automático:

- [ ] Incluir botón de pausar y reanudar.
- [ ] Detenerlo al recibir hover o foco.
- [ ] Desactivarlo con `prefers-reduced-motion`.
- [ ] Evitar duplicados accesibles usados únicamente para crear un loop visual.
- [ ] Mantener todos los logotipos con una altura óptica consistente.
- [ ] Mostrar el nombre del patrocinador en el texto alternativo o nombre accesible.

Orden recomendado:

1. Patrocinador principal.
2. Patrocinadores oficiales.
3. Colaboradores técnicos o de comunidad.

La sección existe como destino estable de navegación y muestra un mensaje vacío honesto mientras no
haya acuerdos confirmados. Nunca se crean marcas ficticias. Los sponsors publicados se consultan en
`GET /api/public/sponsors`, se ordenan desde administración y muestran el logo completo con
`object-fit: contain`; los enlaces externos indican que abren una pestaña nueva.

- [x] Añadir la sección y su estado de carga, error y vacío.
- [x] Gestionar alta, edición, publicación, archivo y borrado desde `/admin/sponsors`.
- [x] Validar nombre, logo, texto alternativo, web HTTPS y orden.

<!-- ## 8. Merchandising

### Primera versión recomendada

Crear un teaser con uno a tres productos, no una tienda completa dentro de la portada.

- Imagen del producto.
- Nombre.
- Precio, solo si está confirmado y actualizado.
- Estado: disponible, próximamente o agotado.
- Acción: `Ver colección`.

### Reglas

- [ ] No mostrar productos ficticios como si estuvieran disponibles.
- [ ] Conducir la compra hacia una plataforma segura o futura ruta `/tienda`.
- [ ] Añadir texto alternativo útil a cada producto.
- [ ] Evitar que el bloque comercial tenga más peso que comunidad y eventos.
- [ ] Preparar un estado `Próximamente` visualmente honesto si aún no existe catálogo. -->

## 9. Contacto y footer

### Contenido

- Marca y breve descripción.
- Navegación secundaria.
- Discord, Twitch y redes confirmadas.
- Correo o formulario de contacto.
- Aviso legal, privacidad y cookies cuando correspondan.
- Copyright con año dinámico.
- Enlace secundario `Setups` hacia la biblioteca privada `/setups`; el enlace es visible,
  pero el catálogo y las descargas requieren una cuenta autorizada.

- [x] Verificar los enlaces externos actualmente publicados.
- [x] Indicar visualmente los enlaces que abren en una pestaña nueva.
- [x] Usar nombres comprensibles, no solo iconos sociales.
- [x] Evitar repetir toda la navegación principal; el footer conserva únicamente enlaces
      secundarios y de contacto.
- [x] Añadir `Setups` al componente de footer y proteger la biblioteca definida en
      [Biblioteca privada de setups](../setups/setups.md).

## Arquitectura Angular recomendada

```text
src/app/
├── core/
│   ├── models/
│   │   ├── member.model.ts
│   │   └── stream-status.model.ts
│   └── services/
│       └── stream-status.service.ts
├── shared/
│   └── components/
│       ├── media-controls/
│       ├── section-heading/
│       └── social-link/
├── pages/
│   ├── home/
│   │   ├── components/
│   │   │   ├── community-intro/
│   │   │   ├── event-feature/
│   │   │   ├── experience-gallery/
│   │   │   ├── home-hero/
│   │   │   ├── merch-preview/
│   │   │   ├── sponsor-strip/
│   │   │   └── team-showcase/
│   │   └── home-page.*
│   └── candeonato/
│       └── candeonato-page.*
└── app.routes.ts
```

### Criterios técnicos

- [x] Cargar las páginas con lazy loading.
- [x] Mantener los componentes de sección pequeños y con una responsabilidad clara.
- [x] Definir miembros y Candeonatos mediante modelos tipados.
- [x] Sustituir los miembros locales y el Candeonato fijo por las fuentes públicas definidas en
      [Administración de contenidos](../admin/admin.md).
- [x] Compartir los controles multimedia mediante un componente con una API explícita.
- [x] Mantener secretos y tokens fuera del frontend.
- [x] Añadir estados de carga, vacío y error a las integraciones externas actuales.

## Priorización de implementación

### Fase 1 — MVP

- [x] Crear rutas `/` y `/candeonato` sin perder la página existente.
- [x] Implementar navegación global y footer.
- [x] Implementar hero con vídeo y estado Twitch con fallback.
- [x] Crear presentación de la comunidad.
- [x] Añadir bloque destacado del Candeonato.
- [x] Mostrar miembros principales.
- [x] Validar responsive, teclado y movimiento reducido.

### Fase 2 — Contenido

- [x] Añadir galería editorial de experiencias con estado de carga, vacío y error.
- [x] Integrar el perfil y hasta cuatro clips públicos de Twitch, cargando su reproducción solo
      cuando la persona sigue el enlace al canal.
- [x] Añadir infraestructura y sección para patrocinadores confirmados; falta cargar las marcas
      reales cuando existan acuerdos.
- [ ] Añadir teaser real de merchandising.

### Fase 3 — Mejora

- [x] Añadir parallax progresivo y no esencial.
- [ ] Crear páginas completas de equipo, eventos, galería o tienda si el contenido lo justifica.
- [ ] Incorporar analítica respetuosa con la privacidad.
- [x] Medir Core Web Vitals y optimizar medios.
- [x] Implementar la biblioteca privada y el acceso desde el footer según
      [Setups](../setups/setups.md).

## Contenido necesario antes de implementar

- [ ] Nombre definitivo y logotipo de la comunidad.
- [ ] Propuesta de valor y tono de comunicación.
- [x] URL permanente de Discord: `https://discord.gg/j22XuDEfMk`.
- [x] Canal de Twitch principal: `candemorracingteam`.
- [ ] Fotografías, nombres y redes reales del equipo; actualmente existen cinco ejemplos ficticios.
- [x] Vídeo y poster del hero basados en `exampleVideo.mp4`.
- [x] Selección automática de hasta cuatro clips públicos devueltos por Twitch para el canal
      oficial; se actualiza cada 15 minutos y no se mantiene manualmente.
- [ ] Lista y logotipos de patrocinadores confirmados.
- [ ] Estado real del merchandising.
- [ ] Correo, formulario o medio de contacto.
- [ ] Enlaces legales y política de privacidad.

## Criterios de aceptación generales

- [x] La propuesta de la comunidad se entiende sin reproducir el vídeo.
- [x] Existe una acción principal clara en el primer viewport.
- [x] El estado Twitch nunca bloquea ni rompe el hero.
- [x] El Candeonato existente sigue siendo accesible desde una ruta y desde la navegación.
- [x] Toda la portada funciona con teclado y expone una estructura correcta al árbol de
      accesibilidad del navegador.
- [x] No existe scroll horizontal a `390px` ni con zoom del `200 %`.
- [x] Se respetan `prefers-reduced-motion` y `forced-colors`.
- [x] Imágenes y vídeos tienen poster, dimensiones o proporción reservada.
- [x] No se exponen claves ni secretos en el bundle del navegador.
- [x] La compilación y las pruebas terminan sin errores ni advertencias.

## Auditoría en navegador — 11 de agosto de 2026

La validación se realizó sobre la aplicación renderizada mediante Chrome DevTools y Lighthouse:

- Portada en producción, escritorio: `LCP 186 ms`, `TTFB 6 ms` y `CLS 0,0023`.
- Portada simulando móvil de `390 × 844`, red Slow 4G y CPU cuatro veces más lenta: `LCP 1,274 s`,
  `TTFB 5 ms` y `CLS 0,067`.
- Lighthouse en portada: accesibilidad `100`, buenas prácticas `100` y SEO `100`.
- Lighthouse en `/candeonato`, `/candeonatos` y `/candeonatos/42`: accesibilidad, buenas prácticas y
  SEO `100`.
- Reflow comprobado a `390 px`, `640 px` como equivalente de zoom al `200 %`, `768 px` y escritorio,
  sin scroll horizontal del documento.
- Orden de foco comprobado con teclado; el modo `Ver vídeo` conserva sus controles, aplica `inert` al
  resto de la interfaz y se cierra con `Escape`.
- Tras integrar Discord, perfil y clips de Twitch se repitió la comprobación sobre Edge Chromium
  renderizado a `390 × 844`: ancho del documento `390 px`, sin desbordamiento horizontal, un `h1`,
  un `main`, cero IDs duplicados, cero controles interactivos sin nombre y cero elementos enfocables
  dentro de contenido `aria-hidden`.
- La simulación `prefers-reduced-motion: reduce` mantiene pausados todos los vídeos. Los primeros
  diez destinos de tabulación siguen un orden coherente desde `Saltar al contenido principal` hasta
  el Discord, pasando por navegación, los tres controles del vídeo y las acciones principales.
- Los cuatro clips se muestran como enlaces; no se crea ningún `iframe`, por lo que Twitch no inicia
  un reproductor antes de la acción de la persona usuaria.
- La misma comprobación móvil del DOM y el árbol accesible se repitió en `/candeonato`,
  `/candeonatos`, `/candeonatos/42` y `/admin/login`: todas conservan un `h1`, un `main`, ancho de
  documento igual al viewport y ningún control interactivo sin nombre.

La persona propietaria confirmó la validación manual local con tecnología de apoyo. La auditoría
automática del árbol no sustituye repetir esa escucha con NVDA, VoiceOver o TalkBack cuando se
publique la versión definitiva y cambie el entorno de ejecución.
