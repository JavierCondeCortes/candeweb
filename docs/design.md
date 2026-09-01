# Sistema de diseño — Neon Motorsport

> Guía reutilizable para crear webs con la identidad visual del Candeonato: competición nocturna, energía digital, tipografía editorial de gran formato y una interfaz accesible.

## 1. Propósito

Este documento define el lenguaje visual y las reglas de experiencia necesarias para reproducir el estilo en otros proyectos sin depender de una página o framework concreto.

El resultado debe sentirse:

- Competitivo, veloz y contemporáneo.
- Oscuro, cinematográfico y de alto contraste.
- Editorial en los titulares y técnico en los datos.
- Expresivo sin dificultar la lectura ni la navegación.
- Cuadrado y preciso: se evitan las formas excesivamente redondeadas.

No se debe copiar el contenido del Candeonato. Se reutilizan el sistema visual, la jerarquía, los patrones de interacción y los criterios de accesibilidad.

## 2. Principios de diseño

### 2.1. El contenido domina

- Utilizar titulares grandes para comunicar una idea principal por pantalla.
- Mantener los párrafos entre `45ch` y `60ch`.
- Reservar el color lima para datos, etiquetas y estados de foco.
- Reservar el magenta para acciones principales, numeración y energía visual.
- Evitar llenar cada espacio: el fondo oscuro y el espacio negativo forman parte del diseño.

### 2.2. Cinematográfico, pero legible

- El vídeo o la imagen de fondo aporta ambiente; nunca sustituye al contenido.
- Aplicar viñetas oscuras para mantener el contraste del texto.
- Utilizar un poster optimizado como respaldo del vídeo.
- Permitir pausar, silenciar y ver el vídeo sin interfaz.
- No iniciar nunca el vídeo con sonido.

### 2.3. Tecnología con intención

- Combinar una tipografía condensada y pesada con una monoespaciada.
- Usar retículas, líneas, esquinas técnicas y scanlines con baja opacidad.
- No abusar de efectos glitch, brillos o animaciones continuas.
- Cada efecto debe reforzar jerarquía, profundidad o interacción.

### 2.4. Accesibilidad por defecto

- Todo control debe funcionar con teclado.
- El foco debe ser visible y no depender únicamente del color.
- Las animaciones deben respetar `prefers-reduced-motion`.
- El contenido debe seguir disponible si el vídeo, las imágenes o JavaScript fallan.
- Los objetivos táctiles deben medir al menos `44 × 44 px`.

## 3. Paleta y tokens

### 3.1. Colores base

| Token              | Valor                       | Uso principal                     |
| ------------------ | --------------------------- | --------------------------------- |
| `--black`          | `#050505`                   | Fondo general                     |
| `--black-soft`     | `#0d0d0f`                   | Fondo secundario                  |
| `--surface`        | `#121216`                   | Tarjetas y paneles                |
| `--surface-raised` | `#19191f`                   | Superficies elevadas              |
| `--text`           | `#f5f5f2`                   | Texto principal                   |
| `--text-muted`     | `#b9b9b4`                   | Texto secundario                  |
| `--magenta`        | `#ff2bd6`                   | Acción, marca y énfasis           |
| `--magenta-soft`   | `#9f218d`                   | Bordes y fondos magenta discretos |
| `--lime`           | `#deff00`                   | Datos, foco y acento técnico      |
| `--danger`         | `#ff6b84`                   | Error y campos inválidos          |
| `--success`        | `#b7e84b`                   | Confirmaciones                    |
| `--border`         | `rgba(245, 245, 242, 0.20)` | Divisores y contornos             |

Contraste comprobado sobre `#050505`:

- Texto principal: `18.66:1`.
- Texto secundario: `10.35:1`.
- Magenta: `6.38:1`.
- Lima: `17.87:1`.

### 3.2. Variables CSS de referencia

```css
:root {
  color-scheme: dark;
  --black: #050505;
  --black-soft: #0d0d0f;
  --surface: #121216;
  --surface-raised: #19191f;
  --text: #f5f5f2;
  --text-muted: #b9b9b4;
  --magenta: #ff2bd6;
  --magenta-soft: #9f218d;
  --lime: #deff00;
  --danger: #ff6b84;
  --success: #b7e84b;
  --border: rgba(245, 245, 242, 0.2);
  --content-width: 76rem;
  --focus-ring: 0 0 0 3px var(--black), 0 0 0 6px var(--lime);
}
```

