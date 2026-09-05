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

| Permiso             | Función                                              |
| ------------------- | ---------------------------------------------------- |
| `can_access_skins`  | Ver el catálogo privado de Skins y abrir sus enlaces |
| `can_access_setups` | Ver y descargar Setups                               |
| `can_upload_setups` | Crear borradores y subir versiones de Setups         |

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

### Contraseña y permanencia de la sesión

- La solicitud inicial solo pide nombre y correo. La contraseña se elige después de que owner o
  admin apruebe la cuenta, desde la invitación privada.
- Tanto al crear la contraseña desde la invitación como al iniciar sesión existe un botón para
  mostrarla u ocultarla. El control conserva el valor escrito, funciona con teclado e informa de su
  estado mediante `aria-pressed` y una etiqueta accesible.
- Sin marcar **Mantener la sesión iniciada**, la cookie se elimina al cerrar el navegador y la
  sesión del servidor caduca, como máximo, a las 12 horas.
- Al marcar **Mantener la sesión iniciada**, la cookie y la sesión del servidor permanecen activas
  durante 30 días.
- La cookie de autenticación continúa siendo `HttpOnly`, `SameSite=Strict` y, en producción,
  `Secure`. Cerrar sesión o revocar una cuenta invalida la sesión aunque se hubiera recordado.
- El mismo comportamiento se aplica al inicio de sesión del panel de administración.

## Envío opcional de invitaciones por SMTP

> Estado: primera versión implementada. El editor, la vista previa y la entrega automática están
> disponibles; el envío real permanece desactivado hasta configurar SMTP en el servidor. El correo
> es opcional y nunca sustituye la posibilidad de copiar manualmente el enlace.

### Objetivo y alcance

Cuando un owner o admin apruebe desde `/admin/accesos` la solicitud de una persona que todavía no
tiene cuenta, la API generará la invitación de un solo uso y tratará de enviarla al correo indicado
en la solicitud. El panel seguirá mostrando el enlace completo y el botón **Copiar enlace** tanto si
el envío funciona como si falla.

La primera implementación se aplicará a las cuentas de usuario de Setups y Skins. El servicio de
correo se diseñará como una pieza reutilizable para poder emplearlo más adelante en las invitaciones
de administradores, que continúan siendo competencia exclusiva del owner.

### Flujo recomendado

1. Owner o admin pulsa **Aprobar**.
2. La API valida la solicitud, genera un token aleatorio, guarda únicamente su hash y confirma en la
   base de datos la invitación con caducidad de 24 horas.
3. Después de confirmar la transacción, la API construye una URL absoluta usando
   `PUBLIC_APP_URL`; nunca debe confiar en la cabecera `Host` recibida.
4. Si SMTP está configurado, el servidor intenta enviar el mensaje con un tiempo máximo acotado.
5. La respuesta siempre devuelve la invitación al panel para mantener disponibles el campo de solo
   lectura y **Copiar enlace**.
6. El panel comunica por separado el resultado de ambas operaciones:
   - **Invitación creada y correo enviado**.
   - **Invitación creada; el correo no pudo enviarse. Copia el enlace manualmente**.
   - **Invitación creada; SMTP no está configurado. Copia el enlace manualmente**.
7. La persona abre el enlace, elige su contraseña y configura su TOTP y códigos de recuperación.

El fallo del proveedor de correo no debe deshacer la aprobación ni borrar la invitación válida. El
SMTP es un canal de entrega adicional, no una dependencia para poder conceder acceso.

### Contrato de API implementado

El endpoint existente puede mantener su ruta y ampliar la respuesta sin romper el frontend actual:

```http
POST /api/access/requests/:id/approve
```

```json
{
  "activated": false,
  "invitation": {
    "email": "piloto@example.com",
    "path": "/aceptar-invitacion?token=TOKEN_DE_UN_SOLO_USO",
    "expiresAt": "2026-09-04T18:00:00.000Z"
  },
  "emailDelivery": {
    "status": "sent",
    "sentAt": "2026-09-03T18:00:01.000Z"
  }
}
```

`emailDelivery.status` tendrá uno de estos valores:

| Estado       | Significado                                                           |
| ------------ | --------------------------------------------------------------------- |
| `sent`       | El servidor SMTP aceptó el mensaje                                    |
| `failed`     | La invitación existe, pero el proveedor rechazó o no recibió el envío |
| `disabled`   | No existe una configuración SMTP activa                               |
| `not_needed` | La cuenta ya existía y se activaron permisos sin crear invitación     |

