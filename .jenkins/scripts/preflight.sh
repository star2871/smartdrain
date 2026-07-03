#!/usr/bin/env sh
set -eu

: "${DEPLOY_DIR:?DEPLOY_DIR is required}"
: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is required}"

cd "$DEPLOY_DIR"
printf 'WORKSPACE=%s\n' "${WORKSPACE:-}"
printf 'DEPLOY_DIR=%s\n' "$DEPLOY_DIR"
printf 'CURRENT_DIRECTORY=%s\n' "$PWD"

command -v docker >/dev/null
command -v git >/dev/null
docker compose version >/dev/null

test -d "$DEPLOY_DIR"
test -w "$DEPLOY_DIR"
test -S /var/run/docker.sock
test -f "$DEPLOY_DIR/.env"
test -f "$DEPLOY_DIR/${COMPOSE_NGINX_CONF_PATH:-./nginx/default.conf}"
