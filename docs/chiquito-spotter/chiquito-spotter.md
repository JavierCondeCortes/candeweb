# Landing de producto — Chiquito Spotter

> Especificación funcional y visual implementada para presentar un producto de la comunidad Candemor,
> permitir probar muestras de audio y dirigir la compra a Patreon.

## Estado actual

La primera versión está disponible en `/chiquito-spotter`. Incluye una landing responsive, seis
muestras reales con transcripción, reproducción exclusiva de un audio cada vez, navegación bilingüe,
FAQ y accesos destacados desde el hero, la navegación y la portada de inicio y el footer compartido.

La landing enlaza directamente con la
[publicación oficial de Chiquito Spotter en Patreon](https://www.patreon.com/candemor/posts/chiquitito-151646382).
El precio, la modalidad de acceso y las condiciones de entrega se presentan en Patreon; la
compatibilidad confirmada continuará documentándose en esta landing.

## 1. Qué se ha entendido

`Chiquito Spotter` será un producto digital de la comunidad con una landing pública propia. La web
no realizará el cobro: presentará el producto, resolverá dudas, reproducirá demostraciones de audio y
enviará a la persona interesada a Patreon para completar la compra o suscripción.

Se asume por el nombre que el producto es un spotter de audio relacionado con simracing. Antes de
publicar la landing habrá que confirmar su función exacta, juegos compatibles, proceso de instalación,
licencia, precio y modalidad de acceso en Patreon. La interfaz no debe inventar ninguno de esos datos.

## 2. Objetivo

La landing debe responder rápidamente a cuatro preguntas:

1. ¿Qué es Chiquito Spotter?
2. ¿Cómo suena?
3. ¿Dónde funciona y qué incluye?
4. ¿Cómo se consigue mediante Patreon?

La acción principal será `Conseguir en Patreon`. La demostración de audio será la principal prueba del
producto, no un elemento decorativo.

## 3. Ruta y acceso

| Elemento       | Propuesta                                                   |
| -------------- | ----------------------------------------------------------- |
| Ruta pública   | `/chiquito-spotter`                                         |
| Autenticación  | No necesaria                                                |
| Compra         | Enlace HTTPS externo a Patreon                              |
| Navegación     | Navbar pública de Candemor                                  |
| Descubrimiento | Enlace en el footer y, opcionalmente, tarjeta en la portada |

La landing debe poder compartirse directamente. No debe estar dentro de `/setups`, `/skins` ni del
área privada, porque su finalidad es presentar y vender un producto.

## 4. Concepto visual

Se conserva el sistema [Neon Motorsport](../design.md), pero se da identidad propia al producto:

- Fondo negro con textura discreta y una retícula técnica de baja opacidad.
- Titular de gran formato y geometría recta.
- Magenta para la marca y la acción de compra.
- Lima para estados del reproductor, tiempos y foco de teclado.
- Ondas de audio, subtítulos cortos o mensajes del spotter como recurso editorial.
- Imagen del producto, logotipo o captura real cuando estén disponibles.
- Animación de onda únicamente mientras se reproduce una muestra.

No se utilizará un vídeo de fondo en la primera versión: el sonido debe ser protagonista y no competir
con otro contenido multimedia. Si posteriormente se incorpora vídeo, empezará silenciado y nunca
activará un audio de demostración automáticamente.

## 5. Estructura recomendada

### 5.1. Navbar

- Marca Candemor con enlace a `/`.
- Enlace `Inicio`.
- Enlaces internos cortos: `Qué es`, `Escúchalo`, `Compatibilidad` y `Preguntas`.
- Botón principal `Conseguir en Patreon`.
- Selector de idioma junto al menú hamburguesa en móvil, siguiendo el patrón actual.

### 5.2. Hero

Contenido:

- Eyebrow: `Producto de la comunidad`.
- `h1`: `Chiquito Spotter`.
- Una frase real que explique qué aporta el producto, pendiente de redacción.
- Acción principal: `Conseguir en Patreon`.
- Acción secundaria: `Escuchar demostración`, con desplazamiento hasta `#demo`.
- Reproductor destacado con una muestra corta y claramente identificada.

El hero debe comunicar el producto en el primer viewport sin obligar a reproducir sonido. El botón de
audio mostrará siempre su estado: reproducir, pausa, cargando o error.

### 5.3. Qué es

Bloque editorial breve con:

- Descripción real del producto.
- Para quién está pensado.
- Qué problema resuelve o qué mejora en la experiencia.
- Tres características confirmadas como máximo.

No se mostrarán cifras, juegos o funcionalidades sin confirmar.

### 5.4. Escucha el spotter

Galería de muestras de audio. Cada muestra tendrá:

- Nombre comprensible, por ejemplo `Muestra 01` hasta conocer la situación real.
- Contexto de la frase o evento que representa.
- Botón reproducir/pausar.
- Barra de progreso operable con teclado.
- Tiempo transcurrido y duración.
- Transcripción textual del audio.
- Estado de carga y mensaje de error recuperable.

Solo puede sonar una muestra a la vez. Al iniciar otra, la anterior se pausa. Ningún audio se reproduce
automáticamente al cargar la página ni al hacer scroll.

### 5.5. Qué incluye

Lista escaneable de contenido confirmado. Posibles categorías que deben validarse antes de usarse:

- Tipo y cantidad de mensajes incluidos.
- Idioma o idiomas.
- Formato de entrega.
- Actualizaciones incluidas o no.
- Soporte y canal de contacto.

Este bloque no mostrará una tabla de planes salvo que existan realmente varias modalidades en Patreon.

### 5.6. Compatibilidad e instalación

Debe indicar de forma directa:

- Simuladores o aplicaciones compatibles.
- Sistemas operativos compatibles.
- Requisitos previos.
- Resumen de instalación.
- Enlace a una guía detallada si el proceso requiere varios pasos.

Si todavía no se conoce la compatibilidad completa, se mostrará únicamente la confirmada y un canal de
consulta. No se utilizará `Compatible con todo`.

### 5.7. Compra mediante Patreon

Bloque de conversión final con:

- Recordatorio breve del valor del producto.
- Precio y modalidad solo cuando estén confirmados.
- Explicación de qué ocurre después de pulsar el botón.
- Botón `Conseguir Chiquito Spotter en Patreon`.
- Indicación visible de que Patreon se abre en una pestaña nueva.

La primera versión debe usar un enlace externo normal con `target="_blank"`, `rel="noopener noreferrer"`
y nombre accesible. No se recomienda incrustar el checkout de Patreon: añade complejidad, posibles
cookies de terceros y distrae del recorrido principal.

### 5.8. Preguntas frecuentes

Preguntas mínimas pendientes de respuesta:

1. ¿Cómo recibo el producto después de comprarlo?
2. ¿En qué simuladores funciona?
3. ¿Cómo se instala y actualiza?
4. ¿La compra es única o requiere mantener una suscripción?
5. ¿Dónde solicito ayuda?
6. ¿Puedo escuchar muestras antes de comprar? Sí, desde la propia landing.

Se utilizarán elementos `details` y `summary` o un acordeón accesible. Las respuestas importantes no
dependerán de animaciones.

### 5.9. Footer

Se reutilizará el footer compartido. Se añadirá `Chiquito Spotter` como enlace público de producto,
separado de las bibliotecas privadas `Setups` y `Skins`.

## 6. Boceto de escritorio

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ CANDEMOR       Qué es  Escúchalo  Compatibilidad  Preguntas   [PATREON ↗]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ PRODUCTO DE LA COMUNIDAD                                                     │
│                                                                              │
│ CHIQUITO                                                                    │
│ SPOTTER                       ┌───────────────────────────────────────────┐   │
│                               │  MUESTRA DESTACADA                       │   │
│ Una frase real que explique   │  [▶]  ━━━━━━━━━━━━━━━  00:00 / 00:18    │   │
│ el valor del producto.        │  Transcripción disponible               │   │
│                               └───────────────────────────────────────────┘   │
│ [CONSEGUIR EN PATREON ↗] [ESCUCHAR DEMO ↓]                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 01 · QUÉ ES             Descripción + tres características confirmadas       │
├──────────────────────────────────────────────────────────────────────────────┤
│ 02 · ESCÚCHALO          [▶ Muestra 01] [▶ Muestra 02] [▶ Muestra 03]          │
├──────────────────────────────────────────────────────────────────────────────┤
│ 03 · QUÉ INCLUYE        Lista real              COMPATIBILIDAD + INSTALACIÓN │
├──────────────────────────────────────────────────────────────────────────────┤
│ ¿LISTO PARA ESCUCHARLO EN PISTA?                  [IR A PATREON ↗]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ PREGUNTAS FRECUENTES                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER COMPARTIDO                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 7. Comportamiento móvil

- Navbar compacta con idioma a la izquierda del menú hamburguesa.
- Hero en una columna: título, descripción, acciones y reproductor.
- Botones principales a ancho completo cuando ayude al toque.
- Muestras de audio apiladas, sin carrusel automático.
- Área táctil mínima de `44 × 44 px` para reproducción y progreso.
- Títulos grandes pero sin partir `Chiquito` en fragmentos ilegibles.
- CTA a Patreon repetido después de la demostración y al final, no fijado permanentemente sobre el
  contenido.

## 8. Accesibilidad del audio

- Reproducción iniciada exclusivamente por la persona usuaria.
- Control completo con teclado y foco visible.
- Etiquetas como `Reproducir muestra: salida de boxes`, no botones identificados solo con un icono.
- Transcripción para cada muestra.
- No comunicar el estado únicamente mediante color o una onda animada.
- Anunciar errores sin mover el foco inesperadamente.
- Respetar `prefers-reduced-motion` y detener visualizaciones no esenciales.
- Mantener una alternativa textual aunque el archivo no cargue.

## 9. Rendimiento y formato multimedia

Muestras públicas seleccionadas del paquete de trabajo `CHIQUITITO SPOTTER 0.4`:

| Situación          | Archivo público                          | Transcripción                                             |
| ------------------ | ---------------------------------------- | --------------------------------------------------------- |
| Lucha por posición | `/media/chiquito-spotter/POSFT.wav`      | `El coche de delante lucha por posición, no te rajes`     |
| Victoria           | `/media/chiquito-spotter/UWON7!.wav`     | `Vamos, campeón, has ganado…`                             |
| Top 10             | `/media/chiquito-spotter/TOP10!.wav`     | `No hagas el canelo, vas Top 10…`                         |
| Humo en el coche   | `/media/chiquito-spotter/SMOKING_2!.wav` | `Quietor, humo como para hacer un café…`                  |
| Daños graves       | `/media/chiquito-spotter/REPAIR_3!.wav`  | `Bro, vas dejando piezas por la pista como migas de pan…` |
| Reparación parcial | `/media/chiquito-spotter/DAMRPMOST!.wav` | `Podemos reparar la mayoría del daño…`                    |

Solo se han incorporado estas seis muestras; el archivo completo del producto no forma parte de los
recursos públicos de la web.

- Guardar una versión optimizada de cada muestra, preferiblemente MP3 para compatibilidad general.
- Mantener las demos cortas y descargar el audio solo cuando sea necesario (`preload="metadata"` o
  `none`).
- No cargar todos los audios completos al entrar en la página.
- Mostrar duración antes de reproducir cuando el metadato esté disponible.
- No exponer archivos completos del producto si las muestras son versiones recortadas de un contenido
  de pago.
- Confirmar que Candemor tiene permiso para publicar y comercializar todas las voces y audios usados.

## 10. SEO y contenido compartido

- `title`: `Chiquito Spotter | Candemor Racing Team`.
- Descripción real de entre 140 y 160 caracteres, pendiente de contenido definitivo.
- Imagen Open Graph específica del producto.
- URL canónica: `https://candemor.com/chiquito-spotter`.
- Datos estructurados de producto únicamente si precio, disponibilidad y condiciones están confirmados
  y se mantienen actualizados.

## 11. Arquitectura Angular propuesta

```text
src/app/pages/chiquito-spotter/
├── chiquito-spotter-page.ts
├── chiquito-spotter-page.html
├── chiquito-spotter-page.css
└── components/
    ├── product-hero/
    ├── audio-demo-list/
    ├── audio-demo-player/
    ├── compatibility-panel/
    ├── patreon-cta/
    └── product-faq/
```

El contenido y las muestras continúan en una configuración local tipada. La URL de Patreon es una
excepción porque cambia con cada versión: se guarda como `chiquito_spotter_url` en `site_settings` y
se edita manualmente desde el bloque `Chiquito Spotter` de los ajustes administrativos. La landing
consulta el valor público y conserva la publicación inicial como respaldo si la petición falla.

## 12. Datos necesarios antes de implementar

- [x] URL inicial de Patreon: `https://www.patreon.com/candemor/posts/chiquitito-151646382`.
- [x] URL de la versión más reciente administrable manualmente.
- [ ] Descripción breve y descripción completa del producto.
- [x] Seis archivos de muestra, con título y contexto.
- [x] Transcripción de las seis muestras publicadas.
- [ ] Logotipo, portada o imagen real del producto.
- [ ] Juegos, herramientas y sistemas operativos compatibles.
- [ ] Proceso de instalación y entrega.
- [ ] Precio, moneda y tipo de compra o suscripción.
- [ ] Política de actualizaciones, soporte y contacto.
- [ ] Confirmación de derechos de uso de las voces y audios.
- [ ] Contenido disponible en español e inglés.

## 13. Fases recomendadas

### Fase 1 — Boceto navegable

- [x] Hero, explicación, reproductor con muestras, compatibilidad, CTA y FAQ.
- [x] Contenido local con seis muestras reales.
- [x] Enlace externo a la publicación oficial de Patreon.
- [x] Responsive, teclado, transcripciones y movimiento reducido.

### Fase 2 — Contenido administrable

- [x] Administrar desde Ajustes la URL de la publicación más reciente en Patreon.
- Añadir al panel título, textos y orden de muestras solo si aparece una necesidad editorial real.
- Procesar los archivos mediante el sistema multimedia del servidor.
- Mantener historial o auditoría de cambios administrativos.

### Fase 3 — Medición respetuosa

- Medir reproducciones de muestra y clics de salida a Patreon sin guardar datos personales
  innecesarios.
- Mostrar aviso y consentimiento si la herramienta elegida utiliza cookies no esenciales.

## 14. Criterios de aceptación

- [x] La página explica qué es el producto antes de pedir la compra.
- [x] La demostración de audio se encuentra y entiende en el primer recorrido visual.
- [x] Nunca se reproducen dos muestras simultáneamente.
- [x] Ningún audio comienza sin interacción.
- [x] Todas las muestras tienen transcripción y controles accesibles.
- [x] Patreon se identifica como destino externo antes de abrirse.
- [ ] Precio, compatibilidad y prestaciones proceden de información confirmada.
- [x] La landing funciona en móvil, con teclado y movimiento reducido.
- [x] Los audios completos de pago no quedan expuestos como demos públicas.
- [x] El footer enlaza a `/chiquito-spotter`.

## 15. Opinión de diseño

La propuesta encaja bien con Candemor porque permite presentar un producto de comunidad sin convertir
la web en una tienda. Su mayor argumento de venta será escuchar el resultado, así que conviene enseñar
una muestra muy pronto y mantener Patreon como una salida clara y honesta.

La primera versión debe seguir siendo pequeña, rápida y editorial. La URL cambiante justifica un único
campo dentro de los ajustes existentes, pero no una tabla de versiones ni un gestor complejo. No se
recomienda crear un checkout propio: primero se validará la landing con contenido real, una selección
breve de muestras y una única acción de compra administrable.
