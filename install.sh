#!/usr/bin/env bash
# Spielplatzkarte Hub — production installer
#
# Usage (no clone required):
#   curl -fsSL https://raw.githubusercontent.com/mfuhrmann/spielplatzkarte-hub/main/install.sh | bash
#
# Or download and run:
#   bash install.sh

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { printf "${CYAN}▶ %s${RESET}\n" "$*"; }
success() { printf "${GREEN}✓ %s${RESET}\n"  "$*"; }
warn()    { printf "${YELLOW}⚠ %s${RESET}\n" "$*"; }
error()   { printf "${RED}✗ %s${RESET}\n" "$*" >&2; }
bold()    { printf "${BOLD}%s${RESET}\n" "$*"; }

# ── Defaults ───────────────────────────────────────────────────────────────────
IMAGE="ghcr.io/mfuhrmann/spielplatzkarte-hub"
DEFAULT_TAG="latest"
DEFAULT_PORT="8090"
DEFAULT_MAP_CENTER="10.5,51.2"
DEFAULT_MAP_ZOOM="5"
DEFAULT_MAP_MIN_ZOOM="4"
DEFAULT_DIR="spielplatzkarte-hub"

# ── Helpers ────────────────────────────────────────────────────────────────────
require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    echo "  Install it and re-run this script." >&2
    exit 1
  fi
}

# Read from /dev/tty so the function works when stdin is a pipe (curl | bash).
prompt() {
  local var="$1" label="$2" default="$3"
  local input
  printf "${BOLD}%s${RESET} [%s]: " "$label" "$default"
  read -r input </dev/tty
  printf -v "$var" '%s' "${input:-$default}"
}

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
bold "╔═══════════════════════════════════════════╗"
bold "║   Spielplatzkarte Hub — Installer          ║"
bold "╚═══════════════════════════════════════════╝"
echo ""
echo "  Sets up a production Docker Compose stack."
echo "  No source code clone required."
echo ""

# ── Prerequisite checks ────────────────────────────────────────────────────────
info "Checking prerequisites…"

require_cmd docker

# Docker Compose — either standalone or plugin
if docker compose version &>/dev/null; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD=(docker-compose)
else
  error "Docker Compose not found."
  echo "  Install the Docker Compose plugin or standalone binary and re-run." >&2
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running (or you lack permission to reach it)."
  echo "  Start Docker and re-run, or prefix the script with sudo." >&2
  exit 1
fi

success "Docker $(docker version --format '{{.Client.Version}}')"
success "Compose (${COMPOSE_CMD[*]})"

# ── Configuration prompts ──────────────────────────────────────────────────────
echo ""
bold "── Configuration ─────────────────────────────"
echo ""

prompt INSTALL_DIR  "Install directory" "$DEFAULT_DIR"
prompt IMAGE_TAG    "Image tag (e.g. latest, 0.2.1)" "$DEFAULT_TAG"
prompt APP_PORT     "Host port" "$DEFAULT_PORT"
prompt MAP_CENTER   "Map centre (lon,lat)" "$DEFAULT_MAP_CENTER"
prompt MAP_ZOOM     "Default zoom level" "$DEFAULT_MAP_ZOOM"
prompt MAP_MIN_ZOOM "Minimum zoom level" "$DEFAULT_MAP_MIN_ZOOM"

echo ""

# ── Create directory ───────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR" ]]; then
  warn "Directory '$INSTALL_DIR' already exists."
  printf "${BOLD}Continue and overwrite existing files?${RESET} [y/N]: "
  read -r confirm </dev/tty
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
else
  mkdir -p "$INSTALL_DIR"
fi

cd "$INSTALL_DIR" || { error "Cannot enter directory: $INSTALL_DIR"; exit 1; }
info "Working in: $PWD"

# ── docker-compose.yml ─────────────────────────────────────────────────────────
info "Writing docker-compose.yml…"
cat > docker-compose.yml <<EOF
# Spielplatzkarte Hub — production stack
#
# Manage:
#   docker compose up -d                          # start
#   docker compose pull && docker compose up -d   # update image
#   docker compose down                           # stop
#   docker compose logs -f                        # tail logs

services:

  app:
    image: ${IMAGE}:\${IMAGE_TAG:-latest}
    ports:
      - "\${APP_PORT:-8090}:80"
    environment:
      REGISTRY_URL: \${REGISTRY_URL:-./registry.json}
      MAP_ZOOM:     \${MAP_ZOOM:-5}
      MAP_MIN_ZOOM: \${MAP_MIN_ZOOM:-4}
      MAP_CENTER:   \${MAP_CENTER:-10.5,51.2}
    volumes:
      - ./registry.json:/usr/share/nginx/html/registry.json:ro
    restart: unless-stopped
EOF
success "docker-compose.yml"

# ── .env ──────────────────────────────────────────────────────────────────────
info "Writing .env…"
cat > .env <<EOF
# Spielplatzkarte Hub — runtime configuration
# Edit and run "docker compose up -d" to apply changes.

# Image tag to run (e.g. latest, 0.2.1)
IMAGE_TAG="${IMAGE_TAG}"

# URL of the instance registry.
# Use ./registry.json to serve the local file (default),
# or point to a remote URL.
REGISTRY_URL=./registry.json

# Initial map view
MAP_ZOOM="${MAP_ZOOM}"
MAP_MIN_ZOOM="${MAP_MIN_ZOOM}"
# lon,lat
MAP_CENTER="${MAP_CENTER}"

# Host port
APP_PORT="${APP_PORT}"
EOF
success ".env"

# ── registry.json ──────────────────────────────────────────────────────────────
if [[ -f registry.json ]]; then
  warn "registry.json already exists — skipping (keeping your existing entries)."
else
  info "Writing registry.json…"
  cat > registry.json <<'EOF'
[
  {
    "comment": "Add your regional Spielplatzkarte instances here.",
    "name":    "Example instance",
    "url":     "https://spielplatzkarte.example.org",
    "bbox":    [5.9, 47.3, 15.0, 55.0]
  }
]
EOF
  success "registry.json"
  warn "Edit registry.json to add your regional instances before starting."
fi

# ── Pull image ─────────────────────────────────────────────────────────────────
echo ""
info "Pulling image ${IMAGE}:${IMAGE_TAG}…"
"${COMPOSE_CMD[@]}" pull

# ── Start ──────────────────────────────────────────────────────────────────────
echo ""
printf "${BOLD}Start the stack now?${RESET} [Y/n]: "
read -r start_now </dev/tty
if [[ ! "$start_now" =~ ^[Nn]$ ]]; then
  info "Starting stack…"
  "${COMPOSE_CMD[@]}" up -d
  echo ""
  success "Stack is running!"
  echo ""
  echo "  Open: http://localhost:${APP_PORT}"
  echo ""
  echo "  Useful commands (run from $PWD):"
  echo "    ${COMPOSE_CMD[*]} logs -f"
  echo "    ${COMPOSE_CMD[*]} down"
  echo "    ${COMPOSE_CMD[*]} pull && ${COMPOSE_CMD[*]} up -d"
else
  echo ""
  success "Files written. Start the stack later with:"
  echo ""
  echo "    cd $PWD"
  echo "    ${COMPOSE_CMD[*]} up -d"
fi

echo ""
bold "Done. Edit registry.json to configure your regional instances."
echo ""
