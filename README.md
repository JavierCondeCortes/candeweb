# Candeweb

Web pública y panel de administración de Candemor Racing Team. El frontend utiliza Angular y la API
local utiliza Node.js con SQLite.

## Requisitos

- Node.js 22.13 o posterior.
- npm 11 o posterior.

## Desarrollo

```bash
npm install
cp .env.example .env
npm start
```

La web queda disponible en `http://localhost:4200` y el panel en
`http://localhost:4200/admin/login`. El primer acceso permite crear la cuenta propietaria si la
base de datos está vacía. Esta cuenta puede revisar solicitudes desde `/admin/administradores`.
Los datos locales se guardan en `server/data/` y no se publican en Git.

El footer enlaza a `/setups`, una biblioteca privada. Las personas pueden solicitar acceso; owner o
admin aprueban la invitación y deciden por separado si la cuenta solo descarga o también puede
crear borradores y subir versiones. Los binarios se guardan fuera de las rutas públicas en
`server/data/setups` y owner/admin pueden asignarles una caducidad automática. La evolución
implementada añade `/skins` y centraliza en `/admin/accesos` los permisos independientes de ambos
productos.

Comandos separados:

```bash
npm run api
npm run start:web
```

`npm start` comprueba los puertos antes de arrancar. Si ya existe una instancia de Candeweb en
`3000` o `4200`, la reutiliza sin iniciar un proceso duplicado. Si el puerto pertenece a otra
aplicación, se detiene con un mensaje claro para que puedas liberarlo.

## Variables de entorno

Usa `.env.example` como plantilla. `.env` y sus variantes locales están ignoradas por Git. En
producción son obligatorios `NODE_ENV=production`, HTTPS y un `ADMIN_SETUP_TOKEN` secreto para crear
la cuenta propietaria inicial. Después, las personas pueden solicitar acceso, pero solo el
propietario puede aprobarlas y generar una invitación privada de un solo uso. Cada cuenta elige su
contraseña y configura un TOTP y códigos de recuperación independientes.

El estado básico de Twitch funciona sin credenciales mediante los eventos oficiales del
reproductor. Para mostrar también título, categoría, espectadores, perfil y hasta cuatro clips
públicos desde Helix, configura `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` únicamente en el
servidor. El directo se conserva en caché durante 90 segundos y el perfil y los clips durante 15
minutos. El panel permite configurar hasta seis canales: si varios están en directo, se muestra
primero el oficial y después se respeta el orden editorial.

La invitación oficial de la comunidad es `https://discord.gg/j22XuDEfMk`. Puede modificarse o
retirarse desde `/admin/ajustes` sin cambiar el frontend.

El bot WebUpdates consume un feed duradero de publicaciones mediante
`GET /api/web-updates/events`. Configura `WEB_UPDATES_API_TOKEN` exclusivamente en el servidor y en
el bot; el contrato, los tipos de evento y la estrategia de cursor están documentados en
[`docs/web-updates-api.md`](docs/web-updates-api.md).

El Candeonato utiliza el sistema de clasificación de Fat Cat Race: esta web presenta los resultados
publicados por esa plataforma y no recalcula puntos, desempates ni sanciones. El historial incluye
seis Candeonatos encontrados en su archivo público. Las
posiciones de cada sesión se solicitan solo al abrirlas, se normalizan en el servidor y se conservan
en caché durante 24 horas. La clasificación independiente aporta nombres y equipos. El servidor
relaciona un nombre con `piloto_id` solo cuando puntos, rondas, vueltas, victorias, podios, top cinco
e incidentes forman una correspondencia única entre ambas fuentes; los casos ambiguos permanecen
sin relacionar. La fuente no facilita los puntos desglosados por carrera.

Cada Candeonato dispone de textos, portada y vídeo de fondo independientes en el panel. La edición
New Era reutiliza el torneo `42` de Fat Cat Race y `/media/hero-optimized.mp4`; al crear o publicar
otra edición, esta se convierte en la edición actual de `/candeonato`. Si no tiene vídeo, la página
usa únicamente su portada.

## Verificación

```bash
npm run test:server
npm test
npm run build
npm audit --omit=dev
```

También puede ejecutarse todo en orden con `npm run verify`. El mismo comando se utiliza en GitHub
Actions antes de que Render despliegue cambios asociados a comprobaciones correctas.

El repositorio incluye Chrome DevTools MCP para Codex en `.codex/config.toml` y para clientes
compatibles de VS Code en `.vscode/mcp.json`. El iniciador del proyecto detecta Chrome o Edge en
Windows y Linux; también admite las variables `CHROME_PATH` y `EDGE_PATH`. Tras confiar en el
proyecto y reiniciar Codex o el editor puede utilizarse para medir Core Web Vitals, revisar la red y
comprobar el árbol de accesibilidad sobre la aplicación renderizada.

## Copias de seguridad

```bash
npm run backup
```

Por defecto la copia de SQLite se guarda en `server/data/backups/`. En un despliegue real debe
copiarse además el directorio `server/data/` completo a una ubicación externa; así se incluyen los
setups privados y el resto de archivos administrados.

La administración editorial se documenta en [`docs/admin/admin.md`](docs/admin/admin.md), los
permisos en [`docs/accesos/accesos.md`](docs/accesos/accesos.md) y las bibliotecas privadas en
[`docs/setups/setups.md`](docs/setups/setups.md) y [`docs/skins/skins.md`](docs/skins/skins.md).

## Despliegue

### Docker y Docker Hub

El proyecto incluye una imagen multi-stage de producción, Docker Compose y almacenamiento
persistente para SQLite y los archivos administrados. Consulta la guía de construcción, migración de
los datos actuales, publicación y actualización en [`docs/docker.md`](docs/docker.md).

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

La aplicación completa queda disponible en `http://localhost:3000`. `.env.docker`, la base de datos
y las imágenes locales están excluidos de la imagen y del repositorio.

### Render

El repositorio incluye `render.yaml` para desplegar un único servicio Node en Render con región
Frankfurt, comprobación `/api/health` y un disco persistente montado sobre `server/data/`.

1. Publica el repositorio en GitHub o GitLab.
2. En Render, crea un Blueprint desde ese repositorio.
3. Revisa la instancia `starter` y el disco de 1 GB antes de confirmar el coste.
4. Introduce `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` cuando el Blueprint solicite los secretos;
   sus valores no se guardan en `render.yaml`.
5. Introduce `WEB_UPDATES_API_TOKEN` con el mismo valor configurado como `CANDEWEB_API_TOKEN` en
   WebUpdates. Es un secreto compartido y Render no debe generar un valor diferente.
6. Cuando el servicio esté activo, consulta el valor generado de `ADMIN_SETUP_TOKEN` y abre
   `/admin/login` para crear la primera cuenta.
7. Abre `/admin/seguridad`, vincula TOTP y guarda los códigos de recuperación.
8. Asocia el dominio y descarga periódicamente las copias generadas por `npm run backup`.

Los servicios gratuitos de Render no conservan SQLite ni las imágenes subidas. No elimines el disco
del Blueprint ni cambies a un plan sin persistencia.