### 3.3. Reglas de color

- Mantener el negro como color dominante, aproximadamente el 75–85 % de la superficie.
- Utilizar blanco roto para lectura; evitar blanco puro en grandes áreas.
- No usar magenta y lima con el mismo peso visual dentro de un componente.
- Magenta = acción o identidad. Lima = información o estado interactivo.
- Los fondos de color deben usar transparencias de entre `0.04` y `0.14`.
- Los brillos deben ser amplios y suaves, nunca una sombra dura alrededor de todo.

## 4. Tipografía

El sistema utiliza tres voces tipográficas.

### 4.1. Display

```css
font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
font-style: italic;
font-weight: 900;
line-height: 0.9;
letter-spacing: 0.015em;
text-transform: uppercase;
```

Uso:

- `h1`, títulos de sección, cifras grandes y marca.
- Tamaño del hero: `clamp(4rem, 16vw, 12.5rem)`.
- Tamaño de sección: `clamp(3rem, 9vw, 7.5rem)`.
- Puede utilizar trazo y relleno transparente en títulos cortos.
- No usar para párrafos, formularios ni textos pequeños.

### 4.1.1. Firma Dog Rough

La fuente local `Dog Rough` se reserva para nombres propios de gran formato ligados a la identidad:

```css
font-family: 'Dog Rough', Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
font-weight: 400;
```

Usos confirmados: palabra `CANDEMOR` del hero principal y títulos de marca `Candeonato`. No se usa
en navegación, botones, párrafos ni nombres de sponsors. Siempre debe existir el fallback display y
hay que revisar el ajuste visual de línea porque la fuente tiene una caja irregular.

### 4.2. Interfaz y datos

```css
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
font-weight: 800;
letter-spacing: 0.08em;
text-transform: uppercase;
```

Uso:

- Eyebrows, metadatos, navegación, botones, cifras, pasos y estados.
- Tamaño habitual: `0.68rem`–`0.82rem`.
- Aumentar el espaciado entre letras a `0.12em`–`0.16em` en etiquetas cortas.

### 4.3. Lectura

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  sans-serif;
line-height: 1.6;
```

Uso:

- Párrafos, descripciones, formularios y textos de ayuda.
- Texto base: `1rem`.
- Entradilla: `clamp(1.12rem, 2.2vw, 1.5rem)`.
- Texto auxiliar: no bajar de `0.74rem` salvo información puramente complementaria.

### 4.4. Jerarquía recomendada

```text
Eyebrow monoespaciado
TÍTULO DISPLAY DE GRAN FORMATO
Entradilla clara de una o dos frases
Texto secundario con un máximo de 60ch
Acción o bloque de datos
```

## 5. Espaciado, geometría y retícula

### 5.1. Contenedor

```css
.section-shell {
  width: min(calc(100% - 2rem), 76rem);
  margin-inline: auto;
  padding-block: clamp(4rem, 9vw, 8rem);
}

