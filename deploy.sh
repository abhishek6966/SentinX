#!/bin/bash
# =============================================================================
# SentinX — Hostinger VPS Manual Deployment Script
# Run this on first setup OR for manual deploys outside GitHub Actions
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [setup|deploy|rollback|status|logs]
#
# Requirements: PM2, Node.js 20+, Git installed on VPS
# =============================================================================

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
APP_DIR="/home/${USER}/sentinx"
REPO_URL="${REPO_URL:-https://github.com/YOUR_USERNAME/sentinx.git}"
NODE_ENV="production"
PM2_API_NAME="sentinx-api"
PM2_WORKERS_NAME="sentinx-workers"
BACKUP_DIR="/home/${USER}/sentinx-backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗ ERROR:${NC} $*"; exit 1; }

# ─── Command: setup ───────────────────────────────────────────────────────────
cmd_setup() {
  log "=== SentinX First-Time Setup ==="

  # Check prerequisites
  command -v node >/dev/null || fail "Node.js not found. Install Node.js 20+ first."
  command -v npm  >/dev/null || fail "npm not found."
  command -v git  >/dev/null || fail "Git not found."

  NODE_MAJOR=$(node -e "process.stdout.write(process.version.split('.')[0].replace('v',''))")
  [ "$NODE_MAJOR" -ge 20 ] || fail "Node.js 20+ required (found $(node -v))"

  # Install PM2 globally
  if ! command -v pm2 &>/dev/null; then
    log "Installing PM2..."
    npm install -g pm2
    pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || warn "PM2 startup may need sudo"
  fi
  ok "PM2 installed"

  # Clone repository
  if [ -d "$APP_DIR" ]; then
    warn "Directory $APP_DIR exists — pulling latest instead"
    cd "$APP_DIR" && git pull origin main
  else
    log "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
  fi
  ok "Repository ready"

  # Copy environment files
  if [ ! -f "$APP_DIR/backend/.env" ]; then
    if [ -f "$APP_DIR/backend/.env.example" ]; then
      cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
      warn "Created backend/.env from example — EDIT this file with real credentials!"
    fi
  fi

  cmd_build
  cmd_migrate
  cmd_start

  log "=== Setup Complete ==="
  ok "SentinX is running. Use './deploy.sh status' to check health."
  log "Edit $APP_DIR/backend/.env with your API keys before production use."
}

# ─── Command: build ───────────────────────────────────────────────────────────
cmd_build() {
  log "Building all packages..."
  cd "$APP_DIR"
  npm ci --workspaces --omit=dev
  npm run build --workspace=shared
  npm run build --workspace=backend
  npm run build --workspace=workers
  ok "Build complete"
}

# ─── Command: migrate ─────────────────────────────────────────────────────────
cmd_migrate() {
  log "Running database migrations..."
  cd "$APP_DIR/backend"
  npx drizzle-kit push:pg
  ok "Migrations applied"
}

# ─── Command: deploy ──────────────────────────────────────────────────────────
cmd_deploy() {
  log "=== SentinX Deployment ==="

  # Backup current dist
  mkdir -p "$BACKUP_DIR"
  BACKUP_TS=$(date +%Y%m%d_%H%M%S)
  if [ -d "$APP_DIR/backend/dist" ]; then
    cp -r "$APP_DIR/backend/dist" "$BACKUP_DIR/backend_dist_$BACKUP_TS"
    log "Backed up backend dist to $BACKUP_DIR/backend_dist_$BACKUP_TS"
  fi

  cd "$APP_DIR"
  log "Pulling latest code..."
  git fetch origin
  git reset --hard origin/main
  ok "Code updated to $(git rev-parse --short HEAD)"

  cmd_build
  cmd_migrate
  cmd_restart

  log "=== Deployment Complete ==="
  cmd_status
}

