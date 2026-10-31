#!/usr/bin/env bash
# Pull the latest code, rebuild, restart (runs as root on the server; also what CI runs on every push).
set -euo pipefail
cd /srv/remont/app
before=$(sudo -u remont git rev-parse HEAD)
sudo -u remont git pull --ff-only
# reinstall packages only when the lockfile changed
if [ ! -d node_modules ] || ! sudo -u remont git diff --quiet "$before" HEAD -- package-lock.json; then sudo -u remont npm ci --no-audit --no-fund; fi
sudo -u remont npx vite build
systemctl restart remont
sleep 2
systemctl is-active remont
for i in 1 2 3 4 5; do curl -fsS localhost:3000/api/health && echo && break || sleep 2; done
curl -fsS -o /dev/null localhost:3000/api/health
echo "deployed $(sudo -u remont git log --oneline -1)"
