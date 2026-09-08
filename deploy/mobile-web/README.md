# Mobile web (Expo export of apps/mobile) on the test server

Pipeline: `.github/workflows/deploy-mobile-web-test.yml` — push to `develop`
touching `apps/mobile/**`, `packages/**`, `pnpm-lock.yaml`, this directory or
the workflow itself; or `workflow_dispatch`.

| What | Where |
|---|---|
| URL | `https://test.backend.book-eat.com/preview/` (base URL `/preview`, ADR-046) |
| Host | test only, `213.155.20.122` (`TEST_SSH_HOST`); prod is unreachable from the workflow |
| Live release | `/opt/bookeat/preview/mobile-preview` → symlink to `mobile-releases/<release>` |
| Releases | `/opt/bookeat/preview/mobile-releases/<yyyymmdd-hhmmss>-<sha7>/`, newest 5 kept |
| Scripts on the server | `/opt/bookeat/preview/bin/mobile-release.sh`, `mobile-rollback.sh` (copied on every deploy) |
| Caddy | `bookeat1/backend` `deploy/Caddyfile`: `handle_path /preview* { root * /srv/preview/mobile-preview ... }` |
| Proof of the swap | `https://test.backend.book-eat.com/preview/release.txt` = release name + full sha |

Caddy sees `/opt/bookeat/preview` as `/srv/preview` (read-only bind mount). The
workflow never touches Caddy; moving the symlink is enough.

## First run (one-off, in this order)

1. Merge bookeat1/backend PR #123, which points Caddy's `/preview` root at
   `/srv/preview/mobile-preview`, and apply it on test by hand (the backend
   deploy does not copy the Caddyfile):
   ```sh
   ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.122
   cd /opt/bookeat/deploy
   cp Caddyfile Caddyfile.bak.pre-mobile-preview-$(date -u +%Y%m%d-%H%M%S)
   # bring deploy/Caddyfile from bookeat1/backend develop here, then:
   docker exec deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec deploy-caddy-1 caddy reload   --config /etc/caddy/Caddyfile
   ```
   From this moment `/preview` answers 404 until step 2 lands (the old
   hand-copied build from 2026-07-23 is no longer looked at).
   Rollback of this step: `cp Caddyfile.bak.pre-mobile-preview-<stamp> Caddyfile`
   and `caddy reload` again.
2. Run the workflow (`workflow_dispatch` on `develop`, or merge the frontend
   PR — it touches `deploy/mobile-web/**`, which triggers it). The verify step
   must print the new release name from `/preview/release.txt`.
   If the frontend PR is merged before step 1, the run goes red at "Verify"
   (Caddy still serves the old root, `release.txt` is missing); nothing is
   broken, re-run it after step 1.
3. Manual smoke, the gate from the mobile-web spec that CI does not run yet:
   ```sh
   shot --width 390 --height 844 https://test.backend.book-eat.com/preview/
   # expect "page errors (0)" and a non-empty screenshot; repeat for
   # /search /restaurant/<id> /restaurant/<id>/menu /restaurant/<id>/book
   # /auth/sign-in /bookings /profile /event/<id> /promotion/<id>
   ```
4. Clean up the old loose build at the root of `/opt/bookeat/preview`
   (`index.html`, `_expo/`, `assets/`, `favicon.ico`, `metadata.json`) — only
   after step 2 is green; it is not served any more but it is still there.

## Rollback

```sh
ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.122 '/opt/bookeat/preview/bin/mobile-rollback.sh'
# or an explicit release:
ssh ... '/opt/bookeat/preview/bin/mobile-rollback.sh 20260908-120501-2cf837e'
```

One symlink moves; no Caddy reload, no downtime. The workflow does the same
automatically when its verify step fails after a successful swap.

## What CI asserts

- `expo export --platform web` exits 0;
- `index.html`, `metadata.json` present and non-empty; at least one JS bundle
  > 100 KB under `_expo/static/js/web/`;
- `/preview/_expo/` is referenced from `index.html` (base URL applied) and the
  test API URL is inside the bundle (not the mock repository);
- after the swap: `/preview/` 200, `release.txt` equals this run, the entry
  bundle answers 200 with > 100 KB, `/admin-preview/` and `/health` still 200.

Not asserted: that the app actually boots in a browser. That is step 3 above
until a real e2e job exists.

## Pitfall: a warm Metro cache drops EXPO_PUBLIC_* values

Metro's transform cache does not key on `EXPO_PUBLIC_*` values. Exporting
twice in the same checkout (seen 2026-09-08) gave a second bundle with no API
URL and no Amplitude key — the app then runs on the in-memory mock repository
and still shows "page errors (0)". The hand-copied build that served
`/preview` from 2026-07-23 has exactly that signature (0 occurrences of
`api/v1` in its bundle). Hence `--clear` in the workflow and the "API URL is
inside the bundle" assertion. When building by hand:

```sh
EXPO_PUBLIC_API_URL=https://test.backend.book-eat.com/api/v1 \
EXPO_PUBLIC_OTP_DELIVERY_DISABLED=1 BOOKEAT_WEB_BASE_URL=/preview \
pnpm --filter @bookeat/mobile exec expo export --platform web --output-dir dist-web --clear
grep -c 'test.backend.book-eat.com/api/v1' apps/mobile/dist-web/_expo/static/js/web/index-*.js  # must be > 0
```
