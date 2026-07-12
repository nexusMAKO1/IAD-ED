# =============================================================================
# Frontend React — Dockerfile
# Multi-stage: development | build | production (Nginx)
# Node.js 20 Alpine + Vite + TypeScript
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

RUN apk add --no-cache curl

WORKDIR /app

# Docker Desktop injects HTTPS_PROXY=http.docker.internal:3128 which only handles
# docker.io registry traffic. npm/corepack need direct HTTPS to registry.npmjs.org.
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy=""

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package*.json ./
COPY pnpm-lock.yaml* ./

# ---------------------------------------------------------------------------
# Stage 2: Development (Vite dev server avec HMR)
# ---------------------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development
# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

RUN pnpm install --fetch-timeout 120000 --fetch-retries 3

COPY . .

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5173 || exit 1

# HMR via réseau Docker nécessite --host
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
# Stage 3: Build (bundle optimisé)
# ---------------------------------------------------------------------------
FROM base AS builder

ENV NODE_ENV=production
# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

RUN pnpm install --network-timeout 120000 --fetch-retry-maxtimeout 60000 --fetch-retries 3

COPY . .

ARG VITE_API_URL
ARG VITE_MQTT_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MQTT_WS_URL=$VITE_MQTT_WS_URL

RUN pnpm run build

# ---------------------------------------------------------------------------
# Stage 4: Production — Nginx (serving static files)
# ---------------------------------------------------------------------------
FROM nginx:1.25-alpine AS production

# Non-root nginx configuration
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
