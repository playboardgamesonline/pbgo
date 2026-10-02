#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$#" -gt 0 ] || { echo "Usage : pnpm setup-env <jeu> [<jeu> ...]   ou   pnpm setup-env --all"; exit 1; }
if [ "$1" = "--all" ]; then set -- $(ls games); fi
for g in "$@"; do
  [ -f "games/$g/scripts/setup-env.sh" ] || { echo "absent : games/$g"; continue; }
  echo; echo "=== $g ==="
  bash "games/$g/scripts/setup-env.sh" || echo "échec : $g"
done
