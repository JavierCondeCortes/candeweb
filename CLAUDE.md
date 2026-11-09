# Candeweb

Web pública y panel de administración de Candemor Racing Team (equipo de iRacing/simracing y
campeonato Candeonato). Detalles en `README.md` y `docs/`; este archivo recoge solo lo que no
se deduce del código.

## Comandos

- `npm start`: web (4200) y API (3000) juntas. `npm run api` / `npm run start:web` por separado.
- `npm run verify`: comprobación completa (i18n, servidor, unitarios, build, SEO, audit).
- Atajos: `npm run test:server`, `npm test -- --watch=false`, `npm run test:i18n`,
  `npm run test:seo` (requiere `npm run build` previo).
- Node >= 22.13 (`.nvmrc`).

## Arquitectura

- SPA Angular 21 (standalone, rutas con `loadComponent`), sin SSR.
- Servidor Node propio (`server/app.mjs`) con SQLite: API en `/api/*`, ficheros subidos en
  `/uploads/`, y sirve `dist/candeweb/browser`.
- Tests junto al código: `*.spec.ts` (Vitest) y `server/*.spec.mjs` (node:test).
- Documentación por área en `docs/` (accesos, admin, setups, skins, docker, CI/CD y SEO).

## Reglas que evitan romper cosas

- **i18n:** todo texto visible va en `src/app/core/i18n/translations/{es,en}/*.json`, con ambos
  idiomas sincronizados (`test:i18n` lo comprueba).
- **SEO:** no borrar los marcadores `<!--seo:start-->` / `<!--seo:end-->` de `src/index.html`.
  Una ruta pública nueva debe añadirse a `server/seo.mjs`, a `public/llms.txt` y llevar
  `data: { description: '<clave i18n>' }` en `app.routes.ts`. Rutas privadas: añadir su prefijo a
  `PRIVATE_PREFIXES` (servidor) y `PRIVATE_PATH` (`core/seo/seo.service.ts`).
- No bloquear `/api/` ni `/uploads/` en robots.txt: Googlebot los necesita para renderizar.
- `PUBLIC_APP_URL` debe ser la URL real en producción; de ella salen sitemap y canonical.
- `angular.json` tiene presupuestos de bundle y de estilos por componente.
- `*.mp4` va por Git LFS (`.gitattributes`).
- CI/CD en `.github/workflows/` (ver `docs/ci-cd-seo.md`); Render despliega solo si pasan los checks.

## Seguridad

- No leer ni imprimir `.env*`; contienen secretos. Usar `.env.example` como referencia.
- Setups y skins son bibliotecas privadas con permisos independientes: no exponerlas en rutas
  públicas ni en el sitemap.
- `server/data/` (base de datos, uploads, setups, copias) no se versiona.

## Flujo de trabajo

- Rama de desarrollo: `develop` (integración de PR). Rama de producción y por defecto: `Main`. Ramas de trabajo
  `feature/*` y `fix/*`.
- Commits y textos de la web en español.
- Prettier falla hoy en archivos existentes: no reformatear archivos enteros fuera del alcance del
  cambio.
