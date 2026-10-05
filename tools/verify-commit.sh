#!/usr/bin/env bash
# Verify HEAD in a clean worktree so uncommitted work cannot mask missing files.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
wt=$(mktemp -d "${TMPDIR:-/tmp}/tallyman-verify-XXXX")
git -C "$root" worktree add --detach -q "$wt" HEAD
trap 'git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true' EXIT
if [ -f "$wt/package.json" ]; then
  if [ -d "$root/node_modules" ]; then ln -s "$root/node_modules" "$wt/node_modules"; fi
  (cd "$wt" && npm run --silent check) && echo "VERIFY OK: $(git -C "$root" rev-parse --short HEAD)"
else
  echo "VERIFY SKIPPED: no package.json at HEAD"
fi
