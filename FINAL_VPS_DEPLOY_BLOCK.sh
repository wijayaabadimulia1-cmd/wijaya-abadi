#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# FINAL DEPLOY BLOCK FOR UBUNTU 22.04 + NODE + PM2 + NGINX
# DOMAIN: kreditmotorhonda.tech
# ==========================================================




















SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/deploy-vps.sh" "$@"
