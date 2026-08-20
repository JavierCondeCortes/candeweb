# Biblioteca privada de skins

> Especificación funcional implementada para la ruta `https://candemor.com/skins`.

## Objetivo

Crear un catálogo privado de skins mantenido por owner y admins. Solo las cuentas con el permiso
`can_access_skins` podrán ver las fichas y abrir la URL asociada.

Skins reutiliza la identidad, sesión, TOTP e invitaciones existentes. La concesión del permiso se
realiza desde la [gestión centralizada de accesos](../accesos/accesos.md), no desde una pantalla de
usuarios propia.

La navegación autenticada se comparte con Setups. Si una cuenta tiene acceso a las dos bibliotecas,
verá los enlaces `Setups` y `Skins` en ambas rutas, con el destino actual marcado mediante
`aria-current`; una cuenta solo verá las bibliotecas para las que tenga permiso.

## Roles y capacidades

| Capacidad                               | Owner | Admin | Usuario con acceso | Usuario sin acceso |
| --------------------------------------- | :---: | :---: | :----------------: | :----------------: |
| Ver el catálogo y las fichas            |  Sí   |  Sí   |         Sí         |         No         |
| Abrir la URL de una skin                |  Sí   |  Sí   |         Sí         |         No         |
| Crear, editar, ordenar o archivar skins |  Sí   |  Sí   |         No         |         No         |
| Eliminar una skin                       |  Sí   |  Sí   |         No         |         No         |
| Conceder acceso a Skins                 |  Sí   |  Sí   |         No         |         No         |

No se añade por ahora un permiso `Puede subir Skins`. Si más adelante se permiten colaboradores,
deberá diseñarse como una capacidad separada y con revisión previa a la publicación.

## Datos de una skin

| Campo           | Tipo           | Obligatorio | Reglas                                                    |
| --------------- | -------------- | ----------- | --------------------------------------------------------- |
| `id`            | UUID           | Sí          | Generado por el sistema                                   |
| `car_name`      | Texto          | Sí          | Nombre visible del coche; entre 2 y 120 caracteres        |
| `image_url`     | URL            | Sí          | Imagen procesada mediante el sistema multimedia existente |
| `image_alt`     | Texto          | Sí          | Describe el coche y la skin; máximo 160 caracteres        |
| `target_url`    | URL HTTPS      | Sí          | Destino que se abre desde la ficha                        |
| `display_order` | Entero         | Sí          | Cero o positivo                                           |
| `status`        | Enum           | Sí          | `draft`, `published` o `archived`                         |
| `created_at`    | Fecha          | Automático  | Solo lectura                                              |
| `updated_at`    | Fecha          | Automático  | Solo lectura                                              |
| `deleted_at`    | Fecha o `null` | Automático  | Borrado lógico                                            |

La URL puede apuntar a la descarga o página externa elegida por administración. Debe validarse como
HTTPS y abrirse con las protecciones `noopener` y `noreferrer`. La aplicación no debe afirmar que
el archivo está alojado por Candemor cuando el destino sea externo.

## Rutas propuestas

| Ruta                 | Acceso        | Función                         |
| -------------------- | ------------- | ------------------------------- |
| `/skins`             | Con permiso   | Catálogo privado                |
| `/admin/skins`       | Owner y admin | Listado y gestión               |
| `/admin/skins/nueva` | Owner y admin | Alta con foto, coche y URL      |
| `/admin/skins/:id`   | Owner y admin | Edición, publicación y retirada |
| `/admin/accesos`     | Owner y admin | Concesión del permiso de acceso |

El footer puede mostrar `Skins` junto a `Setups`. El enlace puede ser visible públicamente, pero el
catálogo, sus imágenes privadas si las hubiera y las URLs no deben revelarse sin autorización.

## Experiencia de usuario

- Tarjetas con fotografía protagonista, nombre del coche y acción clara `Ver skin`.
- Imagen con proporción consistente y `object-fit: contain` para no recortar diseños completos.
- Estado vacío útil cuando no haya skins publicadas.
- Estado de carga anunciado a tecnologías de asistencia y mensajes diferenciados para sesión
  caducada, falta de permiso y fallo de red.
- Hover y foco visibles en tarjeta y botón; ninguna acción dependerá exclusivamente del hover.
- Rejilla adaptable a escritorio y una columna legible en móvil.

## API propuesta

```text
GET    /api/skins
GET    /api/admin/skins
POST   /api/admin/skins
GET    /api/admin/skins/:id
PATCH  /api/admin/skins/:id
POST   /api/admin/skins/:id/publish
POST   /api/admin/skins/:id/archive
DELETE /api/admin/skins/:id
```

Todas las lecturas comprueban `can_access_skins` o el rol owner/admin. Las operaciones mutables
requieren owner/admin, CSRF y auditoría.

## Criterios de aceptación

- [x] Owner y admins pueden añadir una foto, nombre de coche y URL.
- [x] Owner y admins pueden editar, ordenar, publicar, archivar y eliminar skins.
- [x] Solo las cuentas con `can_access_skins` pueden consultar el catálogo.
- [x] Un usuario autorizado puede abrir la URL, pero no modificar el contenido.
- [x] El permiso se administra desde `/admin/accesos`.
- [x] Las imágenes no se recortan de forma que oculten partes importantes de la skin.
- [x] Las URLs se validan y los enlaces externos se abren de forma segura.
- [x] Las operaciones administrativas quedan registradas en auditoría.
