#!/usr/bin/env sh
set -eu

./scripts/wait-for-services.sh

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running Alembic migrations..."
  alembic upgrade head
fi

echo "Starting backend..."
exec node dist/main.js
