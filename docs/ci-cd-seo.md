# CI/CD y SEO

## CI/CD (GitHub Actions)

Ramas: `develop` es la rama de integración de PR; `Main` es producción y la rama por defecto.

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `verify.yml` | PR, push a `develop`, y llamado desde `docker-publish.yml` | En paralelo: i18n, tests de servidor, tests unitarios, build + `test:seo`, `npm audit --audit-level=high` y smoke test de la imagen Docker (health, sitemap, robots, 404). |
| `docker-publish.yml` | Push a `Main` y tags `vX.Y.Z` | Ejecuta `verify.yml` y, si pasa, publica `ghcr.io/<repo>` con `latest`, semver y sha, con provenance y SBOM. |
| `codeql.yml` | PR, push a `develop`/`Main` y lunes | Análisis estático de seguridad (JavaScript/TypeScript). |
| `dependency-review.yml` | PR | Falla si el PR introduce dependencias con vulnerabilidades altas o licencias GPL/AGPL. |
| `lighthouse.yml` | PR | Lighthouse CI (3 pasadas) sobre `/`, `/candeonato` y `/candeonatos`; SEO ≥ 0.95. Los informes se guardan como artefacto del run, no en almacenamiento público. |
| `actionlint.yml` | Cambios en `.github/workflows/` | Valida la sintaxis de los workflows. |
| `production-monitor.yml` | Cada 30 minutos | Comprueba en producción `/api/health`, `/sitemap.xml`, `/robots.txt` y los metadatos SEO de la portada. Requiere la variable `PUBLIC_APP_URL` en Settings → Variables. |
| `dependabot.yml` | Semanal | PRs de npm (parches y menores agrupados), GitHub Actions y Docker. Las mayores de Angular, TypeScript, Vitest y jsdom están ignoradas hasta planificar la migración. |

Decisiones:
- **Sin `push` a `Main` en `verify.yml`:** `docker-publish.yml` ya lo ejecuta. Tenerlos los dos
  causaba ejecuciones que se cancelaban entre sí por el mismo grupo de concurrencia.
- **Acciones fijadas por SHA** (con la versión en comentario). Dependabot actualiza los SHA.
- **`persist-credentials: false`** en `checkout`: el token no queda en el repositorio clonado.
- **Render** sigue con `autoDeployTrigger: checksPass`: no despliega si `verify.yml` falla.

Pendiente en GitHub (no versionable):
- Proteger `Main` y `develop` exigiendo los checks de `verify.yml`, `codeql` y `dependency-review`.
- Definir la variable `PUBLIC_APP_URL` para que `production-monitor` funcione.
- Activar las notificaciones de Actions para recibir el aviso de fallo del monitor.

Desajuste conocido: CI usa Node 22.13 (`.nvmrc`), la imagen Docker usa `node:24`, y hay un PR
de Dependabot para `node:26`. Conviene alinearlos en una sola decisión.

## SEO (equipo de iRacing / simracing)

- `server/seo.mjs` inyecta en el HTML inicial `title`, `description`, `canonical`, Open Graph,
  Twitter Card y, en la portada, JSON-LD (`SportsTeam` + `WebSite`). Así lo leen buscadores y
  bots sociales sin ejecutar JavaScript. `src/index.html` conserva los marcadores
  `<!--seo:start-->`/`<!--seo:end-->`; no los elimines (`npm run test:seo` lo comprueba).
- `GET /sitemap.xml` se genera desde la base de datos (ediciones publicadas del Candeonato) y
  `GET /robots.txt` apunta a él. Ambos usan `PUBLIC_APP_URL`: **debe ser la URL pública real**
  (por ejemplo `https://candemor.com`) o las URLs canónicas serán incorrectas.
- Las zonas privadas (`/admin`, `/setups`, `/skins`, accesos) responden con `X-Robots-Tag:
  noindex` y `meta robots`; las rutas inexistentes devuelven 404 real (antes eran soft-404).
- `/api/` y `/uploads/` no se bloquean en robots.txt a propósito: Googlebot necesita la API y las
  portadas para renderizar la SPA.
- `SeoService` (cliente) mantiene description/canonical/robots al navegar y al cambiar idioma.
- Textos de título y descripción por ruta en `server/seo.mjs` (español, idioma por defecto) y en
  `translations/*/{home,candeonato}_*.json` (`meta.description`, `data.description` en las rutas).
- Imagen social 1200×630: `npm run seo:og-image` regenera `public/media/og-cover.jpg`.

### Pendiente fuera del código

- Dar de alta el dominio en Google Search Console y Bing Webmaster y enviar `/sitemap.xml`.
- Contenido: páginas con texto propio sobre iRacing (guías, setups públicos, resultados) rinden
  más que meta etiquetas; los setups son privados y no aportan SEO.
- Evaluar prerenderizado (Angular SSG) de `/`, `/candeonato` y `/candeonatos` si Search Console
  muestra problemas de renderizado; hoy el contenido se pinta en cliente.