@media (min-width: 48rem) {
  .section-shell {
    width: min(calc(100% - 5rem), 76rem);
  }
}
```

### 5.2. Escala espacial

Usar preferentemente esta familia de valores:

- Microespacio: `0.3rem`, `0.5rem`, `0.65rem`.
- Espacio de componente: `0.75rem`, `1rem`, `1.25rem`, `1.5rem`.
- Separación de bloques: `2rem`, `2.5rem`, `3rem`.
- Separación de secciones: `clamp(4rem, 9vw, 8rem)`.

### 5.3. Geometría

- Botones, inputs, tarjetas y paneles: esquinas rectas.
- Solo los controles exclusivamente icónicos pueden ser circulares.
- Utilizar bordes de `1px`; reservar `2px` para énfasis o esquinas decorativas.
- Construir layouts con CSS Grid y `minmax(0, 1fr)` para evitar desbordamientos.
- El cambio principal a escritorio sucede entre `48rem` y `64rem`.
- El ancho mínimo soportado es `20rem`.

## 6. Fondos y profundidad

### 6.1. Fondo general

```css
body {
  background:
    radial-gradient(circle at 80% 20%, rgba(255, 43, 214, 0.08), transparent 24rem), var(--black);
  color: var(--text);
}
```

### 6.2. Retícula editorial

```css
.page-grid {
  background:
    linear-gradient(180deg, rgba(5, 5, 5, 0.2), var(--black) 8rem),
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent calc(25% - 1px),
      rgba(245, 245, 242, 0.025) 25%
    );
}
```

### 6.3. Superficies

- Tarjeta estándar: `var(--surface)` con borde `var(--border)`.
- Tarjeta destacada: gradiente magenta de baja opacidad sobre `var(--surface)`.
- Tarjeta informativa: gradiente lima de baja opacidad sobre `var(--surface)`.
- Efecto cristal únicamente sobre vídeo o imagen: fondo negro translúcido y `backdrop-filter: blur(10px)`.
- No aplicar cristal a toda la interfaz.

### 6.4. Detalles gráficos

- Scanlines: líneas de `1px` con opacidad máxima de `0.04`.
- Retícula sobre el hero: celdas de `6rem`, opacidad aproximada de `0.32` y máscara vertical.
- Esquinas técnicas: una esquina lima y otra magenta para enmarcar material visual.
- Glow magenta: `0 0 2.2rem rgba(255, 43, 214, 0.28)` en acciones principales.

## 7. Hero con vídeo

El hero debe ocupar al menos `100svh` y contener las siguientes capas, de fondo a frente:

1. Poster estático.
2. Vídeo con `object-fit: cover`.
3. Viñeta oscura horizontal y vertical.
4. Retícula decorativa.
5. Navegación y contenido.
6. Controles multimedia.

### 7.1. Viñeta recomendada

```css
.hero-vignette {
  background:
    linear-gradient(
      90deg,
      rgba(5, 5, 5, 0.94) 0%,
      rgba(5, 5, 5, 0.72) 45%,
      rgba(5, 5, 5, 0.35) 75%,
      rgba(5, 5, 5, 0.65) 100%
    ),
    linear-gradient(
      180deg,
      rgba(5, 5, 5, 0.75) 0%,
      transparent 26%,
      transparent 65%,
      var(--black) 100%
    );
}
```

En móvil, utilizar una viñeta vertical más intensa para proteger título y botones.

### 7.2. Título con trazo

```css
.display-title {
  color: var(--text);
  font-size: clamp(4rem, 16vw, 12.5rem);
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: clamp(1px, 0.12vw, 2px) var(--text);
  text-shadow: 0 0 1.8rem rgba(255, 43, 214, 0.35);
}
```

- Utilizar este tratamiento solo en un título corto y reconocible.
- Añadir un duplicado magenta desplazado con opacidad baja si se necesita profundidad.
- En colores forzados, eliminar trazo y mostrar relleno sólido.

### 7.3. Controles multimedia

- Controles necesarios: reproducir/pausar, silenciar/activar sonido y ver/restaurar interfaz.
- Tamaño mínimo: `2.75rem` por lado.
- Forma circular, fondo negro translúcido, borde claro y blur de `10px`.
- Cada botón necesita nombre accesible dinámico y `aria-pressed` cuando represente un estado.
- Mantener los controles visibles en el modo de visualización limpia.
- `Escape` debe restaurar la interfaz.
- Los elementos ocultos deben tener opacidad `0`, `pointer-events: none`, `aria-hidden` e `inert`.

## 8. Componentes

### 8.1. Botones

Base:

```css
.button {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

Variantes:

- Primario: fondo magenta, texto negro y glow discreto.
- Secundario: fondo negro translúcido, borde claro y texto blanco.
- Hover: desplazamiento vertical máximo de `-2px`.
- Foco: doble anillo negro + lima.
- Deshabilitado: opacidad `0.55`, sin desplazamiento y cursor acorde al estado.

### 8.2. Encabezados de sección

- Eyebrow lima y monoespaciado.
- Título display de gran formato, contorno blanco y relleno negro.
- Entradilla opcional de hasta `60ch`.
- Separación inferior entre `2rem` y `4rem`.

### 8.3. Tarjetas de datos

- Crear una retícula continua compartiendo bordes, sin espacios entre tarjetas.
- Etiqueta técnica en lima.
- Valor principal con tipografía display, cursiva y mayúsculas.
- Descripción secundaria de hasta `30ch`.
- Altura mínima aproximada de `14rem`.
- Distribución: una columna en móvil, dos desde `42rem`, cuatro desde `64rem`.

### 8.4. Listas numeradas

- No utilizar una tarjeta independiente por elemento.
- Separar las filas con líneas horizontales.
- Número monoespaciado magenta en una columna propia.
- Título en mayúsculas y descripción secundaria de hasta `60ch`.

### 8.5. Formularios

- Inputs de altura mínima `3.25rem`, fondo claro al `3.5 %` y borde visible.
- Etiqueta siempre visible; no usar el placeholder como sustituto.
- Indicar campos obligatorios en texto y visualmente.
- Mensajes de ayuda y error asociados mediante `aria-describedby`.
- Campos inválidos con `aria-invalid="true"` y color `--danger`.
- Radios personalizados con el input nativo presente en el árbol accesible.
- Confirmaciones y errores generales deben usar texto, color y borde.
- En escritorio se permiten dos columnas; los campos largos ocupan toda la fila.

### 8.6. Material visual

- Proporción preferida: `16 / 9`.
- Recortar con `object-fit: cover`.
- Añadir borde fino, dos esquinas técnicas y scanline opcional.
- El pie de foto combina descripción normal con un identificador monoespaciado en lima.
- Excepción para carteles y logotipos: usar `object-fit: contain` y un fondo neutro cuando sea
  importante ver la pieza completa. Nunca recortar carteles de ediciones ni logos de sponsors.

### 8.7. Footer

- Fondo casi negro `#020202` y borde superior.
- Marca display, bloques de información y etiquetas magenta.
- Una columna en móvil; cuatro columnas desde `48rem`.
- Enlaces subrayados con offset y hover lima.

### 8.8. Alertas y confirmaciones

- Mantener los errores de validación junto al campo que los provoca y anunciarlos con `role="alert"`.
- Anunciar los mensajes de éxito y los cambios no urgentes con `role="status"` y una región viva.
- Diferenciar información, éxito y error mediante icono, texto, borde y color; nunca solo mediante color.
- Las acciones destructivas o que descartan trabajo deben abrir el diálogo compartido de confirmación,
  con un mensaje que nombre la consecuencia y una acción principal explícita.
- El botón «Cancelar» recibe el foco inicial. `Escape`, cerrar el diálogo o pulsar el fondo equivalen a
  cancelar y nunca deben ejecutar la acción.
- Usar el tono de advertencia en lima para cambios reversibles y el tono de peligro para eliminaciones,
  revocaciones y pérdidas de datos.
- No usar `window.alert` ni `window.confirm`: rompen la identidad visual y ofrecen poco control sobre el
  texto, el foco y el comportamiento responsive.
- Las entradas visuales de los avisos deben ser breves y respetar `prefers-reduced-motion`.

### 8.9. Marca compartida en navegación

- Todas las cabeceras y pantallas de acceso deben renderizar la marca mediante
  `app-cande-brand`; no se escribe `CANDE...` manualmente en cada plantilla.
- El componente centraliza el prefijo `CANDE`, la tipografía, el magenta del sufijo, el foco
  visible, el nombre accesible y la ruta predeterminada.
- Las variantes admitidas son `web`, `candeonato`, `setups`, `skins`, `access` y `admin`.
- Cada área conserva su sufijo para orientar al usuario: `CANDEWEB`, `CANDEONATO`,
  `CANDESETUPS`, `CANDESKINS`, `CANDEACCESS` y `CANDEADMIN`.
- Una cabecera puede especializar la ruta, el fragmento o el nombre accesible sin volver a definir
  el contenido ni los estilos de la marca.

## 9. Movimiento e interacción

### 9.1. Duraciones

| Tipo                       | Duración           | Curva                  |
| -------------------------- | ------------------ | ---------------------- |
| Hover y controles          | `160ms`            | `ease`                 |
| Ocultar/restaurar interfaz | `320ms`            | `ease`                 |
| Indicador de scroll        | `900ms`            | `ease-in-out`, alterno |
| Entrada al hacer scroll    | Ligada al viewport | Lineal                 |

### 9.2. Reglas

- Animar únicamente `opacity`, `transform`, colores y bordes.
- El hover no debe desplazar más de `2px`.
- Las entradas de sección pueden subir `1.5rem` mientras pasan de `0.35` a `1` de opacidad.
- No animar texto durante la lectura.
- No ocultar información esencial detrás de una animación.

### 9.3. Movimiento reducido

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .hero-video {
    display: none;
  }
}
```

Si el usuario solicita expresamente ver el vídeo, puede mostrarse de nuevo, pero debe permanecer bajo su control.

## 10. Responsive

Diseñar primero para móvil y ampliar progresivamente.

### Móvil: `20rem`–`47.99rem`

- Una columna.
- Margen lateral de `1rem`.
- Navegación simplificada sin menú horizontal que desborde.
- Hero alineado hacia el borde inferior.
- Viñeta vertical intensa.
- Botones que puedan envolver en varias líneas.

### Tablet: desde `42rem` o `48rem`

- Formularios y grids en dos columnas cuando el contenido lo permita.
- Margen lateral de `2.5rem`.
- Navegación horizontal completa.

### Escritorio: desde `64rem`

- Composiciones asimétricas `0.85fr / 1.15fr` o `1.25fr / 0.75fr`.
- Retículas de cuatro datos.
- Paneles secundarios sticky solo si no bloquean contenido.
- Mantener el ancho máximo en `76rem`; no estirar líneas de lectura.

Probar como mínimo en `390 × 844`, `768 × 1024` y `1440 × 900`, además de zoom al `200 %`.

## 11. Accesibilidad obligatoria

- Incluir un enlace «Saltar al contenido» como primer elemento enfocable.
- Mantener un solo `h1` y una jerarquía de encabezados coherente.
- Usar landmarks semánticos: `header`, `nav`, `main`, `section`, `form` y `footer`.
- Todo icono interactivo necesita un nombre accesible; los decorativos deben ocultarse del lector.
- No eliminar el outline sin sustituirlo por un foco igual o más visible.
- Mantener contraste WCAG AA en estados normal, hover, foco y deshabilitado.
- No comunicar estados solo mediante magenta, lima o rojo.
- Respetar `prefers-reduced-motion` y `forced-colors`.
- Usar `inert` y `aria-hidden` en interfaces visualmente ocultas.
- Asegurar orden lógico del foco y ausencia de trampas de teclado.
- Todos los formularios deben poder completarse sin ratón.

Foco de referencia:

```css
:focus-visible {
  border-radius: 0.15rem;
  outline: 2px solid var(--lime);
  outline-offset: 4px;
}
```

## 12. Rendimiento multimedia

- Exportar poster en AVIF/WebP y ofrecer fallback compatible si es necesario.
- Incluir vídeo WebM/AV1 y MP4 optimizado cuando el soporte objetivo lo requiera.
- Definir `poster`, dimensiones o `aspect-ratio` para evitar cambios de layout.
- Mantener el contenido HTML independiente de la carga del vídeo.
- Cargar primero poster, texto y controles.
- Permitir solicitudes HTTP parciales (`Range`) para vídeos y aplicar caché inmutable a los bundles
  versionados.
- Negociar Brotli o Gzip para HTML, CSS, JavaScript y otros recursos de texto; no recomprimir vídeo,
  imágenes ni fuentes que ya usan formatos comprimidos.
- Evitar vídeos de fondo en pantallas o conexiones donde su coste no aporte valor.
- Comprobar LCP, CLS y respuesta de los controles en una conexión móvil simulada.

## 13. Qué evitar

- Fondos blancos o grandes superficies de color saturado.
- Degradados arcoíris o más de dos acentos simultáneos.
- Bordes redondeados tipo aplicación SaaS.
- Sombras negras convencionales en todas las tarjetas.
- Párrafos centrados o en mayúsculas.
- Texto importante colocado directamente sobre vídeo sin viñeta.
- Glitch permanente, parpadeos o animaciones rápidas.
- Carruseles automáticos.
- Iconos sin etiqueta accesible.
- Tipografía display en textos largos.
- Una tarjeta flotante para cada fragmento de contenido.
- Valores de opacidad tan bajos que oculten información necesaria.

## 14. Proceso para aplicar este estilo a otra web

1. Identificar la acción principal, el mensaje del hero y un máximo de dos acentos funcionales.
2. Aplicar los tokens sin cambiar arbitrariamente sus funciones semánticas.
3. Definir la jerarquía de contenido antes de añadir vídeo, retícula o glow.
4. Construir primero la versión móvil y la navegación por teclado.
5. Añadir componentes editoriales: encabezados, listas, grids y formularios.
6. Incorporar material visual con poster y overlays de contraste.
7. Añadir movimiento solo después de que la página funcione sin él.
8. Validar responsive, zoom, teclado, lector de pantalla, contraste y movimiento reducido.
9. Comprobar rendimiento con conexión móvil.
10. Eliminar efectos que no aporten jerarquía, contexto o interacción.

## 15. Instrucción base para una futura skill

```md
Diseña la interfaz siguiendo el sistema «Neon Motorsport» definido en este documento.

