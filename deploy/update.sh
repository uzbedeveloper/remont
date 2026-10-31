#!/usr/bin/env bash
# Pull the latest code, rebuild, restart (run as root on the server).
set -euo pipefail
cd /srv/remont/app
sudo -u remont git pull --ff-only
sudo -u remont npm ci
sudo -u remont npx vite build
systemctl restart remont
systemctl --no-pager --lines=5 status remont