# ─── Command: start ───────────────────────────────────────────────────────────
cmd_start() {
  log "Starting SentinX services..."
  cd "$APP_DIR"

  # API server (cluster mode, 2 instances)
  pm2 start backend/dist/server.js \
    --name "$PM2_API_NAME" \
    --instances 2 \
    --exec-mode cluster \
    --max-memory-restart 512M \
    --env "$NODE_ENV" \
    --merge-logs \
    --log "$HOME/.pm2/logs/sentinx-api.log" \
    -- --env-file backend/.env \
    2>/dev/null || warn "API process may already be running"

  # Workers (single instance)
  pm2 start workers/dist/index.js \
    --name "$PM2_WORKERS_NAME" \
    --instances 1 \
    --max-memory-restart 256M \
    --env "$NODE_ENV" \
    --merge-logs \
    --log "$HOME/.pm2/logs/sentinx-workers.log" \
    -- --env-file backend/.env \
    2>/dev/null || warn "Workers process may already be running"

  pm2 save
  ok "Services started"
}

# ─── Command: restart ─────────────────────────────────────────────────────────
cmd_restart() {
  log "Restarting services (zero-downtime)..."
  pm2 reload "$PM2_API_NAME" --update-env   2>/dev/null || cmd_start
  pm2 restart "$PM2_WORKERS_NAME" --update-env 2>/dev/null || true
  ok "Services restarted"
}

# ─── Command: rollback ────────────────────────────────────────────────────────
cmd_rollback() {
  log "=== Rolling back ==="
  LATEST_BACKUP=$(ls -1t "$BACKUP_DIR" | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    fail "No backup found in $BACKUP_DIR"
  fi
  log "Restoring $LATEST_BACKUP..."
  rm -rf "$APP_DIR/backend/dist"
  cp -r "$BACKUP_DIR/$LATEST_BACKUP" "$APP_DIR/backend/dist"
  cmd_restart
  ok "Rollback complete"
}

# ─── Command: status ──────────────────────────────────────────────────────────
cmd_status() {
  log "=== Service Status ==="
  pm2 list
  echo ""
  log "=== Health Check ==="
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT:-8080}/health 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    ok "API is healthy (HTTP $HTTP_STATUS)"
  else
    warn "API health check returned HTTP $HTTP_STATUS"
  fi
}

# ─── Command: logs ────────────────────────────────────────────────────────────
cmd_logs() {
  SERVICE="${2:-$PM2_API_NAME}"
  pm2 logs "$SERVICE" --lines 100
}

# ─── Command: ssl ─────────────────────────────────────────────────────────────
cmd_ssl() {
  log "Setting up HTTPS with Nginx reverse proxy..."
  if ! command -v nginx &>/dev/null; then
    warn "Nginx not found. Install with: sudo apt install nginx certbot python3-certbot-nginx"
    return
  fi

  DOMAIN="${DOMAIN:-api.yourdomain.com}"
  cat > /tmp/sentinx-nginx.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:${PORT:-8080};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
        client_max_body_size 10M;
    }
}
EOF
  sudo cp /tmp/sentinx-nginx.conf /etc/nginx/sites-available/sentinx
  sudo ln -sf /etc/nginx/sites-available/sentinx /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${CERT_EMAIL:-admin@yourdomain.com}"
  ok "SSL configured for $DOMAIN"
}

# ─── Entrypoint ───────────────────────────────────────────────────────────────
COMMAND="${1:-help}"
case "$COMMAND" in
  setup)    cmd_setup ;;
  build)    cmd_build ;;
  deploy)   cmd_deploy ;;
  start)    cmd_start ;;
  restart)  cmd_restart ;;
  rollback) cmd_rollback ;;
  status)   cmd_status ;;
  migrate)  cmd_migrate ;;
  ssl)      cmd_ssl ;;
  logs)     cmd_logs "$@" ;;
  help|*)
    echo ""
    echo "SentinX Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup     — First-time server setup (clone, install, start)"
    echo "  deploy    — Pull latest code, build, migrate, restart (zero-downtime)"
    echo "  build     — Build all packages without restarting"
    echo "  migrate   — Run database migrations only"
    echo "  restart   — Restart all PM2 processes"
    echo "  rollback  — Restore previous build from backup"
    echo "  status    — Show PM2 process list + health check"
    echo "  logs      — Stream logs (default: sentinx-api)"
    echo "  ssl       — Configure Nginx + Let's Encrypt SSL"
    echo ""
    ;;
esac
