# Hostinger VPS Production Deployment Guide (Ubuntu 24.04)

## 1. Server Prerequisites (Ubuntu 24.04)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. PostgreSQL Setup (Non-Destructive)
```bash
sudo -u postgres psql -c "CREATE USER kajermanus_user WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE kajermanus_db OWNER kajermanus_user;"
```
Run non-destructive schema migrations and the verified West Bengal 23-district location master seeder:
```bash
cd /var/www/kajermanus/backend
mkdir -p uploads
bash scripts/backup-db.sh   # Run before any upgrade to snapshot existing production data
npx prisma generate
npm run migrate             # Runs 001 + 002 additive migrations + idempotent WB location seed
```
All migrations strictly use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `ON CONFLICT DO NOTHING` — existing users, providers, admins, bookings, and payments are never overwritten or deleted.

## 3. SSL Certificates (Let's Encrypt) for `www.kajermanus.in` & `api.kajermanus.in`
Issue SSL certificates **before** enabling the `443 ssl` Nginx blocks so `nginx -t` succeeds and `api.kajermanus.in` does not fail with `TLSV1_ALERT_UNRECOGNIZED_NAME`:
```bash
sudo certbot --nginx -d kajermanus.in -d www.kajermanus.in -d api.kajermanus.in
sudo cp /var/www/kajermanus/deploy/nginx-www.kajermanus.in.conf /etc/nginx/sites-available/www.kajermanus.in
sudo cp /var/www/kajermanus/deploy/nginx-api.kajermanus.in.conf /etc/nginx/sites-available/api.kajermanus.in
sudo ln -sf /etc/nginx/sites-available/www.kajermanus.in /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.kajermanus.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. GitHub Deployment & Independent Website Deploys
- Website (`website/`) can be rebuilt independently (`cd website && npm ci && npm run build`) without touching PostgreSQL or Android.
- Backend (`backend/`) never overwrites `.env` on `git pull` because `.env` is gitignored.

## 5. Android Production Release (`in.kajermanus.app`, APK / AAB)
1. In Firebase Console (for FCM push notifications only), register Android app `in.kajermanus.app` and replace `app/google-services.json`.
2. In `app/build.gradle.kts`, update `applicationId = "in.kajermanus.app"`.
3. Build signed AAB/APK in Android Studio or via Gradle:
```bash
gradle :app:bundleRelease
gradle :app:assembleRelease
```
