# objetivos a realizar

# Mejoras de diseño, UX y accesibilidad

## Prioridad alta

- [x] Reducir el espacio vacío entre secciones.
  - Sustituir `gap-300` por un valor aproximado de `gap-16`, `gap-24` o un sistema responsive.
  - Archivo: `src/app/app.html`.

- [x] Corregir el conflicto de altura entre secciones.
  - `section:last-of-type { min-height: 100vh; }` está afectando a la única sección de cada componente.
  - Aplicar `100vh` exclusivamente a la sección del formulario o usar una clase específica.
  - Archivo: `src/styles.css`.

- [x] Hacer visible el contenido por defecto.
  - Evitar que títulos, párrafos y formularios comiencen permanentemente con `opacity: 0`.
  - Aplicar las animaciones únicamente dentro de `@supports (animation-timeline: view())`.
  - Archivo: `src/styles.css`.

- [x] Añadir soporte para movimiento reducido.
  - Usar `@media (prefers-reduced-motion: reduce)`.
  - Desactivar vídeo automático, efecto de escritura, blur, flecha animada y transiciones de scroll.

- [x] Corregir la reproducción automática del vídeo.
  - Iniciar el vídeo silenciado con `muted`.
  - Permitir que el usuario active el sonido manualmente.
  - Añadir un control para reproducir y pausar.
  - Archivo: `src/app/candeonato/components/hero/hero.html`.

- [x] Optimizar el vídeo de fondo.
  - El vídeo actual pesa aproximadamente 61 MB.
  - Crear versiones WebM/AV1 y MP4 optimizadas.
  - Añadir una imagen `poster`.
  - Cambiar `preload="auto"` por `preload="metadata"` o `none`.
  - Preparar una versión vertical o un poster específico para móvil.

- [x] Garantizar el contraste sobre el vídeo.
  - Mantener un degradado o vignette oscuro permanente detrás del texto.
  - No depender del oscurecimiento producido únicamente durante el scroll.

## Hero

- [x] Mantener un título principal fijo.
  - Ejemplo: `CANDEONATO`.
  - Evitar borrar continuamente el `<h1>`.

- [x] Eliminar el texto provisional `OTRO MENSAJE`.
  - Archivo: `src/app/candeonato/components/hero/hero.ts`.

- [x] Añadir una descripción breve.
  - Ejemplo: `Carreras limpias, Mazda MX-5 y buen ambiente en iRacing`.

- [x] Sustituir el contador fijo por uno funcional.
  - Añadir etiquetas accesibles para días, horas, minutos y segundos.
  - Ocultar el formato decorativo a lectores de pantalla.

- [x] Añadir acciones principales.
  - Botón principal: `Inscribirme`.
  - Acción secundaria: `Ver reglas`.

- [x] Ocultar la flecha al abandonar el hero.
  - Actualmente permanece fija durante toda la página y puede solaparse con el formulario.

## Control de sonido

- [x] Sustituir el `<span>` por un `<button type="button">`.

- [x] Añadir un nombre accesible.
  - Ejemplo: `aria-label="Activar sonido"`.

- [x] Comunicar el estado.
  - Usar `aria-pressed`.
  - Cambiar correctamente entre los iconos de sonido activado y desactivado.

- [x] Permitir interacción mediante teclado.

- [x] Mantener un área táctil mínima de `44 × 44 px`.

- [x] Añadir estados `hover`, `focus-visible` y `active`.

## Modo de visualización del vídeo

- [x] Añadir un botón `Ver vídeo` junto a los controles de reproducción y sonido.

- [x] Al activar `Ver vídeo`, reducir a `0` la opacidad de todos los elementos superpuestos al vídeo.
  - Ocultar navegación, contenido del hero, retícula, vignette y llamada a continuar.
  - Mantener visibles y operativos los botones de reproducción, sonido y visualización.

- [x] Permitir recuperar la interfaz desde el mismo botón o mediante la tecla `Escape`.

- [x] Comunicar el estado del modo mediante `aria-pressed` y un nombre accesible dinámico.

- [x] Evitar que los elementos ocultos reciban foco o interacción mientras el modo esté activo.

## Estructura y navegación

- [x] Envolver todo el contenido principal dentro de `<main>`.

- [x] Utilizar `<header>` para el hero.

- [x] Asociar cada `<section>` con su título mediante `aria-labelledby`.

