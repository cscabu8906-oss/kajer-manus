module.exports = {
  apps: [
    {
      name: 'kajer-manus-api',
      cwd: '/var/www/kajermanus/backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '512M',
      merge_logs: true
    }
  ]
};
