# CI/CD y SEO

## CI/CD (GitHub Actions)

| Workflow | Cuándo | Qué hace |
| --- | --- | --- |
| `verify.yml` | PR y push a `develop` y `Main` | En paralelo: i18n, tests de servidor, tests unitarios, build + `test:seo`, `npm audit` y smoke test de la imagen Docker (health, sitemap, robots, 404). |
| `codeql.yml` | PR, push y lunes | Análisis estático de seguridad (JavaScript/TypeScript). |
| `lighthouse.yml` | PR | Lighthouse CI sobre `/`, `/candeonato` y `/candeonatos`; la categoría SEO debe ser ≥ 0.95. |
| `docker-publish.yml` | Push a `Main` y tags `vX.Y.Z` | Reutiliza `verify.yml` y publica `ghcr.io/<repo>` (`latest`, semver, sha). |
| `dependabot.yml` | Semanal | PRs de npm (agrupados Angular/tooling), GitHub Actions y Docker. |

Render sigue desplegando con `autoDeployTrigger: checksPass`, así que no se publica nada si
`verify.yml` falla. `.nvmrc` fija Node 22.13.0 para CI y desarrollo local.

Recomendado (en GitHub, no versionable): proteger `Main` y `develop` exigiendo los checks de `verify.yml`.

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
