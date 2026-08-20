# Biblioteca privada de setups

> Especificación y estado de la ruta implementada `https://candemor.com/setups`.

## Objetivo

Crear una biblioteca privada desde la que la comunidad autorizada pueda descargar setups de
simracing y donde las personas con permisos puedan mantener los archivos sin conceder acceso al
panel editorial de Candemor.

El enlace `Setups` aparecerá en el footer compartido de la web y llevará a `/setups`. El enlace será
visible para todo el mundo, pero el catálogo, sus metadatos y las descargas exigirán autenticación y
permiso explícito.

## Principios de diseño

1. **Una sola identidad por persona.** Una cuenta existente de owner o admin sirve también para
   Setups; no se crea una segunda contraseña ni otra sesión.
2. **Acceso y administración son permisos distintos.** Descargar un setup no permite entrar en
   `/admin` ni modificar el contenido público de la web.
3. **Privado por defecto.** Los archivos no se guardan dentro de `/uploads` ni tienen una URL pública.
4. **Permiso mínimo necesario.** Un usuario autorizado para descargar no puede subir; el permiso de
   contribución se concede por separado.
5. **Caducidad visible y auditable.** La fecha de eliminación se conoce antes de descargar y todo
   cambio queda registrado.
6. **No sobrescribir archivos.** Una actualización crea una versión nueva para conservar autoría,
   fecha y trazabilidad.

## Roles y permisos

La implementación amplía `admin_profiles` con `account_type`, `can_access_setups` y
`can_upload_setups`. Así conserva las cuentas y sesiones existentes sin una migración destructiva y
mantiene separados el acceso a `/admin` y el acceso a `/setups`. Una tabla general `accounts` sigue
siendo una posible evolución si aparecen más zonas privadas.

| Capacidad                                        | Owner | Admin | Usuario autorizado | Colaborador autorizado |
| ------------------------------------------------ | :---: | :---: | :----------------: | :--------------------: |
| Ver catálogo y detalles                          |  Sí   |  Sí   |         Sí         |           Sí           |
| Descargar archivos activos                       |  Sí   |  Sí   |         Sí         |           Sí           |
| Crear un borrador y subir una versión            |  Sí   |  Sí   |         No         |           Sí           |
| Editar borradores propios                        |  Sí   |  Sí   |         No         |           Sí           |
| Editar o eliminar cualquier setup                |  Sí   |  Sí   |         No         |           No           |
| Publicar, archivar o restaurar                   |  Sí   |  Sí   |         No         |           No           |
| Definir o ampliar la caducidad                   |  Sí   |  Sí   |         No         |           No           |
| Aprobar y revocar el acceso a Setups             |  Sí   |  Sí   |         No         |           No           |
| Conceder o retirar el permiso de colaboración    |  Sí   |  Sí   |         No         |           No           |
| Gestionar administradores o transferir propiedad |  Sí   |  No   |         No         |           No           |

### Decisión recomendada para colaboradores

Dar permiso para subir no debería permitir eliminar o modificar archivos de otras personas. Un
colaborador podrá crear setups, añadir versiones y editar sus propios borradores. Un owner o admin
revisará y publicará el contenido, elegirá la caducidad y podrá intervenir en cualquier registro.

Esta separación evita que un permiso puntual de subida se convierta accidentalmente en acceso
administrativo completo.

## Acceso e invitaciones

### Flujo de un nuevo usuario

1. La persona entra en `/setups` desde el footer.
2. Si no tiene sesión, puede iniciar sesión o solicitar acceso.
3. Envía nombre visible y correo desde `/setups/solicitar-acceso`.
4. Owner o admin acepta o rechaza la solicitud desde `/setups/usuarios`.
5. Al aprobarla se genera una invitación privada, de un solo uso y con caducidad de 24 horas.
6. La persona define su propia contraseña y activa su cuenta.
7. Entra al catálogo con permiso de descarga.
8. Owner o admin puede conceder posteriormente `can_upload_setups`.

