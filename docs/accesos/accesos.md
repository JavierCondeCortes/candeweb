# Gestión centralizada de accesos

> Especificación funcional implementada para sustituir la gestión exclusiva de usuarios de Setups
> por una única pantalla de permisos para las zonas privadas de Candemor.

## Objetivo

Una persona tendrá una sola cuenta, una sola contraseña, un único TOTP y los mismos códigos de
recuperación para toda la web. Sobre esa identidad, owner y admins podrán conceder o retirar
permisos independientes para **Setups** y **Skins**, sin convertir al usuario en administrador del
panel editorial.

La gestión se centralizará en `/admin/accesos`. La ruta actual `/setups/usuarios` deberá redirigir a
la nueva pantalla para no mantener dos fuentes de verdad.

## Permisos

| Permiso             | Función                                                   |
| ------------------- | --------------------------------------------------------- |
| `can_access_skins`  | Ver el catálogo privado de Skins y abrir sus enlaces      |
| `can_access_setups` | Ver y descargar Setups                                    |
| `can_upload_setups` | Crear borradores y subir versiones de Setups              |

`can_upload_setups` depende de `can_access_setups`: no puede activarse la subida si la cuenta no
puede entrar en la biblioteca. En la primera versión no existe permiso de subida de Skins para
usuarios; ese contenido solo lo mantienen owner y admins.

Owner y admins disponen de acceso completo por rol, sin necesitar activar estas marcas en su propia
cuenta.

## Presentación de cada cuenta

Cada fila o tarjeta mostrará nombre, correo y tipo de cuenta. Los controles se ordenarán de
izquierda a derecha así:

1. **Skins:** `Acceso a Skins`.
2. **Setups:** `Acceso a Setups` y `Puede subir Setups`.
3. **Cuenta:** `Revocar acceso` cuando corresponda.

De este modo, el permiso de Skins queda a la izquierda del grupo de Setups solicitado y los dos
productos siguen siendo visualmente independientes. Los estados no se comunicarán solo mediante
color: cada control mostrará texto, estado activado/desactivado, foco visible y respuesta en hover.
En móvil, cada cuenta se transformará en una tarjeta y mantendrá el mismo orden lógico.

## Reglas de administración

- Owner y admins pueden conceder o retirar permisos de Setups y Skins.
- Retirar `Acceso a Setups` desactiva también `Puede subir Setups`.
- Retirar un permiso de producto no elimina la cuenta ni afecta al resto de permisos.
- `Revocar acceso` desactiva la cuenta completa y sus sesiones; debe requerir confirmación.
- Cada cambio se valida en la API, invalida o reevalúa la sesión y genera una entrada de auditoría.
- Un admin no puede modificar el rol, TOTP ni contraseña de otra persona desde esta pantalla.
- La gestión de cuentas administrativas y la transferencia de propiedad continúan siendo
  exclusivas del owner.

## Flujo de acceso

1. La persona solicita acceso con su nombre y correo.
2. Owner o admin revisa la solicitud y genera una invitación privada de un solo uso.
3. La persona configura contraseña, TOTP y códigos de recuperación una única vez.
4. Desde `/admin/accesos` se activan los productos autorizados.
5. Al iniciar sesión, la API devuelve los permisos vigentes y cada ruta comprueba el suyo.

La aprobación de la identidad y la concesión de productos son acciones distintas: aceptar una
cuenta no debe habilitar automáticamente Setups ni Skins.

## API propuesta

```text
GET   /api/access/users
POST  /api/access/requests/:id/approve
POST  /api/access/requests/:id/reject
PATCH /api/access/users/:id
POST  /api/access/users/:id/revoke
POST  /api/access/users/:id/restore
POST  /api/access/invitations/accept
```

Durante la migración, los endpoints `/api/setup-access/*` pueden mantenerse como alias internos,
pero el frontend nuevo debe consumir la API central para evitar duplicar lógica.

## Criterios de aceptación

- [x] Existe una sola pantalla de accesos para Setups y Skins.
- [x] El permiso de Skins aparece a la izquierda del grupo de permisos de Setups.
- [x] Owner y admins pueden cambiar permisos sin conceder acceso a `/admin`.
- [x] Una cuenta puede acceder solo a Setups, solo a Skins o a ambos.
- [x] La subida de Setups requiere también acceso a Setups.
- [x] Retirar un producto no elimina los demás permisos de la cuenta.
- [x] Revocar la cuenta invalida sus sesiones.
- [x] Los estados funcionan con teclado y no dependen únicamente del color.
- [x] Todos los cambios de permisos quedan auditados.
