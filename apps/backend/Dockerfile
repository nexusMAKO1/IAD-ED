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

# Install pnpm (faster than npm for monorepos)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependency manifests
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# ---------------------------------------------------------------------------
# Stage 2: Development (hot reload + Prisma client generation)
# ---------------------------------------------------------------------------
FROM base AS development

ENV NODE_ENV=development

RUN pnpm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["pnpm", "run", "start:dev"]

# ---------------------------------------------------------------------------
# Stage 3: Build for production
# ---------------------------------------------------------------------------
FROM base AS builder

ENV NODE_ENV=production

RUN pnpm install --prod=false

COPY . .

RUN npx prisma generate
RUN pnpm run build

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
