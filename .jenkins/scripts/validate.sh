#!/usr/bin/env sh
set -eu

cd "${DEPLOY_DIR:?DEPLOY_DIR is required}"

docker compose -p "$COMPOSE_PROJECT_NAME" config --quiet
docker build --target lint --file frontend/Dockerfile .
AI_TEST_IMAGE="${COMPOSE_PROJECT_NAME}-ai-test"
docker build --target test --tag "$AI_TEST_IMAGE" --file ai_service/Dockerfile .
docker run --rm "$AI_TEST_IMAGE"
