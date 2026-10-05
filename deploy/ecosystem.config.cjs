/**
 * PM2 processes for MANOVA on the shared server. Started/reloaded by deploy/server-deploy.sh.
 * Both apps bind to ports no other project uses; nginx (deploy/nginx-manova.conf) is the public entry.
 *
 *   manova-api  backend/ (Elysia on Bun). Reads backend/.env; PORT below wins over the file.
 *   manova-web  .runtime/frontend (built Nuxt output). Proxies /api/v1/** to manova-api.
 */
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const apiPort = process.env.MANOVA_API_PORT || '4110'
const webPort = process.env.MANOVA_WEB_PORT || '4111'

module.exports = {
  apps: [
    {
      name: 'manova-api',
      cwd: path.join(root, 'backend'),
      // Bun is started directly (not as a PM2 "interpreter"): PM2's Bun wrapper loads the entry with
      // require(), which fails on src/index.ts because it uses top-level await.
      script: process.env.BUN_BIN || path.join(process.env.HOME || '', '.bun/bin/bun'),
      args: 'src/index.ts',
      interpreter: 'none',
      env: { PORT: apiPort },
      max_memory_restart: '700M',
      time: true
    },
    {
      name: 'manova-web',
      cwd: path.join(root, '.runtime/frontend'),
      script: 'server/index.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: webPort,
        NUXT_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`
      },
      max_memory_restart: '700M',
      time: true
    }
  ]
}
