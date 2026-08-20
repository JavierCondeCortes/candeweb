# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:24-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="Candeweb" \
      org.opencontainers.image.description="Web y panel de administración de Candemor Racing Team"

ENV NODE_ENV=production \
    PORT=3000 \
    API_HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/candemor.db \
    UPLOAD_DIR=/app/data/uploads \
    BACKUP_DIR=/app/data/backups \
    SETUP_DIR=/app/data/setups \
    BROWSER_DIR=/app/dist/candeweb/browser \
    NPM_CONFIG_CACHE=/tmp/npm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node server ./server
COPY --chown=node:node --from=build /app/dist ./dist

RUN mkdir -p /app/data/uploads /app/data/originals /app/data/backups /app/data/setups \
    && chown -R node:node /app/data

USER node

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "server/server.mjs"]