Aceptar un mensaje en SMTP no garantiza que llegue a la bandeja de entrada. La interfaz debe hablar
de «correo enviado» y no de «correo recibido».

### Configuración mediante entorno

La configuración no se guardará en SQLite ni se expondrá en el panel. Se declararán nombres vacíos
en `.env.example`, mientras que los valores reales vivirán en `.env`, secretos de Docker o el gestor
de secretos del servidor:

```dotenv
PUBLIC_APP_URL=https://candemor.com
SMTP_ENABLED=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=Candemor Racing Team
SMTP_FROM_EMAIL=no-reply@candemor.com
SMTP_REPLY_TO=
SMTP_CONNECTION_TIMEOUT_MS=8000
```

- Puerto `465`: normalmente `SMTP_SECURE=true` para TLS directo.
- Puerto `587`: normalmente `SMTP_SECURE=false` y actualización mediante STARTTLS.
- La contraseña SMTP nunca se añade a Git, logs, respuestas HTTP ni entradas de auditoría.
- En producción se debe exigir TLS con certificados válidos; no se desactiva la comprobación del
  certificado para resolver errores de configuración.
- El servidor debe validar al arrancar que host, puerto, remitente y credenciales estén completos si
  `SMTP_ENABLED=true`. Una configuración incompleta desactiva el envío y deja disponible la copia
  manual.

Para Node se puede encapsular `nodemailer` detrás de un servicio propio, por ejemplo
`server/email.mjs`. El resto de la aplicación dependerá de una función de dominio como
`sendAccessInvitation(...)`, no directamente del proveedor, para facilitar pruebas y futuros
cambios de SMTP.

### Contenido del mensaje

El correo tendrá versión de texto plano y HTML mínimo, ambas con la misma información:

- Nombre de la persona y explicación de quién ha autorizado el acceso.
- Botón **Confirmar acceso** enlazado mediante HTTPS.
- URL completa visible para poder copiarla si el botón no funciona.
- Fecha y hora de caducidad expresada en zona `Europe/Madrid` e indicando que dura 24 horas.
- Aviso de enlace personal, de un solo uso y que no debe compartirse.
- Indicación para ignorar el mensaje si la persona no solicitó acceso.
- Correo de respuesta o contacto, cuando esté configurado.

Nunca incluirá contraseña, secreto TOTP, códigos de recuperación ni el token en el asunto. Se
evitarán píxeles de seguimiento y parámetros de analítica en el enlace de confirmación.

### Personalización mediante HTML y CSS

El correo no tiene que limitarse a una plantilla fija. Owner y admins pueden personalizarlo desde
`/admin/ajustes/correo`, manteniendo una plantilla predeterminada en el repositorio como respaldo.
El editor separará cuatro campos:

1. **Asunto** del mensaje.
2. **HTML** de la plantilla.
3. **CSS** específico del correo.
4. **Texto plano** alternativo.

La separación facilita trabajar con CSS legible, pero antes del envío el servidor debe convertirlo
en estilos `inline`. Clientes como Gmail y Outlook no interpretan el CSS igual que un navegador. Se
puede usar `juice` para el inlineado y `nodemailer` para el transporte SMTP.

#### Estructura implementada

```text
server/
└── email-templates/
    └── access-invitation/
        ├── template.html
        ├── styles.css
        └── template.txt
```

Los archivos serán la versión inicial y el fallback si no existe una personalización publicada en
la base de datos. Las modificaciones realizadas en el panel se guardarán en una tabla específica:

```text
email_templates
├── template_key          # access-invitation; clave primaria
├── subject_template
├── html_template
├── css
├── text_template
├── updated_by
├── updated_by_name
└── updated_at
```

Cada guardado crea una entrada de auditoría con el autor y la fecha. La acción **Restaurar diseño
predeterminado** elimina el override y vuelve a usar los archivos del proyecto.

#### Variables permitidas

El motor de plantillas usará una lista cerrada de variables. Todos los valores se escaparán por
defecto y no se permitirá ejecutar JavaScript ni expresiones arbitrarias:

