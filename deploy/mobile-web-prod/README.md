# Mobile web in production — runbook

The mobile half of `book-eat.com`: the Expo web export of `apps/mobile`
(`expo export --platform web`), served to mobile User-Agents by the edge Caddy
of the backend stack (ADR-046). The desktop half is `apps/web`
(`deploy/web-prod/`), the test slot is `/preview` on the stand
(`deploy/mobile-web/`).

| | |
|---|---|
| Pipeline | `.github/workflows/deploy-mobile-web-prod.yml`, on every push to `main` |
| Host | production, `PROD_SSH_HOST` (same box as the API, the panel and the desktop site) |
| Root | `/opt/bookeat/mobile-web` |
| Live release | `/opt/bookeat/mobile-web/current` → relative symlink to `releases/<release>` |
| Releases | `releases/<yyyymmdd-hhmmss>-<sha7>/`, newest 5 kept, ~20 MB each |
| Container | `mobileprod-web-mobile-1`, compose project `mobileprod`, `caddy:2.9-alpine`, no published port, joins `deploy_default` |
| Upstream name | `web-mobile:3200` (what the edge Caddy proxies to) |
| Routing | `deploy/web-prod/caddy-book-eat.com.snippet` — a reference copy of the live, hand-edited `/opt/bookeat/deploy/Caddyfile` |
| Proof of a swap | `curl -A '<phone UA>' https://book-eat.com/release.txt` |

## The one thing that bites everybody

`book-eat.com` answers **from a different origin depending on the
User-Agent**. A plain `curl https://book-eat.com/release.txt` reports the
DESKTOP release and says nothing about this deploy. Every check — by hand, in
CI, in an alert — must send a phone UA:

```sh
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
curl -s -A "$UA" https://book-eat.com/release.txt   # mobile origin
curl -s           https://book-eat.com/release.txt   # desktop origin
```

Cookie `bookeat_view=mobile` forces the mobile origin from a desktop browser,
`bookeat_view=desktop` the other way; crawlers always get the desktop app.

## Deploy

Merging `develop` into `main` is the release decision and deploys by itself.
A manual re-run (re-release the same SHA after an incident): Actions → *Deploy
mobile web (prod)* → *Run workflow* from `main`, confirm field
`deploy-to-prod`. Any other ref is refused by the `gate` job before the build
starts.

The workflow: CI (typecheck, lint, tests, `check:eas`) → export with `--clear`
→ assert the bundle is a production bundle (root base URL, production API URL
present, test API URL absent, production Amplitude key present) → rsync into
`releases/.incoming-<release>` → `bin/mobile-release.sh` validates the upload
again, swaps `current` with one `rename(2)` and proves the container serves
this release from the inside → public verification as a phone, plus the
desktop origin, Googlebot, the API and the panel → automatic rollback if any
of that fails.

No downtime: the static server resolves `current` per request, so a release
swap needs no restart and no Caddy reload.

## Rollback

```sh
ssh -i ~/.ssh/bookeat_deploy ubuntu@<prod host> \
  '/opt/bookeat/mobile-web/bin/mobile-rollback.sh'
# or to a named release:
ssh -i ~/.ssh/bookeat_deploy ubuntu@<prod host> \
  'ls /opt/bookeat/mobile-web/releases'
ssh -i ~/.ssh/bookeat_deploy ubuntu@<prod host> \
  '/opt/bookeat/mobile-web/bin/mobile-rollback.sh <release>'
```

One symlink move, seconds, no rebuild and no upload. The release you left
becomes the new rollback target, so running it twice returns you to where you
started. `releases/.history` is the log of every swap (time, release, actor).
The desktop site, the panel and the API are not touched by either direction.

## Verify the screens, not just the status codes

The SPA answers `200` for every path (`try_files {path} /index.html`), so an
HTTP check cannot tell a real screen from expo-router's "Unmatched Route".
After a deploy that adds or renames a route, render it:

```sh
shot --ua "$UA" --width 390 --height 844 --wait-ms 4000 \
  https://book-eat.com/guide /tmp/guide.png
```

Compare against the same screen on the stand
(`https://test.backend.book-eat.com/preview/guide`).

## History

* 2026-09-08 — cutover: the tree, the container and the UA split were created
  by hand; the first release was uploaded by hand.
* 2026-09-12 — this pipeline. Before it, merging into `main` deployed only
  `apps/web`: `book-eat.com/guide` answered "Unmatched Route" on a phone for
  four days after the alias route landed in `main`, while the desktop half of
  the same domain was current. Nothing reported it — hence the phone-UA
  verification above, and no path filter on the trigger.
