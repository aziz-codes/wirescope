#!/usr/bin/env bash
# Builds the playground and force-pushes it to the gh-pages branch.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:playground
out=$(mktemp -d)
cp -r playground/dist/. "$out"
touch "$out/.nojekyll"
git -C "$out" init -q -b gh-pages
git -C "$out" add -A
git -C "$out" commit -qm "deploy: playground demo"
git -C "$out" push -qf "$(git remote get-url origin)" gh-pages
rm -rf "$out"
echo "Deployed to https://aziz-codes.github.io/wirescope/"
