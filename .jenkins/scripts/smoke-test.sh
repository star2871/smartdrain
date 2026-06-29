#!/usr/bin/env sh
set -eu

cd "${DEPLOY_DIR:?DEPLOY_DIR is required}"

print_diagnostics() {
    printf '\n[smoke] diagnostics\n' >&2
    docker compose -p "$COMPOSE_PROJECT_NAME" ps >&2 || true
    docker compose -p "$COMPOSE_PROJECT_NAME" logs --tail=80 nginx backend frontend >&2 || true

    nginx_container="$(docker compose -p "$COMPOSE_PROJECT_NAME" ps --quiet nginx || true)"
    if [ -n "$nginx_container" ]; then
        docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d/default.conf"}}nginx_conf={{.Source}} rw={{.RW}}{{end}}{{end}}' "$nginx_container" >&2 || true
    fi
}

nginx_container="$(docker compose -p "$COMPOSE_PROJECT_NAME" ps --quiet nginx)"
test -n "$nginx_container"

for attempt in $(seq 1 12); do
    nginx_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$nginx_container")"
    if [ "$nginx_status" = 'healthy' ]; then
        break
    fi
    sleep 5
done

if [ "$nginx_status" != 'healthy' ]; then
    printf '[smoke] nginx is not healthy: %s\n' "$nginx_status" >&2
    print_diagnostics
    exit 1
fi

check_url() {
    name="$1"
    url="$2"

    for attempt in $(seq 1 20); do
        if docker compose -p "$COMPOSE_PROJECT_NAME" exec -T nginx wget -q -O /dev/null "$url"; then
            printf '[smoke] %s ok on attempt %s\n' "$name" "$attempt"
            return 0
        fi

        printf '[smoke] %s not ready on attempt %s, retrying...\n' "$name" "$attempt" >&2
        sleep 3
    done

    printf '[smoke] %s failed after retries: %s\n' "$name" "$url" >&2
    return 1
}

if ! check_url "frontend" "http://127.0.0.1/"; then
    print_diagnostics
    exit 1
fi

if ! check_url "backend-api" "http://127.0.0.1/api/dashboard/summary"; then
    print_diagnostics
    exit 1
fi
