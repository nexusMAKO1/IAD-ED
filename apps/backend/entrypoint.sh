#!/bin/sh
# =============================================================================
# entrypoint.sh — Backend startup script
# Runs Prisma migrations and seeds the database before starting NestJS.
# =============================================================================

set -e

echo "================================================================"
echo " Express Display SmartVision — Backend Startup"
echo "================================================================"

# ---------------------------------------------------------------------------
# 1. Run Prisma migrations (idempotent — safe to run every time)
# ---------------------------------------------------------------------------
echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy
echo "[entrypoint] Migrations applied."

# ---------------------------------------------------------------------------
# 2. Seed the database if the admin user does not exist
#    Uses a simple check to avoid re-seeding on every restart.
# ---------------------------------------------------------------------------
echo "[entrypoint] Checking if database seed is needed..."
npx prisma db seed && echo "[entrypoint] Seed completed." || echo "[entrypoint] Seed skipped (data already exists or failed — check logs)."

# ---------------------------------------------------------------------------
# 3. Start NestJS
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting NestJS application..."
exec "$@"