La aprobación de Setups nunca debe cambiar el rol de la cuenta a `admin`. Del mismo modo, revocar
Setups no elimina la cuenta si esa persona conserva otros permisos.

### Segundo factor

- Owner y admin mantienen TOTP obligatorio, como en el panel actual.
- Se recomienda exigir TOTP también a colaboradores, porque pueden introducir archivos en el
  servidor.
- Para usuarios de solo lectura y descarga puede ser opcional en el MVP, aunque debe poder activarse.
- Cada cuenta conserva su propio secreto TOTP y sus propios códigos de recuperación.

### Sesiones

- Reutilizar la cookie de sesión opaca, `HttpOnly`, `Secure` y `SameSite` existente.
- Comprobar permisos en la API; los guards de Angular solo mejoran la experiencia.
- Permitir a owner y admin revocar el acceso a Setups sin tener que conocer la contraseña del usuario.
- Al revocar una cuenta, invalidar sus sesiones o forzar una nueva comprobación de permisos.

## Rutas propuestas

| Ruta                                                                                               | Acceso                    | Función                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------- |
| `/setups`                                                                                          | Cuenta autorizada         | Catálogo, búsqueda, filtros y próximas bajas |
| `/setups/acceso`                                                                                   | Público                   | Inicio de sesión                             |
| `/setups/solicitar-acceso`                                                                         | Público                   | Solicitud de acceso                          |
| `/setups/aceptar-invitacion`                                                                       | Invitación válida         | Alta y elección de contraseña                |
| `/setups/:id`                                                                                      | Cuenta autorizada         | Detalle, versiones y descarga                |
| `/setups/nuevo`                                                                                    | Colaborador, admin, owner | Crear borrador y subir archivo               |
| `/setups/:id/editar`                                                                               | Según propiedad y permiso | Editar metadatos o añadir versión            |
| `/setups/usuarios`                                                                                 | Admin y owner             | Solicitudes, accesos y colaboradores         |
| Si en el futuro se generaliza el acceso, `/setups/acceso` puede convertirse en `/acceso` y servir  |
| también al panel administrativo sin duplicar componentes. El MVP elimina el binario al vencer, por |
| lo que todavía no incluye una ruta de papelera.                                                    |

## Modelo de contenido

Un **setup** es el registro lógico que describe para qué simulador, coche y circuito sirve. Un
**archivo de setup** es una versión descargable de ese registro. Separarlos permite actualizar un
setup sin perder el historial ni sobrescribir el archivo anterior.

### Setup

| Campo           | Tipo            | Reglas                                              |
| --------------- | --------------- | --------------------------------------------------- |
| `id`            | UUID            | Generado por el sistema                             |
| `title`         | Texto           | Entre 3 y 120 caracteres                            |
| `simulator`     | Texto o enum    | Obligatorio; catálogo administrable                 |
| `car`           | Texto           | Obligatorio                                         |
| `track`         | Texto           | Obligatorio                                         |
| `configuration` | Texto o `null`  | Trazado o variante, si procede                      |
| `session_type`  | Enum            | `race`, `qualifying`, `wet`, `endurance` u `other`  |
| `description`   | Texto o `null`  | Texto plano; máximo recomendado de 1.000 caracteres |
| `tags`          | Lista           | Normalizadas y limitadas                            |
| `status`        | Enum            | `draft`, `published`, `archived` o `expired`        |
| `created_by`    | Cuenta          | Autor inicial                                       |
| `published_by`  | Cuenta o `null` | Owner o admin responsable                           |
| `created_at`    | Fecha           | Automático                                          |
| `updated_at`    | Fecha           | Control de edición concurrente                      |
| `deleted_at`    | Fecha o `null`  | Borrado lógico del registro                         |

### Archivo y versión

