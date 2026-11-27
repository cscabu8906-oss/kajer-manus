# PostgreSQL Backup & Restore Guide (Kajer Manus)

## Daily Encrypted/Compressed Backup
Add a cron job on Hostinger VPS (`crontab -e`):
```bash
0 2 * * * pg_dump -U kajermanus_user -h 127.0.0.1 -Fc kajermanus_db > /var/backups/kajermanus_$(date +\%F).dump
```

## Safe Restore Procedure
Never drop a live database without first taking an emergency snapshot:
```bash
pg_dump -U kajermanus_user -h 127.0.0.1 -Fc kajermanus_db > /var/backups/emergency_pre_restore.dump
pg_restore -U kajermanus_user -h 127.0.0.1 -d kajermanus_db --clean --if-exists /var/backups/kajermanus_YYYY-MM-DD.dump
```
