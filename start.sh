#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Get the LTS version from https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
[ -d dist ] || npm run build
(sleep 2; (open http://localhost:3000 || xdg-open http://localhost:3000) >/dev/null 2>&1) &
echo "Outreach Mailer is running. Keep this window open - closing it stops scheduled sending."
node server/index.js
