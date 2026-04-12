#!/usr/bin/env sh
set -eu

wait_for_host_port() {
  host="$1"
  port="$2"
  name="$3"

  echo "Waiting for ${name} at ${host}:${port}..."
  until nc -z "$host" "$port"; do
    sleep 2
  done
  echo "${name} is available."
}

wait_for_host_port "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}" "PostgreSQL"
wait_for_host_port "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" "Redis"