| Variable              | Contenido                                       | Obligatoria |
| --------------------- | ----------------------------------------------- | ----------- |
| `{{brandName}}`       | `Candemor Racing Team`                          | No          |
| `{{displayName}}`     | Nombre de la persona invitada                   | Sí          |
| `{{confirmationUrl}}` | URL HTTPS de confirmación                       | Sí          |
| `{{expiresAt}}`       | Caducidad localizada en `Europe/Madrid`         | Sí          |
| `{{invitedByName}}`   | Nombre del owner o admin que autorizó el acceso | No          |
| `{{supportEmail}}`    | Correo público de soporte                       | No          |
| `{{websiteUrl}}`      | URL pública de Candemor                         | No          |

El servidor rechazará la publicación si HTML y texto plano no incluyen
`{{confirmationUrl}}`, o si falta `{{expiresAt}}`. Así se evita enviar un mensaje visualmente
correcto que no permita completar el acceso.

#### Ejemplo de plantilla HTML

```html
<!doctype html>
<html lang="es">
  <body>
    <table class="email-shell" role="presentation" width="100%">
      <tr>
        <td align="center">
          <table class="email-card" role="presentation" width="600">
            <tr>
              <td>
                <p class="eyebrow">ACCESO AUTORIZADO</p>
                <h1>Hola, {{displayName}}</h1>
                <p>Tu acceso a la zona privada de Candemor está preparado.</p>
                <p>
                  <a class="confirmation-button" href="{{confirmationUrl}}"> Confirmar acceso </a>
                </p>
                <p class="fallback-link">{{confirmationUrl}}</p>
                <p class="expires">El enlace caduca el {{expiresAt}}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

#### Ejemplo de CSS editable

```css
body {
  margin: 0;
  background: #050505;
  color: #f5f5f2;
  font-family: Arial, sans-serif;
}

.email-card {
  width: 100%;
  max-width: 600px;
  border: 1px solid #ff2bd6;
  background: #121216;
}

.confirmation-button {
  display: inline-block;
  padding: 14px 22px;
  background: #ff2bd6;
  color: #050505;
  font-weight: 700;
  text-decoration: none;
}

