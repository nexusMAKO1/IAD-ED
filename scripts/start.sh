#!/bin/bash
# =============================================================================
# start.sh — Démarrage de l'infrastructure IAD & SmartQueue AI
# Compatible Linux / WSL / macOS
# =============================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Fonctions utilitaires
# ---------------------------------------------------------------------------
info()    { echo -e "${BLUE}[INFO]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}==> $*${RESET}\n"; }

# ---------------------------------------------------------------------------
# Répertoire racine du projet
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Vérifications préalables
# ---------------------------------------------------------------------------
header "Vérification des prérequis"

check_command() {
  if ! command -v "$1" &>/dev/null; then
    error "$1 n'est pas installé. Consultez le README.md pour les prérequis."
  fi
  success "$1 détecté : $(command -v "$1")"
}

check_command docker

if docker compose version &>/dev/null; then
  success "docker compose détecté"
elif command -v docker-compose &>/dev/null; then
  success "docker-compose détecté"
else
  error "docker compose ou docker-compose n'est pas installé. Consultez le README.md pour les prérequis."
fi

# Vérifier que Docker daemon est actif
if ! docker info &>/dev/null; then
  error "Le daemon Docker n'est pas démarré. Lancez Docker Desktop ou 'sudo systemctl start docker'."
fi
success "Docker daemon actif"

# ---------------------------------------------------------------------------
# Fichier .env
# ---------------------------------------------------------------------------
header "Configuration des variables d'environnement"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  if [ -f "$PROJECT_ROOT/.env.example" ]; then
    warn "Fichier .env manquant. Copie depuis .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    warn "⚠️  IMPORTANT : Modifiez .env et changez tous les mots de passe CHANGE_ME avant de continuer en production !"
  else
    error "Ni .env ni .env.example trouvé dans $PROJECT_ROOT"
  fi
else
  # Avertir si des valeurs CHANGE_ME sont présentes
  if grep -q "CHANGE_ME" "$PROJECT_ROOT/.env" 2>/dev/null; then
    warn "⚠️  Des variables CHANGE_ME sont encore présentes dans .env"
    warn "   Ceci est acceptable en développement local, PAS en production"
  fi
  success ".env trouvé"
fi

# ---------------------------------------------------------------------------
# Création des répertoires de données
# ---------------------------------------------------------------------------
header "Création des répertoires locaux"

mkdir -p "$PROJECT_ROOT/data/models"
mkdir -p "$PROJECT_ROOT/data/model_store"
mkdir -p "$PROJECT_ROOT/data/uploads"
success "Répertoires data/ créés"

# ---------------------------------------------------------------------------
# Démarrage des services
# ---------------------------------------------------------------------------
header "Démarrage des services Docker"

# Construire les images si nécessaire
info "Construction des images Docker (si nécessaire)..."
docker compose build --parallel 2>&1 | tail -5

# Démarrer les services d'infrastructure en premier
info "Démarrage des services d'infrastructure (postgres, redis, mosquitto, minio)..."
docker compose up -d postgres redis mosquitto minio

info "Attente que les services soient prêts (30s)..."
sleep 30

# Vérifier que Postgres est prêt
info "Vérification de PostgreSQL..."
MAX_RETRIES=20
RETRY=0
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-iad_user}" &>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    error "PostgreSQL n'est pas prêt après $MAX_RETRIES tentatives"
  fi
  echo -n "."
  sleep 3
done
success "PostgreSQL prêt"

# Démarrer les services applicatifs
info "Démarrage des services applicatifs (backend, edge-cv, smartqueue-ml)..."
docker compose up -d backend edge-cv smartqueue-ml

sleep 10

# Démarrer le frontend et le monitoring
info "Démarrage du frontend et du monitoring (frontend, prometheus, grafana, exporters)..."
docker compose up -d frontend prometheus grafana postgres-exporter redis-exporter mosquitto-exporter

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
header "Démarrage terminé ✅"

echo -e "${BOLD}Services accessibles :${RESET}"
echo -e "  ${GREEN}Frontend         ${RESET}: http://localhost:${FRONTEND_PORT:-5173}"
echo -e "  ${GREEN}Backend API      ${RESET}: http://localhost:${API_PORT:-3000}"
echo -e "  ${GREEN}Swagger/OpenAPI  ${RESET}: http://localhost:${API_PORT:-3000}/api"
echo -e "  ${GREEN}Edge CV          ${RESET}: http://localhost:${CV_PORT:-8001}"
echo -e "  ${GREEN}SmartQueue ML    ${RESET}: http://localhost:${ML_PORT:-8002}"
echo -e "  ${GREEN}MinIO Console    ${RESET}: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo -e "  ${GREEN}Grafana          ${RESET}: http://localhost:${GRAFANA_PORT:-3001}"
echo -e "  ${GREEN}Prometheus       ${RESET}: http://localhost:${PROMETHEUS_PORT:-9090}"
echo ""
echo -e "Pour voir les logs : ${CYAN}docker compose logs -f [service]${RESET}"
echo -e "Pour arrêter      : ${CYAN}./scripts/stop.sh${RESET}"
