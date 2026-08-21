# API de eventos para WebUpdates

Esta API permite que el bot de Discord WebUpdates detecte nuevas publicaciones sin utilizar una
cuenta humana, una cookie de administración, CSRF ni TOTP. El feed solo contiene metadatos de
anuncio; nunca entrega archivos de setup, sesiones, contraseñas ni rutas internas.

## Configuración

Genera un secreto independiente de al menos 32 bytes:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Guarda el mismo valor como `WEB_UPDATES_API_TOKEN` en CandeWeb y en el entorno privado del bot. No
lo incluyas en Git, URLs, registros ni mensajes de Discord. Si se sospecha que se ha expuesto,
reemplázalo en ambos servicios.

Sin esta variable, el endpoint responde `503 WEB_UPDATES_NOT_CONFIGURED`.

## Endpoint

```text
GET /api/web-updates/events?after={cursor}&limit={1..100}
Authorization: Bearer {WEB_UPDATES_API_TOKEN}
```

- `after` es la última secuencia confirmada por el bot. En el primer arranque se usa `0`.
- `limit` es opcional, vale `50` por defecto y nunca supera `100`.
- La respuesta siempre está ordenada de menor a mayor secuencia.
- `Cache-Control: no-store` evita almacenar respuestas autenticadas.

Ejemplo:

```bash
curl --fail --silent \
  --header "Authorization: Bearer $WEB_UPDATES_API_TOKEN" \
  "https://candemor.com/api/web-updates/events?after=0&limit=50"
```

```json
{
  "events": [
    {
      "sequence": 17,
      "id": "bc1dbf14d67e4908934671eedde693bb",
      "type": "setup.published",
      "entityId": "b824d7a8-88ec-43f0-8cbb-63a630630580",
      "occurredAt": "2026-08-21T17:40:00.000Z",
      "data": {
        "id": "b824d7a8-88ec-43f0-8cbb-63a630630580",
        "title": "Spa — carrera",
        "simulator": "iRacing",
        "car": "Porsche 911 GT3 Cup",
        "track": "Spa-Francorchamps",
        "configuration": null,
        "season": 3,
        "week": 8,
        "year": 2026,
        "url": "/setups/b824d7a8-88ec-43f0-8cbb-63a630630580",
        "publishedAt": "2026-08-21T17:40:00.000Z"
      }
    }
  ],
  "nextCursor": 17,
  "hasMore": false
}
```

Las URLs pueden ser relativas. El bot debe resolverlas contra su variable `CANDEWEB_BASE_URL`, por
ejemplo `https://candemor.com`.

## Eventos

### `setup.published`

Se crea al pasar un setup a `published`. Incluye título, simulador, coche, circuito, configuración,
temporada, semana, año, URL y fecha de publicación. Republicar el mismo setup no genera otro evento.
La página y la descarga mantienen los permisos privados normales.

### `skin.published`

Se crea al guardar una skin directamente como publicada o al pasarla de borrador/archivada a
`published`. Incluye coche, imagen y texto alternativo, destino externo, catálogo y fecha. Solo se
anuncia la primera publicación de cada skin.

### `championship.published`

Se crea cuando un Candeonato entra por primera vez en `registration`, `active` o `finished`. Incluye
slug, nombre, edición, subtítulo, temporada, resumen, portada, fecha de inicio, estado y URL pública.
Los Candeonatos históricos insertados por el sistema no generan avisos.

## Consumo seguro

1. Leer el cursor confirmado de almacenamiento persistente.
2. Solicitar el feed con `after=cursor`.
3. Procesar los eventos en orden.
4. Usar `id` como clave idempotente para no publicar dos veces el mismo evento.
5. Guardar el cursor de cada evento únicamente después de que Discord confirme el mensaje.
6. Si `hasMore` es `true`, pedir la página siguiente inmediatamente; en caso contrario, esperar
   unos 30 segundos.

Los eventos se almacenan en SQLite en `web_update_events` y se crean mediante triggers dentro de la
misma transacción que publica el contenido. Así no se pierde el aviso si el bot o Discord están
temporalmente desconectados.

## Errores

| Estado | Código                       | Significado                              |
| ------ | ---------------------------- | ---------------------------------------- |
| `401`  | `INVALID_WEB_UPDATES_TOKEN`  | Bearer token ausente o incorrecto        |
| `405`  | `METHOD_NOT_ALLOWED`         | Solo se admite `GET`                     |
| `422`  | `INVALID_PAGINATION`         | Cursor o límite no válido                |
| `503`  | `WEB_UPDATES_NOT_CONFIGURED` | CandeWeb no tiene configurado el secreto |
