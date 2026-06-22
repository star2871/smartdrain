#!/usr/bin/env sh
set -eu

cd "${DEPLOY_DIR:?DEPLOY_DIR is required}"

docker compose -p "$COMPOSE_PROJECT_NAME" config --quiet
docker build --target lint --file frontend/Dockerfile .
AI_TEST_IMAGE="${COMPOSE_PROJECT_NAME}-ai-test"
docker build --target test --tag "$AI_TEST_IMAGE" --file ai_service/Dockerfile .
docker run --rm "$AI_TEST_IMAGE"
docker compose -p "$COMPOSE_PROJECT_NAME" run --rm --no-deps --build ai-service \
    python -c "from pathlib import Path; paths = (Path('/app/ai_service/model/best.pt'), Path('/app/ai_service/model/sewer_xgboost_model.json')); missing = [str(path) for path in paths if not path.is_file() or path.stat().st_size == 0]; assert not missing, f'Missing or empty model artifacts: {missing}'"