- [x] Añadir navegación rápida.
  - Qué es.
  - Requisitos.
  - Reglas.
  - Inscripción.

- [x] Añadir un footer.
  - Contacto o Discord.
  - Organización.
  - Privacidad.
  - Redes sociales, si existen.

## Contenido

- [x] Sustituir `imagen de coche rotando` por contenido visual real.

- [x] Evitar repetir el mismo texto en “Qué es” y “Reglas”.

- [x] Explicar claramente:
  - Qué juego se necesita.
  - Qué coche se utilizará.
  - Qué circuitos se utilizarán.
  - Si la participación es gratuita.
  - Fecha y horario.
  - Número de plazas.
  - Cómo se recibe la confirmación.

- [x] Convertir las reglas en una lista numerada y escaneable.

- [x] Corregir los textos:
  - `¿ QUE ES ?` → `¿QUÉ ES?`
  - `Estan` → `Están`
  - `sancioón` → `sanción`
  - `proximos` → `próximos`
  - `lios` → `líos`
  - `Necesitaras` → `Necesitarás`
  - `Iracing` → `iRacing`

## Formulario

- [x] Añadir un título o introducción que explique qué sucede al inscribirse.

- [x] Añadir atributos `name` a todos los campos.

- [x] Marcar los campos obligatorios con `required`.

- [x] Añadir `autocomplete`.
  - Nombre: `autocomplete="name"`.
  - Correo: `autocomplete="email"`.

- [x] Añadir instrucciones para localizar el ID de iRacing.

- [x] Leer el Google Form guardado en `registration_url` para la edición actual y convertir sus
      preguntas, opciones y apartados en controles nativos con el diseño de Candeweb. No se muestra
      la interfaz ni el `iframe` de Google Forms.
- [x] Enviar las respuestas desde Candeweb a los campos oficiales `entry.*` de Google Forms a través
      del backend. Se admiten enlaces cortos `forms.gle` y enlaces completos
      `docs.google.com/forms`.
- [x] Conservar un enlace para abrir el formulario en una pestaña nueva y un estado honesto cuando
      administración todavía no haya configurado ninguno.
- [x] No copiar manualmente en Angular los IDs ni las preguntas: los cambios realizados en Google
      Forms aparecen automáticamente tras expirar la caché de cinco minutos.
- [x] Utilizar el formulario oficial como alternativa segura si Google cambia su formato o incluye
      un campo no compatible, como una subida de archivos.

- [x] Añadir validación accesible.

- [x] Mostrar errores junto al campo correspondiente.

- [x] Asociar errores e instrucciones mediante `aria-describedby`.

- [x] Añadir un estado de envío.
  - Enviando.
  - Inscripción completada.
  - Error al enviar.

- [x] Convertir “Inscribirse” en un botón claramente reconocible.
  - Fondo magenta o lima.
  - Buen contraste.
  - Altura mínima de `44 px`.
  - Estados `hover`, `focus-visible`, `active` y `disabled`.

- [x] Añadir información de privacidad y consentimiento cuando corresponda.

## Accesibilidad general

- [x] Cambiar `<html lang="en">` por `<html lang="es">`.
  - Archivo: `src/index.html`.

- [x] Eliminar `select-none` del `<body>`.
  - El usuario debe poder seleccionar y copiar el contenido.

- [x] Mantener un único `<h1>` y una jerarquía ordenada de encabezados.

- [x] Evitar que lectores de pantalla anuncien cada cambio de la animación de escritura.
  - Mantener un título accesible estático.
  - Marcar la animación decorativa con `aria-hidden="true"`.

- [x] Proporcionar una alternativa textual para los mensajes incluidos dentro del vídeo.

- [x] Añadir estilos visibles de `focus-visible` a enlaces, botones e inputs.

- [x] Comprobar contraste WCAG AA.
  - Texto normal: mínimo `4.5:1`.
  - Texto grande: mínimo `3:1`.
  - Controles e indicadores: mínimo `3:1`.

- [x] Evitar títulos con `color: transparent` sin un fallback.
  - En modo de alto contraste podrían desaparecer.

- [x] Probar navegación completa usando únicamente el teclado.

## Dirección visual sugerida

- [x] Utilizar negro casi puro como fondo principal: `#050505`.

- [x] Utilizar blanco cálido para textos: aproximadamente `#F5F5F2`.

- [x] Utilizar magenta neón como acento principal.

