# Administración de contenidos de Candemor

> Especificación funcional y técnica para que una persona administradora pueda mantener los datos
> de la web sin editar componentes de Angular. El alcance incluye miembros, sponsors, skins y
> ediciones del Candeonato, además de la gestión centralizada de accesos privados.

## Objetivo

Crear un panel privado desde el que se pueda:

1. Crear, editar, ordenar, publicar y retirar miembros del equipo.
2. Registrar y mantener las ediciones del Candeonato.
3. Elegir qué Candeonato se presenta como edición actual o destacada.
4. Sincronizar los resultados deportivos desde la API pública sin reescribirlos manualmente.
5. Modificar un conjunto pequeño de ajustes globales, como el canal de Twitch y los enlaces de
   contacto.
6. Crear, editar, ordenar, publicar, archivar y eliminar sponsors y colaboradores.
7. Mantener el catálogo privado de skins.
8. Conceder desde un único apartado los permisos independientes de Setups y Skins.

El panel debe ser la fuente de verdad del **contenido editorial**. La API de Fat Cat Race seguirá
siendo la fuente de verdad de rondas, posiciones, puntos y estadísticas deportivas.

Las zonas privadas tienen permisos y almacenamiento propios. Sus especificaciones se mantienen en
[Biblioteca privada de setups](../setups/setups.md), [Biblioteca privada de skins](../skins/skins.md)
y [Gestión centralizada de accesos](../accesos/accesos.md), para que autorizar contenido privado no
conceda acceso editorial a `/admin`.

## Estado actual del proyecto

La primera versión funcional del panel ya está implementada dentro del repositorio:

- API propia en Node y base de datos SQLite con migraciones versionadas.
- Una cuenta propietaria y cuentas administradoras aprobadas por ella, con sesiones independientes,
  protección CSRF, limitación de intentos y TOTP obligatorio para todas las cuentas.
- CRUD completo, orden, publicación y archivo lógico de miembros, sponsors y Candeonatos. El listado de
  miembros ofrece `Añadir`, `Editar` y `Eliminar`; eliminar exige confirmación y conserva un borrado
  lógico en la auditoría.
- Ajustes globales y auditoría consultables desde `/admin`.
- Subida de JPEG, PNG, WebP o AVIF; el original se conserva de forma privada y la copia pública se genera
  en WebP con proporción controlada. Las portadas generan además una variante móvil. Cada edición
  admite también un vídeo de fondo MP4 o WebM propio, de hasta 80 MB.
- Sincronización y snapshots de los resultados de Fat Cat Race.
- Consentimiento de publicación para fotografías, autor de la última modificación y correcciones
  deportivas transparentes sin alterar el payload externo.
- La portada, `/candeonato` y el historial consumen la API pública; los cinco perfiles iniciales se
  conservan como datos de demostración identificados hasta sustituirlos por datos reales.

No se necesita contratar una base de datos para ejecutar esta versión en local. Para publicar en
producción todavía hay que elegir un alojamiento con almacenamiento persistente, dominio y política
de copias de seguridad. PostgreSQL/Supabase continúa siendo una alternativa futura si el proyecto
crece o se despliega en varias instancias.

## Arquitectura recomendada

### Implementación actual

- **Base de datos:** SQLite mediante `node:sqlite`, almacenada por defecto en
  `server/data/candemor.db`.
- **Autenticación:** sesión opaca en cookie `HttpOnly` y contraseñas derivadas con `scrypt`.
- **Cuentas:** el primer alta desde `/admin/login` crea al propietario. Las demás personas solicitan
  acceso y solo se registran después de que el propietario genere una invitación privada.
- **Almacenamiento:** originales privados en `server/data/originals` y derivados WebP servidos desde
  `server/data/uploads` mediante `/uploads`.
- **API administrativa:** servidor Node que valida autenticación, rol propietario, TOTP, CSRF y datos en cada
  operación.
- **Frontend:** rutas Angular lazy-loaded bajo `/admin`.

La UI consume servicios y modelos propios, por lo que una migración futura a PostgreSQL, Supabase o
almacenamiento de objetos no obliga a rediseñar las pantallas.

### Entorno de producción preparado, pendiente de activar

La configuración reproducible propone **Render**, región Frankfurt, como un único servicio Node con
un disco persistente de 1 GB. El archivo `render.yaml` compila Angular, arranca la API y el frontend
desde el mismo origen, configura `/api/health`, genera el token del primer alta y monta
`server/data/` sobre el disco.

Esta opción encaja con el volumen inicial y con SQLite, pero requiere una instancia de pago: los
servicios gratuitos no conservan archivos locales y los discos persistentes solo se pueden conectar
a una instancia. Tampoco permite escalar horizontalmente mientras se mantenga SQLite. Si el tráfico
exige varias instancias, la siguiente migración será PostgreSQL y almacenamiento de objetos.

