#!/bin/bash
# =============================================================================
# seed.sh — Initialisation et seed de la base de données
# Exécute les migrations Prisma et insère les données de base
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()   { echo -e "${BLUE}[INFO]${RESET} $*"; }
success(){ echo -e "${GREEN}[OK]${RESET} $*"; }
error()  { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header() { echo -e "\n${BOLD}${CYAN}==> $*${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

header "Seed de la base de données IAD"

# Vérifier que le backend est démarré
if ! docker compose ps backend | grep -q "running\|Up"; then
  error "Le service 'backend' n'est pas démarré. Lancez './scripts/start.sh' d'abord."
fi

# Vérifier que PostgreSQL est accessible
info "Vérification de PostgreSQL..."
MAX_RETRIES=10
RETRY=0
until docker compose exec -T postgres pg_isready &>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    error "PostgreSQL n'est pas accessible"
  fi
  sleep 2
done
success "PostgreSQL accessible"

# Exécuter les migrations Prisma
header "Migrations Prisma"
info "Application des migrations..."
docker compose exec -T backend npx prisma migrate deploy
success "Migrations appliquées"

# Générer le client Prisma
info "Génération du client Prisma..."
docker compose exec -T backend npx prisma generate
success "Client Prisma généré"

# Exécuter le seed
header "Insertion des données de base"
info "Exécution du seed Prisma..."
docker compose exec -T backend npx prisma db seed
success "Données de base insérées"

# Créer les buckets MinIO si nécessaire
header "Configuration MinIO"
info "Création des buckets MinIO..."
docker compose exec -T minio sh -c "
  mc alias set local http://localhost:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD 2>/dev/null || true
  mc mb --ignore-existing local/models
  mc mb --ignore-existing local/videos
  mc mb --ignore-existing local/uploads
  echo 'Buckets: models, videos, uploads créés'
" 2>/dev/null || warn "mc CLI non disponible dans minio — utilisez la console web : http://localhost:9001"

header "Seed terminé ✅"
echo -e "Base de données initialisée et prête pour le développement."
