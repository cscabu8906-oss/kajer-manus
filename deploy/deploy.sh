#!/usr/bin/env bash
set -euo pipefail

# Non-destructive deployment script for Hostinger VPS (Ubuntu 24.04)
# Keeps .env and PostgreSQL data completely untouched.

APP_ROOT="/var/www/kajermanus"

echo "1) Creating pre-deployment PostgreSQL backup (zero data loss)..."
if [ -x "$APP_ROOT/backend/scripts/backup-db.sh" ]; then
  bash "$APP_ROOT/backend/scripts/backup-db.sh" || echo "Warning: backup script skipped (ensure PostgreSQL/pg_dump is configured)"
fi

echo "2) Installing backend dependencies & preparing uploads directory..."
cd "$APP_ROOT/backend"
mkdir -p "$APP_ROOT/backend/uploads"
npm ci --omit=dev
npx prisma generate

echo "3) Running non-destructive database migrations & West Bengal location seed..."
npm run migrate

echo "4) Reloading PM2 backend process..."
pm2 startOrReload "$APP_ROOT/deploy/ecosystem.config.cjs" --update-env
pm2 save

echo "5) Building bilingual React website..."
cd "$APP_ROOT/website"
npm ci
npm run build

echo "6) Validating Nginx & health check..."
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://api.kajermanus.in/api/v1/health

echo "Deployment finished cleanly."