- [Blueprints de Render](https://render.com/docs/blueprint-spec)
- [Discos persistentes de Render](https://render.com/docs/disks)

### Flujo de datos

```text
Administrador
    │ inicia sesión
    ▼
Panel Angular /admin
    │ solicitudes autenticadas
    ▼
API o funciones serverless
    ├── SQLite: miembros, ediciones, ajustes y auditoría
    ├── Almacenamiento: fotografías y portadas
    └── Fat Cat Race API: rondas, puntos y clasificaciones
            │
            ▼
       snapshot/caché histórico
```

La web pública nunca debe conectarse con credenciales de administración ni recibir secretos.

## Rutas del panel

| Ruta                        | Función                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `/admin/login`              | Inicio de sesión                                                 |
| `/admin/solicitar-acceso`   | Solicitud pública sujeta a aprobación                            |
| `/admin/aceptar-invitacion` | Alta mediante enlace privado de un solo uso                      |
| `/admin`                    | Resumen, alertas y accesos rápidos                               |
| `/admin/miembros`           | Listado, orden y estado de los miembros                          |
| `/admin/miembros/nuevo`     | Alta de un miembro                                               |
| `/admin/miembros/:id`       | Edición, vista previa y retirada                                 |
| `/admin/candeonatos`        | Listado de ediciones y estado de sincronización                  |
| `/admin/candeonatos/nuevo`  | Registro de una edición                                          |
| `/admin/candeonatos/:id`    | Edición, publicación, sincronización y acceso a la vista pública |
| `/admin/sponsors`           | Listado, estado y acciones de sponsors                           |
| `/admin/sponsors/nuevo`     | Alta de un sponsor                                               |
| `/admin/sponsors/:id`       | Edición, vista previa, publicación y retirada                    |
| `/admin/skins`              | Listado, orden y estado de skins                                 |
| `/admin/skins/nueva`        | Alta de una skin                                                 |
| `/admin/skins/:id`          | Edición, publicación y retirada                                  |
| `/admin/accesos`            | Permisos centralizados de Setups y Skins                         |
| `/admin/ajustes`            | Twitch, contacto, edición destacada y valores globales           |
| `/admin/seguridad`          | Alta o rotación de segundo factor y códigos de recuperación      |
| `/admin/administradores`    | Solicitudes, invitaciones y cuentas; solo para el propietario    |
| `/admin/auditoria`          | Historial de acciones; puede posponerse visualmente, no en datos |

Las rutas públicas continúan siendo `/`, `/candeonato`, `/candeonatos` y
`/candeonatos/:torneoId`. `/setups` y `/skins` son rutas visibles pero protegidas por producto.

Las rutas protegidas `/setups` y `/skins` reutilizan la misma identidad y sesión. Owner y admin
gestionan desde `/admin/accesos` los permisos independientes `can_access_setups`,
`can_upload_setups` y `can_access_skins`, sin convertir a esas personas en administradoras de
`/admin`.

## Cuenta y permisos

### Propietario y administradores

- El propietario puede hacer todo lo que hace un administrador y además aceptar o rechazar
  solicitudes, renovar invitaciones, desactivar cuentas y revocar sus sesiones.
- Los administradores pueden mantener contenido, cambiar la edición destacada, sincronizar la API
  externa y consultar el historial.
- Cada cuenta tiene correo, contraseña derivada con `scrypt`, secreto TOTP, códigos de recuperación
  y sesiones propios.
- El propietario no puede desactivarse desde el panel y ningún administrador puede gestionar
  cuentas.

No existe alta administrativa directa. Una solicitud no concede acceso: el enlace generado al
aprobarla caduca en 24 horas, solo se muestra al propietario y deja de servir al utilizarse o
renovarse. El envío se hace manualmente con el botón de correo para no exigir un proveedor externo.

## Contenido administrable

| Área        | Administrable en el panel                                                 | Fuente         |
| ----------- | ------------------------------------------------------------------------- | -------------- |
| Miembros    | Nombre, foto, descripción, redes, orden, visibilidad y destacados         | BBDD           |
| Candeonatos | Edición, textos, portada, vídeo, fechas, enlaces, estado y torneo externo | BBDD           |
| Resultados  | Sincronizar, revisar fecha y conservar snapshot                           | API externa    |
| Portada     | Candeonato destacado, Twitch, correo y enlaces principales                | BBDD           |
| Multimedia  | Fotografías, portadas y vídeos de fondo por edición                       | Almacenamiento |
| Sponsors    | Nombre, logo, descripción, web, orden y estado                            | BBDD           |
| Skins       | Foto, nombre del coche, URL, orden y estado                               | BBDD           |
| Accesos     | Permisos independientes de Setups y Skins                                 | BBDD           |

Una galería manual queda fuera del MVP. La navegación pública se mantiene en código para conservar
una arquitectura clara; los sponsors forman parte del panel y Skins queda especificado como la
siguiente ampliación.

## Modelo: sponsor

| Campo           | Tipo           | Obligatorio | Reglas                            |
| --------------- | -------------- | ----------- | --------------------------------- |
| `id`            | UUID           | Sí          | Generado por el sistema           |
| `name`          | Texto          | Sí          | Entre 2 y 100 caracteres          |
| `description`   | Texto o `null` | No          | Máximo 240 caracteres             |
| `logo_url`      | URL o `null`   | Condicional | Obligatorio para publicar         |
| `logo_alt`      | Texto o `null` | Condicional | Obligatorio cuando existe logo    |
| `website_url`   | URL o `null`   | No          | Solo HTTPS                        |
| `display_order` | Entero         | Sí          | Igual o mayor que cero            |
| `status`        | Enum           | Sí          | `draft`, `published` o `archived` |

No se insertan sponsors de demostración: la portada muestra un estado vacío hasta que el
administrador publique un registro real.

## Modelo: miembro del equipo

### Campos

| Campo                     | Tipo           | Obligatorio | Reglas                                                      |
| ------------------------- | -------------- | ----------- | ----------------------------------------------------------- |
| `id`                      | UUID           | Sí          | Generado por el sistema                                     |
| `slug`                    | Texto          | Sí          | Único, minúsculas y guiones; se sugiere desde el nombre     |
| `name`                    | Texto          | Sí          | Entre 2 y 80 caracteres                                     |
| `alias`                   | Texto o `null` | No          | Máximo 50 caracteres                                        |
| `role_label`              | Texto o `null` | No          | Ejemplo: piloto, caster o dirección                         |
| `bio`                     | Texto o `null` | No          | Máximo 280 caracteres; texto plano                          |
| `photo_url`               | URL o `null`   | Condicional | Obligatoria para publicar un perfil destacado               |
| `photo_alt`               | Texto o `null` | Condicional | Obligatorio cuando existe fotografía; máximo 160 caracteres |
| `photo_consent_confirmed` | Booleano       | Condicional | Obligatorio para publicar una fotografía autorizada         |
| `twitch_url`              | URL o `null`   | No          | Solo `https://www.twitch.tv/...`                            |
| `instagram_url`           | URL o `null`   | No          | Solo HTTPS y dominio esperado                               |
| `youtube_url`             | URL o `null`   | No          | Solo HTTPS y dominio esperado                               |
| `x_url`                   | URL o `null`   | No          | Solo HTTPS y dominio esperado                               |
| `website_url`             | URL o `null`   | No          | Web personal o profesional; solo HTTPS                      |
| `display_order`           | Entero         | Sí          | Cero o positivo; reordenable desde la lista                 |
| `is_featured`             | Booleano       | Sí          | Decide si aparece en la portada                             |
| `status`                  | Enum           | Sí          | `draft`, `published` o `archived`                           |
| `published_at`            | Fecha o `null` | Automático  | Se registra en la primera publicación                       |
| `created_at`              | Fecha          | Automático  | Solo lectura                                                |
| `updated_at`              | Fecha          | Automático  | Solo lectura                                                |
| `deleted_at`              | Fecha o `null` | Automático  | Borrado lógico                                              |

### Reglas de presentación

- Un miembro sin redes debe mostrar únicamente la información editorial disponible, sin botones
  vacíos ni iconos deshabilitados.
- El nombre nunca puede sustituirse por el alias como único identificador accesible.
- La portada mostrará como máximo seis perfiles `published` y `is_featured`, ordenados por
  `display_order`.
- Un miembro archivado deja de mostrarse, pero conserva sus datos y referencias históricas.
- No se publicará una fotografía sin autorización de uso confirmada.

### Formulario de miembro

1. **Identidad:** nombre, alias, rol y descripción.
2. **Imagen:** subida, recorte recomendado `4:5`, vista previa y texto alternativo.
3. **Redes y web:** campos opcionales independientes, incluido `Web`.
4. **Publicación:** destacado, orden, estado y vista previa.

El botón principal será `Guardar borrador` o `Publicar cambios` según el permiso y estado. Archivar
debe requerir confirmación y explicar que el perfil desaparecerá de la web pública.

## Modelo: Candeonato

### Campos editoriales

| Campo                        | Tipo            | Obligatorio | Reglas                                                    |
| ---------------------------- | --------------- | ----------- | --------------------------------------------------------- |
| `id`                         | UUID            | Sí          | Identificador interno                                     |
| `external_tournament_id`     | Entero o `null` | Condicional | ID de Fat Cat Race; único cuando existe                   |
| `slug`                       | Texto           | Sí          | Único y estable aunque cambie el título                   |
| `name`                       | Texto           | Sí          | Nombre público de la edición                              |
| `edition_number`             | Entero o `null` | No          | Número editorial del Candeonato                           |
| `subtitle`                   | Texto o `null`  | No          | Máximo 100 caracteres                                     |
| `season`                     | Texto o `null`  | No          | Ejemplo: `2026` o `2026-S2`                               |
| `summary`                    | Texto o `null`  | No          | Máximo 320 caracteres                                     |
| `description`                | Texto o `null`  | No          | Contenido sanitizado; Markdown limitado opcional          |
| `cover_url`                  | URL o `null`    | Condicional | Obligatoria para aparecer destacado                       |
| `cover_alt`                  | Texto o `null`  | Condicional | Obligatorio con portada                                   |
| `background_video_url`       | URL o `null`    | No          | MP4/WebM propio de la edición; máximo 80 MB al subirlo    |
| `background_video_mime_type` | Texto o `null`  | Condicional | `video/mp4` o `video/webm` cuando existe vídeo            |
| `start_at`                   | Fecha o `null`  | No          | Debe ser anterior a `end_at`                              |
| `end_at`                     | Fecha o `null`  | No          | Debe ser posterior a `start_at`                           |
| `registration_url`           | URL o `null`    | No          | Google Forms HTTPS; genera el formulario nativo de la web |
| `rules_url`                  | URL o `null`    | No          | HTTPS o ruta interna                                      |
| `status`                     | Enum            | Sí          | `draft`, `registration`, `active`, `finished`, `archived` |
| `is_featured`                | Booleano        | Sí          | Solo una edición puede estar destacada                    |
| `display_order`              | Entero          | Sí          | Orden dentro del historial                                |
| `published_at`               | Fecha o `null`  | Automático  | Fecha de publicación                                      |
| `created_at`                 | Fecha           | Automático  | Solo lectura                                              |
| `updated_at`                 | Fecha           | Automático  | Solo lectura                                              |
| `deleted_at`                 | Fecha o `null`  | Automático  | Borrado lógico                                            |

### Fechas, zona horaria y temporizador

El panel interpreta los controles `datetime-local` como hora española de calendario en la zona
IANA `Europe/Madrid`. Antes de persistirlos, el backend los convierte a un instante UTC ISO 8601.
La web calcula la cuenta atrás contra ese instante UTC y presenta de nuevo la fecha en
`Europe/Madrid`.

Esta regla es única para panel, API y frontend y contempla automáticamente CET (`UTC+1`) y CEST
(`UTC+2`). No se debe añadir o restar una hora manualmente ni interpretar el valor del panel como
UTC. Al editar un Candeonato, la conversión se invierte para que el campo muestre exactamente la
hora española que introdujo administración. La interfaz indicará junto al control: `Hora de España
peninsular (Europe/Madrid)`.

### Datos procedentes de Fat Cat Race

Estos valores no deben editarse como campos editoriales normales:

- Rondas y su orden.
- Circuitos, variantes, fechas y vueltas recibidas.
- Clasificación, posiciones, puntos e incidentes.
- Estadísticas acumuladas.
- Equipos, sanciones y transferencias cuando estén disponibles.

El panel puede mostrar esos datos en modo lectura, indicar la última sincronización y permitir
`Sincronizar ahora`. Si se necesita corregir una incidencia, debe crearse una **corrección
editorial explícita**, con motivo, autor y fecha; nunca alterar silenciosamente el payload externo.

### Estados y acciones

Al crear una edición ya publicada, o al publicar un borrador, esa edición pasa automáticamente a
ser la actual en `/candeonato`. La acción `Destacar` permite volver a seleccionar manualmente otra
edición publicada. El vídeo no se hereda entre Candeonatos: sin vídeo se muestra la portada.

| Estado         | Visible públicamente | Acciones principales                           |
| -------------- | -------------------- | ---------------------------------------------- |
| `draft`        | No                   | Editar, previsualizar y publicar               |
| `registration` | Sí                   | Abrir inscripción, editar y activar            |
| `active`       | Sí                   | Destacar, sincronizar y finalizar              |
| `finished`     | Sí                   | Sincronizar final, generar snapshot y archivar |
| `archived`     | Sí, en historial     | Consultar y restaurar con permiso              |

No debe permitirse destacar un borrador. Al destacar una edición, el sistema quitará

### Formulario de Candeonato

1. **Identidad:** número, nombre, subtítulo, temporada y slug.
2. **Fuente deportiva:** `external_tournament_id`, prueba de conexión y resumen encontrado.
3. **Contenido:** resumen, descripción, portada y texto alternativo.
4. **Calendario y enlaces:** inicio, fin, inscripción y reglamento.
5. **Publicación:** estado, edición destacada, orden y vista previa.
6. **Sincronización:** última ejecución, último dato válido, errores y botón manual.

Antes de guardar un ID externo, el panel debe consultar el endpoint y mostrar el nombre del torneo
encontrado. Así se evita vincular una edición al campeonato equivocado.

## Ajustes globales del sitio

El MVP necesita un único registro de ajustes tipados, no una colección ilimitada de pares
`clave/valor`.

| Campo                      | Uso                                               |
| -------------------------- | ------------------------------------------------- |
| `twitch_channel_login`     | Canal oficial y fallback del indicador de directo |
| `twitch_channel_url`       | Enlace oficial utilizado en botones y footer      |
| `twitch_channels`          | Hasta seis canales, con prioridad y marca oficial |
| `discord_url`              | Invitación oficial de la comunidad                |
| `featured_championship_id` | Edición presentada en la portada y `/candeonato`  |
| `contact_email`            | Correo público de contacto                        |
| `instagram_url`            | Red oficial opcional                              |
| `youtube_url`              | Canal oficial opcional                            |
| `updated_at`               | Última modificación                               |

El vídeo de fondo puede incorporarse más adelante al almacenamiento. En la primera versión conviene
mantenerlo como asset de despliegue por su tamaño y coste de transferencia.

## Persistencia propuesta

### Tablas mínimas

```text
admin_profiles
team_members
sponsors
championships
championship_snapshots
sports_corrections
site_settings
media_assets
audit_log
admin_access_requests
admin_invitations
```

### Relaciones

- `championships.id` → `championship_snapshots.championship_id` es uno a muchos.
- `site_settings.featured_championship_id` → `championships.id` es cero o uno.
- `media_assets.id` puede relacionarse con la foto de un miembro o la portada de un Candeonato.
- `audit_log.actor_id` identifica la cuenta administradora que realizó cada cambio.
- `admin_invitations.request_id` enlaza la aprobación con su solicitud y conserva solo el hash del
  token privado.
- `sports_corrections.championship_id` conserva aclaraciones separadas del resultado importado.

### Snapshots deportivos

Cada sincronización válida puede guardar:

| Campo             | Función                                  |
| ----------------- | ---------------------------------------- |
| `championship_id` | Edición interna relacionada              |
| `payload`         | Respuesta JSON original de la API        |
| `checksum`        | Evitar duplicados idénticos              |
| `source_at`       | Fecha declarada por la fuente, si existe |
| `synced_at`       | Fecha real de consulta                   |
| `is_final`        | Snapshot fijado al finalizar la edición  |

Para una edición activa se conserva al menos el último resultado válido. Para una edición finalizada
se marca un snapshot final que no se reemplaza automáticamente.

## Contrato de API

Los nombres son orientativos, pero la separación entre público y administración es obligatoria.

### Lectura pública

```http
GET /api/public/site-settings
GET /api/public/twitch-content
GET /api/public/members?featured=true
GET /api/public/sponsors
GET /api/public/championships
GET /api/public/championships/:slug
GET /api/public/google-form?url=...
POST /api/public/google-form-submit
GET /api/public/championships/:slug/sports-data
```

Las respuestas públicas solo incluyen registros publicados y campos necesarios para renderizar la
web. Nunca devuelven correos administrativos, payloads de sesión ni datos de auditoría.

### Administración

```http
GET    /api/admin/members
POST   /api/admin/members
GET    /api/admin/members/:id
PATCH  /api/admin/members/:id
DELETE /api/admin/members/:id
POST   /api/admin/members/:id/publish
POST   /api/admin/members/:id/archive
PATCH  /api/admin/members/order

GET    /api/admin/sponsors
POST   /api/admin/sponsors
GET    /api/admin/sponsors/:id
PATCH  /api/admin/sponsors/:id
DELETE /api/admin/sponsors/:id
POST   /api/admin/sponsors/:id/publish
POST   /api/admin/sponsors/:id/archive

GET    /api/admin/championships
POST   /api/admin/championships
GET    /api/admin/championships/:id
PATCH  /api/admin/championships/:id
POST   /api/admin/championships/:id/publish
POST   /api/admin/championships/:id/archive
POST   /api/admin/championships/:id/feature
POST   /api/admin/championships/:id/sync
POST   /api/admin/championships/validate-source
GET    /api/admin/championships/:id/corrections
POST   /api/admin/championships/:id/corrections

GET    /api/admin/settings
PATCH  /api/admin/settings
POST   /api/admin/media
GET    /api/admin/audit
POST   /api/admin/mfa/setup
POST   /api/admin/mfa/confirm
```

### Respuesta de error común

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Hay campos que necesitan revisión.",
    "fields": {
      "photo_alt": "Describe la fotografía antes de publicar."
    }
  }
}
```

La interfaz no debe depender únicamente del texto del error; utilizará `code` y `fields` para
asociarlo a controles concretos.

## Autenticación y seguridad

- No permitir registro público directo: el formulario público solo crea una solicitud pendiente.
- Permitir crear una cuenta propietaria cuando la base está vacía; en producción, proteger el alta
  inicial con `ADMIN_SETUP_TOKEN`.
- Reservar aprobación, desactivación y revocación de sesiones al propietario.
- Guardar únicamente el hash del token de invitación y hacerlo caducar en 24 horas.
- Exigir segundo factor TOTP a todas las cuentas antes de administrar contenido.
- Explicar en la propia pantalla que TOTP es un código de seis cifras que cambia cada 30 segundos y
  se genera en una aplicación autenticadora; la clave inicial y los códigos de recuperación nunca
  deben enviarse por chat ni guardarse en Git.
- Usar cookies de sesión `HttpOnly`, `Secure` y `SameSite` cuando la arquitectura lo permita.
- Comprobar la cuenta y la sesión en cada operación del servidor; el guard de ruta solo mejora la UX.
- Validar y normalizar todos los campos del lado servidor.
- Sanear contenido enriquecido y no aceptar HTML arbitrario.
- Limitar tamaño, tipo MIME y dimensiones de imágenes.
- Aplicar rate limit al login, subida de archivos y sincronización.
- Proteger las operaciones mutables contra CSRF si se autentican mediante cookies.
- No guardar secretos en Angular, Git, respuestas públicas ni registros de auditoría.
- Mantener `.env` ignorado y publicar únicamente `.env.example` sin valores reales.
- Registrar publicación, archivo, sincronizaciones y correcciones editoriales.
- Usar borrado lógico para miembros y Candeonatos; el borrado físico será una tarea separada.

## Gestión de imágenes

### Miembros

- Formatos aceptados: JPEG, PNG, WebP y AVIF.
- Tamaño máximo de subida para imágenes: 12 MB.
- El panel envía imágenes y vídeos como cuerpo binario, sin codificarlos en Base64. Así el tamaño
  que atraviesa el proxy se mantiene próximo al archivo original y un vídeo válido de 80 MB no
  supera el límite de 100 MB de Cloudflare por el sobrecoste de la codificación.
- Generar derivados WebP o AVIF para la web.
- Derivado principal: mínimo `720 × 900`, relación `4:5`.
- Conservar el original fuera de la entrega pública si se necesita recortar de nuevo.

### Candeonatos

- Portadas admitidas: horizontal desde `1200 × 675`, vertical desde `900 × 1200` o cuadrada desde
  `900 × 900`; el sistema conserva la proporción y todo el contenido del cartel, sin recortarlo.
- La implementación genera un derivado WebP de hasta `1600 × 1600` y otro de hasta `900 × 900`
  para móvil. Ambos usan ajuste interior (`contain`) y nunca amplían el archivo original.
- No reemplazar una URL publicada hasta que el nuevo archivo haya terminado de procesarse.

### Sponsors

- Logotipo mínimo: `300 × 100 px`; máximo de subida: 12 MB.
- El derivado WebP cabe dentro de `1200 × 600` mediante `contain`, sin recortar ni ampliar el original.
- Publicar exige logo y texto alternativo. El enlace de la marca, cuando existe, debe ser HTTPS.

Cada asset debe guardar nombre original, tipo, dimensiones, peso, autor de la subida, fecha y texto
alternativo asociado. Eliminar un registro no debe borrar inmediatamente una imagen todavía usada.

## Experiencia de uso del panel

### Listados

- Búsqueda por nombre.
- Filtro por estado.
- Orden claro y persistente.
- Acciones principales visibles sin depender del hover.
- Selección masiva solo después de validar una necesidad real.
- Enlace a la página pública cuando el contenido está publicado.

### Formularios

- Guardado explícito; no simular éxito antes de recibir respuesta del servidor.
- Aviso al intentar salir con cambios sin guardar.
- Errores junto al campo y resumen al inicio del formulario.
- Vista previa que no publique ni genere una URL indexable.
- Fecha y autor de la última modificación.
- Protección contra sobrescritura mediante `updated_at` o número de versión.

### Dashboard

Debe responder rápidamente a estas preguntas:

- ¿Qué Candeonato está destacado?
- ¿Cuándo se sincronizó por última vez?
- ¿Falló alguna sincronización?
- ¿Cuántos miembros están publicados y destacados?
- ¿Hay borradores pendientes?

## Accesibilidad

- Un `h1` por pantalla y jerarquía de encabezados coherente.
- Etiquetas visibles para todos los controles.
- Descripciones y errores conectados con `aria-describedby`.
- Foco trasladado al resumen cuando falla el envío.
- Confirmaciones destructivas con título y acción inequívocos.
- Operación completa con teclado, incluido el orden de miembros; ofrecer botones `Subir` y `Bajar`
  además de arrastrar.
- Objetivos táctiles mínimos de `44 × 44px`.
- Contraste AA y estados que no dependan únicamente del color.
- Mensajes de guardado y sincronización mediante `aria-live="polite"`.
- Respeto de `prefers-reduced-motion`.

La revisión automática de la interfaz y del árbol accesible está cubierta por pruebas y Lighthouse.
La prueba auditiva manual con NVDA, VoiceOver o TalkBack continúa siendo una validación humana: debe
confirmar orden de lectura, nombres anunciados, cambios de estado, errores y recuperación del foco.

El panel puede reutilizar los tokens de Candemor, pero debe priorizar legibilidad y densidad de
trabajo frente al carácter promocional de la web pública.

## Integración con la web actual

### Miembros

Sustituir el array local por un `TeamMembersService` que consulte los miembros publicados. La portada
debe conservar estados de carga, vacío y error. Si el servicio falla, no se presentarán los cinco
perfiles ficticios como si fueran reales.

### Candeonato destacado

La portada y `/candeonato` leerán `featured_championship_id`. Los enlaces deportivos utilizarán el
`external_tournament_id` relacionado, evitando repetir `42` en plantillas y componentes.

### Historial

`/candeonatos` leerá la lista editorial de ediciones publicadas. Cada detalle combinará:

1. Metadatos editoriales de la base de datos.
2. Último snapshot deportivo válido.
3. Respuesta reciente de Fat Cat Race cuando esté disponible.

La interfaz debe indicar cuándo muestra datos en caché y la fecha de la última actualización.

## Estrategia de implementación

### Fase 1 — Base segura

- [x] Elegir proveedor y preparar el entorno de despliegue de producción.
- [x] Crear base de datos y migraciones versionadas.
- [x] Implementar autenticación con propietario, administradores y sesiones independientes.
- [x] Añadir solicitudes, aprobación, invitaciones de un solo uso y gestión de cuentas.
- [x] Crear políticas de lectura pública y escritura administrativa.
- [x] Añadir auditoría mínima.

### Fase 2 — Miembros

- [x] Crear tabla, validaciones y endpoints de miembros.
- [x] Implementar subida y procesado de fotografías.
- [x] Crear listado, formulario, orden, preview y publicación.
- [x] Sustituir los datos ficticios de la portada por el servicio público.
- [x] Probar perfiles con y sin redes.

### Fase 3 — Candeonatos

- [x] Crear tabla y endpoints de ediciones.
- [x] Validar el ID externo antes de guardarlo.
- [x] Implementar estados, edición destacada y publicación.
- [x] Crear sincronización y snapshots de Fat Cat Race.
- [x] Sustituir IDs y textos duplicados en la web pública.
- [x] Integrar el historial con la lista administrada.

### Fase 4 — Ajustes y operación

- [x] Añadir ajustes globales tipados.
- [x] Crear dashboard con avisos reales.
- [x] Añadir recuperación de errores y conflictos de edición.
- [x] Completar auditoría visible y comando de copia de seguridad.
- [x] Realizar revisión técnica de accesibilidad y seguridad del MVP.

## Criterios de aceptación del MVP

### Miembros

- [x] Un administrador puede crear un borrador con nombre y fotografía.
- [x] Puede publicar, ordenar, destacar y archivar miembros.
- [x] Puede guardar un miembro sin Twitch ni otras redes.
- [x] Puede añadir un enlace opcional `Web` y este aparece solo cuando existe.
- [x] La portada muestra únicamente miembros publicados y destacados.
- [x] Al actualizar un miembro, la web pública refleja el cambio sin nuevo despliegue.

### Candeonatos

- [x] Un administrador puede crear una edición y asociarla a un ID de torneo válido.
- [x] Solo una edición publicada puede estar destacada.
- [x] Puede cambiar textos, portada, fechas, enlaces y estado.
- [x] Puede sincronizar y consultar el último resultado válido.
- [x] Las posiciones y puntos externos no se modifican silenciosamente desde el panel.
- [x] La portada, página promocional e historial utilizan la edición administrada.
- [x] La hora introducida en el panel se interpreta en `Europe/Madrid` y coincide con el
      temporizador público, incluido el cambio de horario de verano.

### Seguridad y calidad

- [x] Una persona no autenticada no puede leer rutas ni datos privados del panel.
- [x] El formulario público solo crea solicitudes; ninguna cuenta nace sin aprobación del propietario.
- [x] Las invitaciones son de un solo uso, caducan y almacenan únicamente el hash del token.
- [x] Ningún secreto aparece en el bundle de Angular o en Git.
- [x] Toda acción sensible queda asociada a usuario y fecha.
- [x] Los formularios funcionan con teclado y comunican errores de forma accesible.
- [x] Existen pruebas de permisos, validaciones, publicación, sincronización y estados de error.
- [x] Un segundo alta inicial devuelve conflicto y las rutas de cuentas exigen rol propietario.
- [x] Cada cuenta configura un QR, secreto TOTP y códigos de recuperación diferentes.

## Uso local del panel implementado

### Requisitos

- Node.js `22.13` o posterior.
- Dependencias instaladas con `npm install`.

### Arranque

```bash
cp .env.example .env
npm start
```

`npm start` inicia simultáneamente la API en `http://127.0.0.1:3000` y Angular en
`http://localhost:4200`. El proxy de desarrollo conecta automáticamente `/api` y `/uploads` con la
API.