- Conserva una base negra cinematográfica con blanco roto.
- Usa magenta para marca y acciones principales; lima para datos y foco.
- Combina titulares display condensados e itálicos, etiquetas monoespaciadas y cuerpo sans-serif.
- Emplea layouts editoriales amplios, bordes rectos, retículas discretas y superficies de bajo contraste.
- Si existe vídeo de fondo, añade poster, viñeta, controles accesibles y modo de visualización limpia.
- Diseña mobile-first y respeta los requisitos de accesibilidad, movimiento reducido y colores forzados.
- Prioriza contenido y legibilidad frente a efectos decorativos.
- No inventes información del producto para rellenar la composición.
```

## 16. Lista de verificación

### Identidad

- [ ] El fondo oscuro domina y los acentos se usan con moderación.
- [ ] Magenta y lima mantienen funciones visuales diferentes.
- [ ] Los títulos, datos y textos usan la voz tipográfica adecuada.
- [ ] La geometría es principalmente recta y editorial.

### UX

- [ ] La acción principal es evidente en el primer viewport.
- [ ] Las secciones tienen una jerarquía clara y texto escaneable.
- [ ] Los controles reflejan sus estados y ofrecen feedback.
- [ ] El contenido funciona sin vídeo ni animaciones.

### Accesibilidad

- [ ] Se puede recorrer y operar toda la página con teclado.
- [ ] El foco es visible en todos los elementos interactivos.
- [ ] Los controles de icono tienen nombre accesible.
- [ ] Los errores de formulario se explican con texto.
- [ ] Se respetan movimiento reducido y colores forzados.
- [ ] La página funciona con zoom del `200 %` sin desbordamiento horizontal.

### Calidad

- [ ] El poster aparece antes que el vídeo.
- [ ] No hay cambios de layout provocados por imágenes.
- [ ] Los párrafos no superan `60ch`.
- [ ] Se ha probado en móvil, tablet y escritorio.
- [ ] Los efectos decorativos no reducen el contraste.

## 17. Archivos de referencia actuales

La implementación que originó este sistema se encuentra en:

- `src/styles.css`: tokens, tipografía, botones y accesibilidad global.
- `src/app/app.css`: fondo editorial y footer.
- `src/app/candeonato/components/hero/`: hero, vídeo y controles.
- `src/app/candeonato/components/about/`: composición de texto e imagen.
- `src/app/candeonato/components/requirements/`: grids de datos y agenda.
- `src/app/candeonato/components/rules/`: listas numeradas y manifiesto.
- `src/app/candeonato/components/form-inscription/`: formularios y estados.

Este documento es la fuente conceptual. Los archivos CSS son la fuente de implementación actual y pueden evolucionar siempre que conserven estas reglas.
