#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -W)"
cd "$repo_root"

cmd.exe //d //c '.dev\export-git-diff.cmd --no-open'

artifact="$repo_root/.dev/_git-diff.txt"
if [[ ! -s "$artifact" ]]; then
  printf 'Git review artifact was not generated: %s\n' "$artifact" >&2
  exit 1
fi

printf 'CxR artifact: %s\n' "$artifact"
