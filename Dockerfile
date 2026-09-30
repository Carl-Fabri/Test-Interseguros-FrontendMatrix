# ---- Build de la SPA ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Runtime: nginx sirviendo archivos estáticos ----
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh
COPY --from=build /app/dist/MatrixWeb/browser /usr/share/nginx/html

# Valores por defecto; se sobrescriben con variables de entorno (ver .env.example).
ENV API_GO_URL=http://localhost:8080 \
    API_NODE_URL=http://localhost:3000 \
    HEALTH_POLL_MS=15000

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
