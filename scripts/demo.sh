#!/bin/bash
# =============================================================================
# demo.sh — SmartVision E2E Demonstration Automator
# =============================================================================

set -euo pipefail

# Colors for nice UI output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET} $*"; }
success() { echo -e "${GREEN}[OK]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}==> $*${RESET}\n"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

header "Starting SmartVision Live E2E Demo"

# 1. Start Docker Containers
info "Starting infrastructure and application containers..."
./scripts/start.sh

# 2. Wait for all containers to be fully healthy
info "Checking container health..."
MAX_RETRIES=20
RETRY=0
while true; do
  UNHEALTHY=$(docker compose ps --format json | grep -E '"HealthStatus":"(starting|unhealthy)"' || true)
  if [ -z "$UNHEALTHY" ]; then
    success "All containers are healthy!"
    break
  fi
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    warn "Some containers took too long to pass health checks. Proceeding anyway..."
    break
  fi
  echo -n "."
  sleep 3
done

# 3. Ensure database migrations & seeds are applied
header "Database Seeding and Initialization"
info "Running schema migrations and database seeding..."
./scripts/seed.sh

# 4. Expose every URL clearly
header "SmartVision Services Routing Map"
echo -e "--------------------------------------------------------"
echo -e " ${BOLD}Service${RESET}          | ${BOLD}Internal URL${RESET}          | ${BOLD}Host Access URL${RESET}"
echo -e "--------------------------------------------------------"
echo -e " Frontend Dashboard| http://iad_frontend:5173  | ${GREEN}http://localhost:5173${RESET}"
echo -e " NestJS Core API   | http://iad_backend:3000   | ${GREEN}http://localhost:3000${RESET}"
echo -e " Swagger Docs API  | -                         | ${GREEN}http://localhost:3000/docs${RESET}"
echo -e " Edge CV Engine    | http://iad_edge_cv:8001   | ${GREEN}http://localhost:8001${RESET}"
echo -e " SmartQueue ML     | http://iad_smartqueue_ml:8002| ${GREEN}http://localhost:8002${RESET}"
echo -e " MinIO Storage     | http://iad_minio:9000     | ${GREEN}http://localhost:9000${RESET}"
echo -e " MinIO Console     | http://iad_minio:9001     | ${GREEN}http://localhost:9001${RESET}"
echo -e " Prometheus Target | http://iad_prometheus:9090| ${GREEN}http://localhost:9090${RESET}"
echo -e " Grafana Analytics | http://iad_grafana:3000   | ${GREEN}http://localhost:3001${RESET}"
echo -e " MQTT Broker       | tcp://iad_mosquitto:1883  | ${GREEN}tcp://localhost:1883${RESET}"
echo -e "--------------------------------------------------------"

# 5. Open Web Browser Automatically
info "Opening Frontend Dashboard in your browser..."
open_browser() {
  local url="$1"
  if command -v open &>/dev/null; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url" &>/dev/null || true
  elif command -v explorer.exe &>/dev/null; then
    explorer.exe "$url" &>/dev/null || true
  else
    warn "Could not open browser automatically. Please navigate to: $url"
  fi
}

open_browser "http://localhost:5173"

success "Demo script completed successfully! Press Ctrl+C to exit or keep services running."
