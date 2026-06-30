#!/bin/bash
set -euo pipefail

COORD_HOST="${CITUS_COORDINATOR_HOST:-citus-coordinator}"
DB="${POSTGRES_DB:-encrypt_feed}"
USER="${POSTGRES_USER:-encrypt}"
export PGPASSWORD="${POSTGRES_PASSWORD:-encrypt}"

WORKERS=(
  citus-worker-1
  citus-worker-2
  citus-worker-3
)

wait_for_postgres() {
  local host="$1"
  until pg_isready -h "$host" -U "$USER" -d "$DB" >/dev/null 2>&1; do
    echo "waiting for postgres on ${host}..."
    sleep 1
  done
}

add_node_if_missing() {
  local worker="$1"
  local exists
  exists="$(
    psql -h "$COORD_HOST" -U "$USER" -d "$DB" -tAc \
      "SELECT count(*) FROM pg_dist_node WHERE nodename = '${worker}'"
  )"
  if [ "${exists}" = "0" ]; then
    echo "registering worker ${worker}"
    psql -h "$COORD_HOST" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 \
      -c "SELECT citus_add_node('${worker}', 5432);"
  else
    echo "worker ${worker} already registered"
  fi
}

echo "waiting for citus nodes..."
wait_for_postgres "$COORD_HOST"
for worker in "${WORKERS[@]}"; do
  wait_for_postgres "$worker"
done

echo "configuring coordinator host"
psql -h "$COORD_HOST" -U "$USER" -d "$DB" \
  -c "SELECT citus_set_coordinator_host('${COORD_HOST}', 5432);" \
  || echo "coordinator host already configured"

for worker in "${WORKERS[@]}"; do
  add_node_if_missing "$worker"
done

echo "active workers:"
psql -h "$COORD_HOST" -U "$USER" -d "$DB" -c "SELECT * FROM citus_get_active_worker_nodes();"

echo ""
echo "citus-bootstrap finished successfully."
echo "This is a one-shot init container — exiting is expected (restart: no)."