| Campo             | Tipo            | Reglas                                                      |
| ----------------- | --------------- | ----------------------------------------------------------- |
| `id`              | UUID            | Generado por el sistema                                     |
| `setup_id`        | UUID            | Relación con el setup                                       |
| `version_number`  | Entero          | Incremental dentro del setup                                |
| `original_name`   | Texto           | Solo para presentación; nunca se usa como ruta física       |
| `storage_key`     | Texto           | Nombre interno aleatorio y no público                       |
| `extension`       | Texto           | Debe estar en la lista permitida                            |
| `mime_type`       | Texto           | Declarado en la subida; la descarga fuerza tipo binario     |
| `byte_size`       | Entero          | Validado antes de guardar                                   |
| `checksum_sha256` | Texto           | Integridad, duplicados y auditoría                          |
| `notes`           | Texto o `null`  | Cambios de la versión                                       |
| `uploaded_by`     | Cuenta          | Autor de la subida                                          |
| `uploaded_at`     | Fecha           | Punto de partida de la retención                            |
| `retention_days`  | Entero o `null` | Solo owner/admin; `null` significa sin caducidad automática |
| `expires_at`      | Fecha o `null`  | `uploaded_at + retention_days`                              |
| `download_count`  | Entero          | Métrica operativa, no pública                               |
| `deleted_at`      | Fecha o `null`  | Momento de retirada física o lógica                         |

## Formatos y validación

El MVP admite `.sto`, `.svm`, `.set`, `.setup`, `.ini`, `.json`, `.xml` y `.zip`, con un límite de
25 MB por archivo. El nombre mostrado se sanea, la ruta física usa UUID y el servidor calcula
SHA-256. En ZIP se comprueba también la cabecera. Como endurecimiento futuro conviene relacionar
formatos con simuladores y analizar el contenido, no confiar únicamente en la extensión.

Reglas aplicadas y mejoras recomendadas:

- Lista permitida por simulador, por ejemplo `.sto` cuando corresponda.
- ZIP solo si es necesario agrupar varios archivos; inspeccionar su contenido y limitar la expansión
  para evitar archivos comprimidos maliciosos.
- Rechazar ejecutables, scripts, dobles extensiones y rutas internas como `../`.
- Comprobar extensión, firma cuando exista, MIME, tamaño y checksum en el servidor.
- Nombre original saneado y nombre físico generado mediante UUID.
- Límite inicial de 25 MB por archivo; los setups suelen ser pequeños y no necesitan el límite
  multimedia de 80 MB.
- Analizar los archivos con antivirus antes de publicarlos cuando el despliegue lo permita.

## Almacenamiento privado

En el despliegue Docker actual, los archivos deben vivir dentro del volumen persistente, por ejemplo:

```text
/app/data/setups/{setup_id}/{file_id}
```

No deben copiarse a `server/data/uploads` ni servirse desde `/uploads`. La descarga pasará siempre
por una ruta autenticada que:

1. comprueba sesión, estado de cuenta y permiso `can_access_setups`;
2. verifica que el archivo está publicado, activo y no caducado;
3. registra la descarga sin exponer información sensible;
4. responde con `Content-Disposition: attachment`;
5. usa `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.

Si el volumen crece o se ejecutan varias instancias, los binarios deben migrar a almacenamiento de
objetos privado. La base de datos conservará únicamente metadatos y una clave de almacenamiento; las
descargas usarán URLs firmadas de duración corta.

## Retención y eliminación automática

### Configuración

- Owner y admin eligen la retención al publicar cada versión: por ejemplo 7, 30, 90, 180 o 365 días,
  además de `Sin caducidad`.
- La fecha se calcula desde `uploaded_at`, tal como requiere la idea original.
- Solo owner y admin pueden cambiar `retention_days` o `expires_at`.
- Una versión nueva tiene su propia fecha; subirla no amplía automáticamente las versiones antiguas.
- La interfaz muestra fecha absoluta y tiempo restante.

### Proceso de limpieza

1. Una tarea programada revisa los vencimientos al arrancar el servidor y cada hora.
2. Al alcanzar `expires_at`, el archivo deja de poder descargarse.
3. La tarea elimina el binario, conserva el registro de auditoría y marca su borrado lógico.
4. Si un setup se queda sin versiones activas, pasa a `expired`.

La gestión muestra el número de archivos que caducarán durante los siguientes siete días. Owner o
admin pueden ampliar o retirar la retención antes del vencimiento. El MVP no ofrece papelera ni
recuperación después de eliminar el binario; una gracia configurable es una mejora posterior.

### Control de capacidad

- Mostrar espacio utilizado, disponible y archivos próximos a caducar.
- Avisar al 70 % y bloquear nuevas subidas al 90 % de la capacidad configurada.
- Permitir límites globales y por colaborador mediante variables de entorno.
- No contar una copia de seguridad como espacio disponible para servir archivos.
- Incluir los setups activos en las copias de seguridad y probar su restauración.

## API propuesta

```text
GET    /api/setups
POST   /api/setups
GET    /api/setups/:id
PATCH  /api/setups/:id
POST   /api/setups/:id/publish
POST   /api/setups/:id/archive
POST   /api/setups/:id/files
GET    /api/setups/:id/files/:fileId/download
PATCH  /api/setups/:id/files/:fileId/retention
DELETE /api/setups/:id/files/:fileId

