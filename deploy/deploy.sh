#!/usr/bin/env bash
set -euo pipefail

# Non-destructive deployment script for Hostinger VPS (Ubuntu 24.04)
# Keeps .env and PostgreSQL data completely untouched.

APP_ROOT="/var/www/kajermanus"

echo "1) Installing backend dependencies..."
cd "$APP_ROOT/backend"
npm ci --omit=dev

echo "2) Running non-destructive database migrations (CREATE IF NOT EXISTS only)..."
npm run migrate

echo "3) Reloading PM2 backend process..."
pm2 startOrReload "$APP_ROOT/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "4) Building bilingual React website..."
cd "$APP_ROOT/website"
npm ci
npm run build

echo "5) Validating Nginx & health check..."
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://api.kajermanus.in/api/v1/health

echo "Deployment finished cleanly."
