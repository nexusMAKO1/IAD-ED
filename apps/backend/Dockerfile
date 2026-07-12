# =============================================================================
# Backend NestJS — Dockerfile
# Multi-stage: development | build | production
# Node.js 20 LTS — Alpine
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base image with dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install OS deps needed for Prisma and native modules
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    curl

WORKDIR /app

# Docker Desktop injects HTTPS_PROXY=http.docker.internal:3128 which only handles
# docker.io registry traffic. npm needs direct HTTPS to registry.npmjs.org.
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy=""

# Copy dependency manifests
COPY package*.json ./

# ---------------------------------------------------------------------------
# Stage 2: Development (hot reload + Prisma client generation)
# ---------------------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development
# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

RUN npm ci --legacy-peer-deps

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Copy and chmod the entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Health check — uses the versioned API endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]

# ---------------------------------------------------------------------------
# Stage 3: Build for production
# ---------------------------------------------------------------------------
FROM base AS builder

ENV NODE_ENV=production
# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

RUN npm ci --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 4: Production image (minimal footprint)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat curl

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