- [x] Reservar el amarillo/lima para datos, estados y pequeños detalles.

- [x] Usar títulos grandes, inclinados y contorneados como los del vídeo.

- [x] Mantener los párrafos sólidos y sin efectos para favorecer la lectura.

- [x] Limitar los párrafos a aproximadamente `60ch`.

- [x] Añadir etiquetas monoespaciadas.
  - `01 / EVENTO`
  - `02 / REQUISITOS`
  - `03 / REGLAS`
  - `04 / INSCRIPCIÓN`

- [x] Utilizar efectos glow, glitch y blur con moderación.
  - Aplicarlos a titulares y transiciones.
  - No aplicarlos a textos informativos o formularios.

- [x] Crear bloques visuales para los datos técnicos.
  - `IRACING`
  - `MAZDA MX-5`
  - `SETUP FIXED`
  - `CIRCUITOS GRATUITOS`

## Estructura recomendada

1. Hero con vídeo, nombre del evento, fecha, contador y CTA.
2. Manifiesto o explicación breve del evento.
3. Ficha técnica con coche, simulador, circuitos y formato.
4. Reglas numeradas.
5. Calendario o información de la carrera.
6. Formulario de inscripción.
7. Confirmación, contacto y footer.

## Sistema deportivo

El Candeonato es un campeonato compuesto por varias carreras y utiliza el sistema de Fat Cat Race.
Candeweb consulta sus datos públicos para recapitular rondas, posiciones y puntos. El orden, los
desempates y las sanciones pertenecen a Fat Cat Race y se presentan sin recalcularlos ni sustituirlos
por reglas inventadas en esta web.

## Pruebas finales

- [x] Probar en 390 × 844 px.
- [x] Probar en 768 × 1024 px.
- [x] Probar en 1440 × 900 px.
- [x] Probar con zoom del navegador al 200 %.
- [x] Probar con `prefers-reduced-motion`.
- [x] Probar en modo de alto contraste.
- [x] Probar con teclado.
- [x] Validación local con tecnología de apoyo confirmada por la persona propietaria después de la
      comprobación automática del árbol accesible y del teclado.
- [x] Probar con conexión móvil lenta.
- [x] Comprobar el formulario con datos válidos e inválidos.

## Verificación de implementación

- Fecha de auditoría inicial: 9 de agosto de 2026. Revisión tras las integraciones: 11 de agosto de 2026.
- Compilación de producción: `npm run build` completada sin errores ni advertencias.
- Verificación actual del proyecto: 19 pruebas de servidor y 46 pruebas Angular superadas en 21
  archivos; compilación de producción correcta y 0 vulnerabilidades de producción.
- Formulario: validación de envío vacío y envío válido comprobados sin crear una respuesta de prueba real.
- Destino del formulario: se utilizan los identificadores públicos reales de nombre de iRacing, usuario de Discord y estado pre-carrera del formulario oficial.
- Responsive: comprobado sin desbordamiento horizontal en 390 × 844, 768 × 1024, 1440 × 900 y ancho equivalente a zoom del 200 %.
- Accesibilidad automática: árbol accesible inspeccionado con un único `h1`, landmarks, encabezados,
  controles, campos y nombres accesibles. La persona propietaria confirmó después la validación
  auditiva local con tecnología de apoyo; deberá repetirse en el dominio definitivo.
- Revisión renderizada a `390 × 844` en `/candeonato`, `/candeonatos`, `/candeonatos/42` y
  `/admin/login`: sin desbordamiento horizontal, IDs duplicados, imágenes sin alternativa o
  dimensiones, ni controles interactivos sin nombre accesible.
- Teclado: orden de tabulación completo comprobado desde el enlace de salto hasta el formulario y el enlace alternativo.
- Movimiento reducido: vídeo pausado y oculto; animaciones de flecha y entrada desactivadas.
- Colores forzados: títulos con relleno visible y controles con borde reforzado.
- Contraste sobre `#050505`: texto principal 18,66:1; texto secundario 10,35:1; magenta 6,38:1; lima 17,87:1.
- Red móvil simulada: el contenido principal aparece antes de cargar el vídeo; el poster actúa como respaldo visual.
- Información todavía no facilitada por la organización: hora final, número exacto de plazas y lista definitiva de circuitos. La interfaz los identifica expresamente como pendientes de confirmación por Discord para no inventar datos.
