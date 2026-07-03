#!/usr/bin/env sh
set -eu

cd "${DEPLOY_DIR:?DEPLOY_DIR is required}"
docker compose -p "$COMPOSE_PROJECT_NAME" up --detach --build --remove-orphans
docker compose -p "$COMPOSE_PROJECT_NAME" up --detach --no-deps --force-recreate nginx
docker compose -p "$COMPOSE_PROJECT_NAME" ps

nginx_conf_path="${COMPOSE_NGINX_CONF_PATH:-./nginx/default.conf}"
nginx_conf_abs="$(cd "$DEPLOY_DIR" && readlink -f "$nginx_conf_path")"
nginx_container="$(docker compose -p "$COMPOSE_PROJECT_NAME" ps --quiet nginx)"
test -n "$nginx_container"
nginx_mount="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}{{.Source}}|{{.RW}}{{end}}{{end}}' "$nginx_container")"
test "$nginx_mount" = "$nginx_conf_abs|false"