1. Abrir `http://localhost:4200/admin/login`.
2. Si la base está vacía, la propia pantalla permite crear la cuenta propietaria.
3. En producción se debe definir un `ADMIN_SETUP_TOKEN` robusto antes de crear esa cuenta.
4. Tras crearla, abrir `Seguridad`, vincular una aplicación TOTP y guardar los ocho códigos de
   recuperación de un solo uso.
5. Revisar solicitudes desde `Administradores`; al aceptar se genera un enlace válido durante 24
   horas que puede copiarse o abrirse en el cliente de correo.
6. La persona invitada elige su contraseña y configura su propio QR TOTP antes de acceder al panel.

Los datos se conservan en `server/data/`, que está ignorado por Git. Para generar una copia SQLite
consistente se utiliza:

```bash
npm run backup
```

La ruta de base de datos, subida, frontend compilado y copias se puede cambiar con las variables
documentadas en `.env.example`.

### Estado local comprobado — 11 de agosto de 2026

- La API y SQLite responden correctamente. La primera cuenta existente se migra automáticamente a
  propietaria; `/api/admin/session` devuelve `needsSetup: false` sin revelar su identidad a una
  sesión anónima.
- El segundo factor TOTP está confirmado, no existe ninguna clave pendiente, los códigos de
  recuperación están generados y la auditoría contiene la activación correspondiente. Ningún
  secreto se incluyó en esta comprobación.
