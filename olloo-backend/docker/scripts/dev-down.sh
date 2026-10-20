#!/usr/bin/env bash
# Stop the local development stack.
#
#   ./docker/scripts/dev-down.sh          # keeps uploads, logs and node_modules
#   ./docker/scripts/dev-down.sh --purge  # also deletes them
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

FILES=(-f compose.yaml -f compose.dev.yaml)

if [ "${1:-}" = "--purge" ]; then
    echo "Removing containers, the network, the storage volume (uploads and logs) and node_modules."
    docker compose "${FILES[@]}" --profile mail down --volumes --remove-orphans
else
    echo "Removing containers and the network. Uploads, logs and node_modules are kept."
    docker compose "${FILES[@]}" --profile mail down --remove-orphans
fi