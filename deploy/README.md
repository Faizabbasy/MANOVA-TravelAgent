# Deploy & CI/CD

Target: shared server `sfiadmin@103.87.67.210` (SFI-Development). Public URL: `http://103.87.67.210:8092`.

## How it runs on the server

| Piece | Where | Notes |
|---|---|---|
| Checkout | `~/project/manova` | detached at the deployed commit |
| API | PM2 `manova-api`, Bun, port `4110` | config in `backend/.env` (not in git) |
| Web | PM2 `manova-web`, Node, `127.0.0.1:4111` | runs the built output in `.runtime/frontend` |
| Public entry | nginx site `manova`, port `8092` | `deploy/nginx-manova.conf` |
| Database | PostgreSQL 17 on port `7700`, database `manova`, role `manova_user` | |
| Deploy log | `~/project/manova-deploy.log` | |

The server runs in **staging mode** (`APP_ENV=development` on PostgreSQL with demo data). `APP_ENV=production`
forces secure cookies, so it needs HTTPS, and there is no way yet to create real accounts
(see `docs/manova-finance-implementation/15-RELEASE-AND-CUTOVER.md`).

## Pipeline (`.github/workflows/deploy.yml`)

Push to `production` (or a PR into it):

1. **Backend** job: `bun install`, typecheck, tests.
2. **Frontend** job: `pnpm install`, typecheck, tests, build.
3. **Deploy** job (push only, after both pass): `ssh <server> <commit sha>`.

On the server that SSH key can only run `~/project/manova-ci-entry.sh` (copy of `deploy/ci-entry.sh`). It checks
that the commit is on `production`, checks it out and runs `deploy/server-deploy.sh`, which:

- reinstalls/rebuilds **only the package that changed** since the last deploy (`backend/` or `frontend/`),
- applies database migrations,
- reloads `manova-api` and `manova-web` with PM2 and fails the job if the health checks do not pass.

Frontend lint is not part of CI yet: the ESLint config references a package that is not installed.

### Repository secrets

| Secret | Value |
|---|---|
| `VPS_HOST` | `103.87.67.210` |
| `VPS_USER` | `sfiadmin` |
| `VPS_SSH_KEY` | private half of the dedicated CI key (comment `manova-github-actions` in `authorized_keys`) |
| `VPS_KNOWN_HOSTS` | the server's SSH host key line(s) |

## By hand

```bash
~/project/manova-ci-entry.sh <commit-sha>      # deploy a commit that is on production
pm2 logs manova-api                            # or manova-web
pm2 reload manova-api --update-env             # after editing backend/.env
cd ~/project/manova/backend && ~/.bun/bin/bun run db:status
```

Roll back: revert the commit on `production` and push; the pipeline deploys the revert. Migrations are not
rolled back automatically (`bun run db:rollback`, see the release document).

`deploy/bootstrap-server.sh` is the one-time server preparation (database, `.env`, nginx site, CI key).
If `deploy/ci-entry.sh` changes, re-run the bootstrap to install the new copy.