- Las credenciales de Twitch están presentes únicamente en `.env`, que Git ignora. La consulta
  autenticada a Helix responde correctamente, conserva `candemorracingteam` como canal oficial y
  admite hasta cinco canales adicionales ordenados desde el panel. El perfil público y hasta cuatro
  clips se obtienen también desde Twitch y se conservan 15 minutos en caché.
- La invitación `https://discord.gg/j22XuDEfMk` está publicada en la presentación, el pie de página y
  los ajustes administrables.
- Existen cinco perfiles publicados marcados explícitamente como datos de demostración. Deben
  sustituirse desde `/admin/miembros`; el panel ya permite añadir, editar y eliminar cada perfil.
- Existen seis ediciones públicas del Candeonato (`46`, `42`, `38`, `36`, `35` y `34`). Aún no se ha
  ejecutado su primera sincronización administrativa, por lo que muestran `syncStatus: never` y
  recurren a la fuente en directo cuando no existe snapshot. El torneo `42` figura como `finished`,
  de acuerdo con su ubicación actual en `Finalizados` dentro de Fat Cat Race.
- Las posiciones, puntos, empates y sanciones se muestran conforme al sistema publicado por Fat Cat
  Race. Candeweb no recalcula ni corrige silenciosamente esa clasificación.
- El correo de contacto y las redes opcionales continúan vacíos.
- `npm run backup` se ejecutó correctamente y generó una copia local ignorada por Git. La copia
  externa y automatizada sigue siendo una tarea de producción.