.eyebrow,
.expires {
  color: #deff00;
}
```

La plantilla predeterminada usa tablas de presentación para las zonas estructurales más importantes. No se
dependerá de Grid, vídeo, JavaScript, formularios, fuentes locales como Dog Rough ni imágenes de
fondo para transmitir información esencial. Esta primera versión bloquea imágenes remotas para
evitar píxeles de seguimiento.

#### Herramientas del editor

- **Vista previa** dentro de un `iframe sandbox` sin scripts.
- **Vista HTML** y **vista texto plano** antes de guardar.
- **Enviar prueba** al correo de la cuenta administrativa autenticada.
- **Guardar diseño** después de validar variables, HTML y CSS.
- **Restaurar diseño predeterminado** eliminando la personalización de SQLite.
- Indicación visible del origen del diseño, autor y última fecha de modificación.

Endpoints implementados:

```text
GET  /api/admin/email-templates/access-invitation
PATCH /api/admin/email-templates/access-invitation
DELETE /api/admin/email-templates/access-invitation
POST /api/admin/email-templates/access-invitation/preview
POST /api/admin/email-templates/access-invitation/test
```

Todas estas rutas requieren sesión de owner o admin y protección CSRF para las operaciones de
escritura. Guardar, restaurar y enviar una prueba dejan auditoría. La previsualización devuelve HTML
validado e inlineado y nunca utiliza un token de invitación real:
empleará datos ficticios y una URL de ejemplo no operativa.

#### Validación y seguridad de la plantilla

- Rechazar `<script>`, `<iframe>`, `<object>`, formularios, manejadores `on*` y URLs con esquemas no
  permitidos.
- Bloquear imágenes y hojas de estilo remotas para evitar seguimiento y contenido ajeno.
- Bloquear imports CSS, recursos remotos desconocidos y propiedades que puedan ocultar el enlace o
  superponer contenido engañoso.
- Limitar el tamaño del HTML y CSS para evitar mensajes excesivos o abuso del servicio.
- Escapar nombre, correo, actor y fechas antes de interpolarlos.
- Comprobar antes del inlineado que HTML y texto conservan el nombre, el enlace y la caducidad.
- Mantener una versión de texto plano obligatoria junto al HTML.
- Si la plantilla no se puede renderizar o SMTP falla, la invitación sigue creada y el panel mantiene
  el enlace manual.

El versionado con borradores y restauración de versiones anteriores queda como mejora futura. Antes
de activar SMTP en producción conviene comprobar el diseño con Gmail, Outlook y Apple Mail.

### Seguridad, reenvíos y auditoría

- El token seguirá teniendo al menos 32 bytes aleatorios y solo se almacenará su hash.
- El envío inicial se realizará después del `COMMIT`, mientras el token en claro existe únicamente
  en memoria y en la respuesta HTTPS destinada al administrador.
- Como el token original no puede recuperarse desde su hash, **Reenviar** no intentará reconstruirlo:
  revocará la invitación anterior, generará una nueva y volverá a mostrar su enlace para copiarlo.
- La regeneración mantendrá los límites de frecuencia para evitar spam y abuso del servidor SMTP.
- La auditoría registra `access.invitation_email_sent` y
  `access.invitation_email_failed`, incluyendo invitación, destinatario, actor y fecha, pero nunca
  el token ni las credenciales SMTP.
- Los errores visibles y auditados serán mensajes saneados. Los detalles internos del proveedor no
  deben revelar usuarios, contraseñas, IP privadas o contenido del mensaje.
- Se recomienda configurar SPF, DKIM y DMARC para el dominio remitente antes de activar el envío en
  producción.

Para una primera versión no se recomienda una cola persistente: obligaría a almacenar el enlace o el
token recuperable mientras espera el envío. El intento síncrono después de la transacción, con timeout
corto y copia manual garantizada, encaja mejor con la arquitectura actual. Si en el futuro se adopta
una cola, el payload sensible deberá cifrarse con una clave externa a la base de datos y eliminarse
al completar o caducar el trabajo.

### UX del panel

- **Copiar enlace** permanecerá visible en todos los estados de SMTP.
- Durante la aprobación se mostrará un único estado ocupado para impedir dobles pulsaciones.
- El éxito de la aprobación y el resultado del correo se anunciarán con `role="status"`; los fallos
  de entrega usarán `role="alert"` sin presentar la aprobación como fallida.
- Tras copiar, el botón cambiará temporalmente a **Enlace copiado** y lo anunciará a tecnologías de
  asistencia.
- Si el correo falla, la acción principal recomendada será **Copiar enlace** y la secundaria,
  **Regenerar y reenviar**.
- El panel mostrará el destinatario y la caducidad antes de permitir un reenvío.

### Pruebas necesarias

- Transporte SMTP simulado; los tests automáticos nunca enviarán correos reales.
- SMTP desactivado: la aprobación funciona y devuelve un enlace copiable.
- SMTP activo y correcto: se envía una vez al destinatario esperado y se informa `sent`.
- Timeout o rechazo SMTP: la invitación continúa válida, se informa `failed` y el enlace sigue
  disponible.
- Cuenta existente: se activan permisos, no se genera token y el estado es `not_needed`.
- Regeneración: invalida la invitación anterior y tanto el nuevo correo como la copia usan el token
  nuevo.
- Comprobación de que tokens y credenciales no aparecen en logs ni auditoría.

### Criterios de aceptación de esta primera versión

- [x] Owner y admins pueden aprobar solicitudes y activar el intento de envío automático.
- [x] El enlace se puede copiar aunque SMTP esté desactivado, lento o caído.
- [x] Un fallo SMTP no revierte la invitación ni presenta la aprobación como fallida.
- [x] Los avisos distinguen creación de invitación y entrega del correo.
- [x] Renovar una invitación genera un token nuevo y revoca el anterior.
- [x] Ningún secreto SMTP ni token de invitación queda almacenado en claro o registrado en auditoría.
- [x] HTML, CSS, asunto y texto plano se pueden editar y previsualizar desde administración.
- [ ] Añadir borradores y un historial de versiones recuperables si el flujo editorial lo necesita.
- [ ] Las plantillas de texto y HTML contienen enlace visible, caducidad e instrucciones de seguridad.
- [ ] Owner y admins pueden personalizar HTML y CSS, previsualizar el resultado y enviar una prueba.
- [ ] El CSS se convierte a estilos inline antes del envío y existe una versión de texto plano.
- [ ] Una plantilla inválida utiliza automáticamente el diseño predeterminado.
- [ ] SPF, DKIM y DMARC están comprobados antes de habilitar el envío en producción.

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
- [x] La creación de contraseña y los inicios de sesión permiten mostrar u ocultar la contraseña.
- [x] Los usuarios pueden elegir entre una sesión de navegador y una sesión recordada durante 30 días.
