#!/usr/bin/env bash
# Fails if any non-empty value from ../.env.local appears in the staged files. Never prints values.
cd "$(dirname "$0")/.." || exit 1
leaks=0
while IFS='=' read -r k v; do
  v="${v%$'\r'}"; k="${k%$'\r'}"
  [ -z "$v" ] || [ "${k:0:1}" = "#" ] && continue
  [ ${#v} -lt 12 ] && continue
  if git grep --cached -l -F -- "$v" >/dev/null 2>&1; then echo "LEAK: value of $k found in staged files"; leaks=1; fi
done < .env.local
exit $leaks