El siguiente paso editorial es reemplazar los perfiles de demostración desde el CRUD y sincronizar
las seis ediciones desde el panel cuando se quiera conservar su primer snapshot.

### Activación de producción pendiente

La publicación, el dominio y las copias externas se aplazan por decisión del propietario hasta que
la web se suba a un servidor. La preparación ya incluida en el repositorio se conserva para ese
momento:

- Conectar el repositorio a una cuenta de Render y aplicar `render.yaml`.
- Asociar el dominio definitivo; Render proporciona HTTPS y el servidor emite entonces la cookie
  con `Secure`.
- Recuperar desde el panel de Render el `ADMIN_SETUP_TOKEN` generado para crear la primera cuenta.
- Programar y verificar copias de seguridad fuera del servidor principal.
- [x] Vincular el segundo factor de la primera cuenta antes de administrar contenido.
- Repetir en el dominio definitivo la prueba accesible manual ya validada localmente por la persona
  propietaria.
- Planificar la migración del tooling a Angular 22 para retirar los avisos que afectan únicamente a
  dependencias de desarrollo; la auditoría de dependencias de producción está limpia.

## Datos necesarios antes de publicar

- Acceso a la cuenta de Render, al repositorio Git remoto y al dominio de producción.
- Lista real de miembros, fotografías autorizadas y redes oficiales.
- IDs externos de todas las ediciones del Candeonato.
- Textos, portadas, fechas y enlaces de cada edición.
- Regla editorial para decidir cuándo una edición pasa de `registration` a `active` y `finished`.

Estas decisiones no impiden utilizar y probar el panel local, pero sí son necesarias antes de
publicarlo con datos reales.
