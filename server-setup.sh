#!/usr/bin/env bash
# Run this once on the server to set up family-feudal for the first time.
# Assumes: Node.js installed, pnpm installed.

set -e

REPO="https://github.com/thespoonftw/family-feudal.git"
DIR="/home/spoon/family-feudal"
SERVICE="family-feudal"

# Clone
git clone "$REPO" "$DIR"
cd "$DIR"

# Install deps and build
pnpm install --frozen-lockfile
pnpm --filter @family-feudal/shared build
pnpm --filter @family-feudal/server build
pnpm --filter @family-feudal/client build

# Create .env
cp packages/server/.env.example packages/server/.env

# Install systemd user service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/$SERVICE.service <<EOF
[Unit]
Description=Family Feudal Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$DIR/packages/server
ExecStart=$(which node) $DIR/packages/server/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$DIR/packages/server/.env

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable $SERVICE
systemctl --user start $SERVICE

echo "Service '$SERVICE' installed and started on port 3002."
echo "Check status: systemctl --user status $SERVICE"
echo "View logs:    journalctl --user -u $SERVICE -f"
