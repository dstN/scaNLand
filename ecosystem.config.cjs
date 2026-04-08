module.exports = {
  apps: [
    {
      name: 'scanland-api',
      script: 'dist/index.js',
      cwd: './server',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
