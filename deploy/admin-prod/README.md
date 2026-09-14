# Production venue panel — admin.book-eat.com

Runbook for `.github/workflows/deploy-admin-prod.yml`. Mechanics: ADR-024.

## 0. What has to exist

Repository secrets (Settings → Secrets → Actions):

| Secret | What it is |
| --- | --- |
| `SSH_PRIVATE_KEY` | deploy key accepted by the production host |
| `SSH_KNOWN_HOSTS` | must contain an entry for the production host, not only the stand |
| `PROD_SSH_HOST`, `PROD_SSH_USER` | the production box (same one as `deploy-web-prod.yml`) |
| `PROD_VAPID_PUBLIC_KEY` | must equal the production backend's `PUSH_VAPID_PUBLIC_KEY` |

On the host: `/opt/bookeat/admin` writable by the deploy user, `current` a
**symlink** into `releases/`, Caddy's root `/srv/admin/current`. The workflow's
preflight checks all three and refuses to upload otherwise.

## 1. Release

There is **no** push trigger. A release is a deliberate act:

```bash
gh workflow run deploy-admin-prod.yml --ref main -f confirm=deploy-to-prod
# without gh:
curl -X POST -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/bookeat1/frontend/actions/workflows/deploy-admin-prod.yml/dispatches \
  -d '{"ref":"main","inputs":{"confirm":"deploy-to-prod"}}'
```

The gate refuses any ref other than `main` and any confirm string other than
`deploy-to-prod`, before CI and the build even start.

What the run does: CI (`ci.yml`) → static export against the production backend
→ assertions on the artifact (production API URL present, stand API URL absent,
no `/admin-preview` basePath, production Amplitude and VAPID keys present) →
rsync into `releases/.incoming-<release>` → rename into `releases/<release>` →
`bin/release.sh` swaps the `current` symlink → public verification
(`/`, `/login/`, `/sw.js`, `/venues/`, `/settings/`, `release.txt` equals this
release) → neighbours on the host still answer (backend `/health`,
`book-eat.com`). Any failure after the swap rolls back automatically.

No downtime: the swap is one `rename(2)`, Caddy is never reloaded, a request
gets either the whole old release or the whole new one.

## 2. Rollback

```bash
ssh <prod> 'ADMIN_ROOT=/opt/bookeat/admin /opt/bookeat/admin/bin/rollback.sh'
# to a specific release:
ssh <prod> 'ADMIN_ROOT=/opt/bookeat/admin /opt/bookeat/admin/bin/rollback.sh 20260912-084534-0ef054e'
ls /opt/bookeat/admin/releases      # what can be rolled back to
cat /opt/bookeat/admin/releases.log # who swapped what, when
curl -s https://admin.book-eat.com/release.txt
```

`rollback.sh` with no argument uses `$ADMIN_ROOT/.previous`, which `release.sh`
writes on every swap. Rolling back does not delete anything, so rolling forward
again is the same command with the newer release name.

## 3. Known traps

- **Nothing here deploys automatically.** Merging into `main` deploys the
  desktop site and the mobile web origin; the panel waits for this workflow.
- `NEXT_PUBLIC_BASE_PATH` must stay empty for production. The stand builds with
  `/admin-preview`, and that prefix is baked into every asset URL at build time.
- `sw.js` legitimately mentions `/admin-preview/` in a comment about scope
  detection; the assertion excludes that one file and nothing else.
- Old releases are never pruned by this workflow. They are ~3 MB each; delete
  them by hand if the disk ever matters, never the one `current` points at nor
  the one named in `.previous`.
- The flat legacy copy in the root of `/opt/bookeat/admin` is a leftover from
  before ADR-024 and is not kept in sync. Never `rsync --delete` into the root
  of the mount: `releases/` and `bin/` live there.
