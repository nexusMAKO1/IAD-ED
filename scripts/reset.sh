#!/bin/bash
# =============================================================================
# reset.sh — Réinitialisation COMPLÈTE de l'infrastructure
# ⚠️  ATTENTION : Supprime TOUS les volumes et données persistantes
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()   { echo -e "\033[0;34m[INFO]${RESET} $*"; }
success(){ echo -e "${GREEN}[OK]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${RESET} $*"; }
header() { echo -e "\n${BOLD}${CYAN}==> $*${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

header "⚠️  RÉINITIALISATION COMPLÈTE"

echo -e "${RED}${BOLD}ATTENTION !${RESET}"
echo -e "Cette commande va :"
echo -e "  • Arrêter TOUS les containers"
echo -e "  • Supprimer TOUS les volumes Docker (base de données, Redis, MinIO...)"
echo -e "  • Supprimer les données locales dans data/"
echo ""
read -r -p "Êtes-vous sûr ? Tapez 'RESET' pour confirmer : " CONFIRM

if [ "$CONFIRM" != "RESET" ]; then
  echo "Annulé."
  exit 0
fi

header "Arrêt et suppression des containers et volumes"

docker compose down --volumes --remove-orphans
success "Containers et volumes Docker supprimés"

# Nettoyer les images construites localement (optionnel)
read -r -p "Supprimer aussi les images Docker locales ? (y/N) : " DEL_IMAGES
if [[ "$DEL_IMAGES" =~ ^[Yy]$ ]]; then
  info "Suppression des images locales..."
  docker compose images -q 2>/dev/null | xargs docker rmi -f 2>/dev/null || true
  success "Images supprimées"
fi

# Nettoyer les données locales
header "Nettoyage des données locales"

if [ -d "$PROJECT_ROOT/data" ]; then
  warn "Suppression de data/ (modèles, uploads)..."
  rm -rf "$PROJECT_ROOT/data"
  success "data/ supprimé"
fi

# Recréer la structure minimale
mkdir -p "$PROJECT_ROOT/data/models"
mkdir -p "$PROJECT_ROOT/data/model_store"
mkdir -p "$PROJECT_ROOT/data/uploads"
success "Structure data/ recréée"

header "Réinitialisation terminée ✅"
echo "Lancez './scripts/start.sh' pour redémarrer proprement."
