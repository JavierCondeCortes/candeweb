# Docker y Docker Hub

La imagen contiene el frontend Angular compilado y la API Node. Un único proceso sirve la web, el
panel de administración, la API y los archivos subidos. SQLite, las imágenes originales, sus
versiones procesadas, los setups privados y las copias de seguridad se guardan en el volumen
`candeweb-data`.

La base de datos y los secretos no se incluyen en la imagen. De este modo, actualizar o publicar la
imagen no expone datos privados ni elimina el contenido administrado.

## Primer arranque

Requiere Docker Desktop o Docker Engine con Docker Compose v2.

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
docker compose ps
```

Antes de arrancar, cambia `ADMIN_SETUP_TOKEN` en `.env.docker`. La aplicación queda disponible en
`http://localhost:3000` y el panel en `http://localhost:3000/admin/login`. En un servidor público se
debe colocar un proxy HTTPS delante del contenedor, porque las cookies administrativas de producción
son seguras.

Para consultar el estado y los registros:

```bash
docker compose logs -f candeweb
docker compose exec candeweb node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.text()).then(console.log)"
```

## Conservar los datos actuales

Detén primero la aplicación local para copiar SQLite en un estado consistente. Después crea el
volumen e importa el contenido actual de `server/data`:

```bash
docker volume create candeweb-data
docker run --rm -v candeweb-data:/target -v "$PWD/server/data:/source:ro" alpine sh -c "cp -a /source/. /target/"
docker compose --env-file .env.docker up -d
```

En PowerShell, sustituye `$PWD` por `${PWD}` si Docker no resuelve correctamente la ruta. No montes
solo `candemor.db`: SQLite también puede utilizar los ficheros `-wal` y `-shm`, y las imágenes están
en los directorios contiguos.

## Publicar en Docker Hub

Inicia sesión, asigna en `.env.docker` un nombre como `usuario/candeweb:latest` y publica:

```bash
docker login
docker compose --env-file .env.docker build
docker compose --env-file .env.docker push
```

Para publicar una imagen multi-arquitectura compatible con servidores Intel/AMD y ARM:

```bash
docker buildx create --use --name candeweb-builder
docker buildx build --platform linux/amd64,linux/arm64 -t usuario/candeweb:latest --push .
```

No copies `.env.docker` dentro de la imagen ni lo subas al repositorio. En Docker Hub solo debe
publicarse la imagen; el código fuente se distribuye desde el repositorio Git.

## Descargar y actualizar desde Docker Hub

Con `compose.yaml` y `.env.docker` en el servidor:

```bash
docker compose --env-file .env.docker pull
docker compose --env-file .env.docker up -d --no-build
```

El contenedor se reemplaza, pero `candeweb-data` permanece intacto. Para eliminar la aplicación sin
borrar los datos usa `docker compose down`. `docker compose down -v` elimina también el volumen y,
por tanto, no debe utilizarse salvo que se quiera borrar definitivamente la base y los archivos.

## Copias de seguridad

```bash
docker compose exec candeweb node server/backup.mjs
docker run --rm -v candeweb-data:/source:ro -v "$PWD/backups:/target" alpine sh -c "cp -a /source/. /target/"
```

Guarda esas copias fuera del servidor y fuera del volumen de Docker.

La primera orden crea una copia consistente de SQLite. La segunda exporta el volumen completo e
incluye los binarios privados de `/app/data/setups`; ambos elementos son necesarios para restaurar
la biblioteca. Si hay un proxy inverso delante del contenedor, su límite de cuerpo debe superar los
25 MB admitidos por cada setup (por ejemplo, `client_max_body_size 90M` en Nginx también cubre los
vídeos administrativos).
