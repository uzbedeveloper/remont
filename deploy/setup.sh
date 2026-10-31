#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for Remont (run as root):
#   DOMAIN=remontchi.uz bash setup.sh
# Then put MODEL_API_KEY into /etc/remont.env (see remont.env.example) and: systemctl restart remont
set -euo pipefail
DOMAIN=${DOMAIN:?set DOMAIN, e.g. remontchi.uz}
REPO=${REPO:-https://github.com/uzbedeveloper/remont.git}

# swap: 1 GB droplets need it for ffmpeg
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -y
apt-get install -y ca-certificates curl gnupg git ffmpeg ufw debian-keyring debian-archive-keyring apt-transport-https
# Node 22
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
# Caddy (automatic HTTPS)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

id remont >/dev/null 2>&1 || useradd --system --create-home --home-dir /srv/remont --shell /usr/sbin/nologin remont
if [ ! -d /srv/remont/app/.git ]; then sudo -u remont git clone "$REPO" /srv/remont/app; fi
cd /srv/remont/app && sudo -u remont git pull --ff-only && sudo -u remont npm ci && sudo -u remont npx vite build

[ -f /etc/remont.env ] || install -m 600 -o remont /dev/null /etc/remont.env
grep -q '^PUBLIC=' /etc/remont.env || printf 'PUBLIC=1\nPORT=3000\nDAILY_CALLS=1500\n' >> /etc/remont.env

install -m 644 /srv/remont/app/deploy/remont.service /etc/systemd/system/remont.service
sed "s/{{DOMAIN}}/$DOMAIN/g" /srv/remont/app/deploy/Caddyfile > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now remont
systemctl reload caddy || systemctl restart caddy
echo "done: https://$DOMAIN (needs MODEL_API_KEY in /etc/remont.env, then systemctl restart remont)"
