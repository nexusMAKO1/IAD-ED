#!/bin/bash
# =============================================================================
# stop.sh — Arrêt de l'infrastructure IAD & SmartQueue AI
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()   { echo -e "${BLUE}[INFO]${RESET} $*"; }
success(){ echo -e "${GREEN}[OK]${RESET} $*"; }
header() { echo -e "\n${BOLD}${CYAN}==> $*${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

header "Arrêt de l'infrastructure IAD"

# Arrêt gracieux des services
info "Arrêt de tous les services..."
docker compose down --remove-orphans

success "Tous les services sont arrêtés"
echo ""
echo -e "Les volumes persistants sont conservés."
echo -e "Pour tout supprimer (volumes inclus) : ${CYAN}./scripts/reset.sh${RESET}"