POST   /api/setup-access/requests
GET    /api/setup-access/users
POST   /api/setup-access/requests/:id/approve
POST   /api/setup-access/requests/:id/reject
PATCH  /api/setup-access/users/:id
POST   /api/setup-access/invitations/accept
```

Las operaciones mutables requieren CSRF. Las subidas deben ser binarias o `multipart/form-data`, no
Base64, para evitar aumentar el tamaño y repetir el problema de límites del proxy.

## Persistencia implementada

```text
admin_profiles
admin_sessions
setup_access_requests
setup_invitations
setups
setup_files
setup_downloads
audit_log
```

Los permisos viven temporalmente en `admin_profiles`:

| Campo               | Función                                     |
| ------------------- | ------------------------------------------- |
| `account_type`      | Distingue administrador y usuario de Setups |
| `can_access_setups` | Ver y descargar                             |
| `can_upload_setups` | Crear borradores y subir versiones          |

Owner y admin obtienen sus capacidades por rol; no es necesario crear filas redundantes para ellos.

## Experiencia de usuario

### Catálogo

- Encabezado breve que explique que es una biblioteca privada de la comunidad.
- Búsqueda por coche, circuito, simulador y autor.
- Filtros visibles y botón para limpiar filtros.
- Tarjetas o filas compactas con título, coche, circuito, tipo de sesión, versión y caducidad.
- Estado vacío útil cuando no existan setups o no haya coincidencias.
- Aviso destacado para archivos próximos a caducar sin depender solo del color.

### Detalle

- Jerarquía: simulador → coche → circuito → tipo de sesión.
- Descripción, autor, fecha de actualización y lista de versiones.
- Botón `Descargar setup` con nombre y peso del archivo antes de iniciar la descarga.
- Fecha de eliminación expresada de forma absoluta: `Se elimina el 20 de septiembre de 2026`.
- Checksum disponible para quien necesite verificar la descarga.

### Gestión

- Subida con progreso real, cancelación y mensajes de error asociados al campo.
- Resumen de permisos antes de publicar.
- Confirmación explícita al archivar o eliminar.
- Cambio de retención con una vista previa de la fecha resultante.
- Tabla de solicitudes con nombre, correo, fecha y acciones claras.
- Diferenciar visualmente `Acceso`, `Puede subir` y `Admin`; nunca resumirlos en un único estado.

### Accesibilidad

- Navegación completa mediante teclado y foco visible.
- Etiquetas y ayuda asociadas a filtros, selector de archivo y retención.
- Progreso y resultado de la subida anunciados mediante `aria-live`.
- No usar solo color para estados de caducidad o permisos.
- Las tablas deben transformarse en bloques legibles en móvil sin perder encabezados.
- Respetar `prefers-reduced-motion` y el sistema visual definido en [Diseño](../design.md).

## Seguridad y privacidad

- No revelar el catálogo, nombres de archivos ni autores a personas sin permiso.
- Tokens de invitación aleatorios, almacenados mediante hash, de un solo uso y con caducidad.
- Rate limit en login, solicitudes e invitaciones. Subidas y descargas pueden incorporar un límite
  específico cuando el uso real permita dimensionarlo.
- Validar autorización en cada descarga; conocer una URL o UUID no concede acceso.
- Evitar rutas predecibles y ataques de recorrido de directorios.
- Escapar metadatos y no renderizar HTML proporcionado por usuarios.
- Registrar alta, publicación, nueva versión, descarga, cambio de retención, revocación y borrado.
- La auditoría no debe guardar contraseñas, TOTP, tokens, contenido completo ni rutas internas.
- Añadir términos de uso que aclaren autoría y permiso de distribución de cada setup.

## Estados y errores

| Código | Situación                                                      |
| ------ | -------------------------------------------------------------- |
| `401`  | No existe una sesión válida                                    |
| `403`  | La cuenta no tiene acceso, subida o administración             |
| `404`  | El setup no existe o no debe revelarse a esa cuenta            |
| `409`  | Edición concurrente, versión duplicada o permiso ya resuelto   |
| `410`  | El archivo existía, pero ha caducado y ya no está disponible   |
| `413`  | Supera el límite de archivo configurado                        |
| `415`  | Formato no permitido                                           |
| `422`  | Metadatos, retención o archivo no válidos                      |
| `507`  | El almacenamiento alcanzó el umbral que bloquea nuevas subidas |

## Estado de implementación

### Fase 1 — Acceso y catálogo

- [x] Ampliar cuentas y sesiones sin romper las cuentas owner/admin actuales.
- [x] Añadir solicitud, invitación y aprobación de acceso a Setups.
- [x] Añadir enlace `Setups` al footer compartido.
- [x] Crear catálogo protegido, detalle y descarga autenticada.
- [x] Implementar almacenamiento privado y auditoría.

### Fase 2 — Gestión de archivos

- [x] CRUD para owner y admin.
- [x] Permiso de colaborador y flujo de borrador/revisión.
- [x] Versiones, checksum, validación y estado accesible de subida.
- [x] Retención por archivo, aviso de próximos vencimientos y limpieza programada.
- [x] Indicadores de espacio usado y archivos próximos a caducar.
- [ ] Papelera con periodo de gracia y límites de capacidad configurables.

### Fase 3 — Operación

- [ ] Antivirus y reglas por simulador.
- [ ] Copia de seguridad y restauración probadas.
- [ ] Migración opcional a almacenamiento de objetos privado.
- [ ] Métricas agregadas de uso sin publicar actividad individual.

## Criterios de aceptación del MVP

- [x] El footer enlaza a `/setups` desde todas las páginas que usan el componente compartido.
- [x] Una persona anónima no puede listar ni descargar archivos.
- [x] Owner y admin pueden aprobar o revocar acceso.
- [x] Un usuario aprobado puede descargar, pero no subir ni entrar a `/admin`.
- [x] Un colaborador puede subir y editar sus propios borradores sin administrar a otros usuarios.
- [x] Owner y admin pueden crear, editar, publicar, archivar y eliminar cualquier setup.
- [x] Solo owner y admin pueden definir la caducidad.
- [x] Un archivo caducado deja de descargarse y se elimina mediante la tarea programada.
- [x] Los archivos se guardan fuera de las rutas públicas.
- [x] Todas las operaciones sensibles quedan auditadas.
- [x] Los permisos se comprueban con pruebas de servidor y guards de interfaz.

## Decisiones del MVP y mejoras pendientes

1. Se usa una lista común de extensiones; falta definir reglas particulares por simulador.
2. No hay retención predeterminada: owner/admin eligen entre caducidad y `Sin caducidad`.
3. El tamaño máximo es 25 MB por archivo.
4. Todo setup de colaborador queda en borrador hasta que owner/admin lo publique.
5. La eliminación al vencer es inmediata; una papelera de 24 horas queda como mejora.
6. Falta definir el texto jurídico de autoría y permiso de distribución.
