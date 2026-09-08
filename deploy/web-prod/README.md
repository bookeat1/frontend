# Desktop site (apps/web) in production — runbook

Host: **213.155.20.76** (the production VPS that already serves
`backend.book-eat.com` and `admin.book-eat.com`). Pipeline:
`.github/workflows/deploy-web-prod.yml`, files in this directory. Layout on
the host: `/opt/bookeat/web/{docker-compose.yml,current,releases/,bin/}` —
the same release/symlink scheme as the admin panel (`/opt/bookeat/admin`) and
the stand (`/opt/bookeat/web-preview`).

The pipeline never touches DNS or the Caddy config. Those are the go-live
steps below and need Damir's explicit go-ahead.

## 0. One-time prerequisites

GitHub → `bookeat1/frontend` → Settings → Secrets and variables → Actions:

| Secret | Status (2026-09-07) | Value |
|---|---|---|
| `SSH_PRIVATE_KEY` | exists (used by the stand) | must be authorised for `ubuntu@213.155.20.76` too |
| `SSH_KNOWN_HOSTS` | exists (stand host only) | **append** the production host key: `ssh-keyscan -t ed25519 213.155.20.76` |
| `PROD_SSH_HOST` | **missing** | `213.155.20.76` |
| `PROD_SSH_USER` | **missing** | `ubuntu` |

On the host, as `ubuntu` (needs sudo once, `/opt/bookeat` is root-owned):

```bash
sudo mkdir -p /opt/bookeat/web && sudo chown ubuntu:ubuntu /opt/bookeat/web
docker network inspect deploy_default >/dev/null   # must exist (backend stack up)
```

## 1. First release (safe before DNS moves)

Actions → "Deploy desktop site (prod)" → Run workflow → branch `develop`
(or a tag), `confirm` = `deploy-to-prod`, `public_url_live` = unchecked.

What it does: CI checks → Next standalone build with
`NEXT_PUBLIC_API_URL=https://backend.book-eat.com/api/v1`, no basePath,
`NEXT_PUBLIC_SITE_URL=https://book-eat.com`, indexing on → rsync to
`/opt/bookeat/web/releases/.incoming-<rel>` → `bin/release.sh <rel>` swaps the
symlink and recreates `webprod-web-prod-1` → verification **from inside the
container** (`/`, `/venues`, `/sitemap.xml`, `/robots.txt`, `release.txt`) and
that `backend.book-eat.com/health` + `admin.book-eat.com/release.txt` still
answer → automatic rollback if anything fails after the swap.

Nothing is reachable from the internet at this point: the container has no
published port and Caddy has no site block for it.

Optional smoke test from the host, before exposing anything:

```bash
docker exec webprod-web-prod-1 wget -q -O - http://127.0.0.1:3100/release.txt
docker exec webprod-web-prod-1 wget -q -O - http://127.0.0.1:3100/robots.txt
docker exec webprod-web-prod-1 wget -q -O - http://127.0.0.1:3100/sitemap.xml | head -c 600
```

## 2. Cutover (manual, Damir's go-ahead)

Today `book-eat.com` is a Lovable landing page behind Cloudflare
(A → 185.158.133.1). Order matters: Caddy first, DNS second, so the origin is
ready before traffic arrives.

1. **Caddy** on 213.155.20.76 — merge `caddy-book-eat.com.snippet` into
   `/opt/bookeat/deploy/Caddyfile` **through the existing inode**
   (`cat new > Caddyfile`, never `sed -i`), then:

   ```bash
   cp /opt/bookeat/deploy/Caddyfile /opt/bookeat/deploy/Caddyfile.bak-pre-web-$(date +%Y%m%d-%H%M%S)
   # ...write the merged file...
   docker exec deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec deploy-caddy-1 caddy reload   --config /etc/caddy/Caddyfile
   curl -sS -o /dev/null -w '%{http_code}\n' https://backend.book-eat.com/health   # still 200
   ```

   Until DNS points here Caddy will log ACME failures for `book-eat.com`
   and keep retrying — expected, harmless to the other hostnames.
   The same block must land in `bookeat1/backend` `deploy/Caddyfile`, or the
   next backend deploy overwrites it.

2. **DNS** in Cloudflare for `book-eat.com` and `www`: A → `213.155.20.76`.
   Recommended for the first pass: **DNS only (grey cloud)** so Caddy gets a
   Let's Encrypt certificate directly via HTTP-01/TLS-ALPN. Keeping the
   orange cloud requires SSL mode *Full (strict)* + a Cloudflare Origin CA
   certificate installed in Caddy — a separate, larger change.
   TTL low (300 s) before the switch.

3. **Verify**: re-run the workflow with `public_url_live` **checked** (no
   new build is needed, but it is the cheapest way to run the full public
   check), or by hand:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://book-eat.com/
   curl -sS https://book-eat.com/release.txt | head -1     # == the release name
   curl -sS https://book-eat.com/robots.txt               # Allow: /, Sitemap: ...
   curl -sS -o /dev/null -w '%{http_code}\n' https://book-eat.com/sitemap.xml
   curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.book-eat.com/
   ```

   Then Google Search Console: add the property, submit
   `https://book-eat.com/sitemap.xml`.

4. Follow-up commit: flip the default of `public_url_live` to `true` in
   `deploy-web-prod.yml` so every later deploy verifies the public domain.

## 3. Rollback

Release (symlink + container, seconds, no Caddy reload):

```bash
ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.76 '/opt/bookeat/web/bin/rollback.sh'
```

Cutover: Cloudflare A record back to `185.158.133.1` (the Lovable page
keeps existing until it is deliberately deleted), then
`cp Caddyfile.bak-pre-web-<stamp> Caddyfile` through the inode and
`caddy reload`.

## 4. Known limits / next steps

- Sitemap covers static pages, venues (+menu), upcoming events and articles.
  Promos and guide routes are per-city in the API and are not listed yet.
- No GitHub Environment protection yet: the only gate is the typed
  `deploy-to-prod` confirmation (same convention as the backend). Adding a
  required reviewer on the `production` environment is a Settings change.
- Container runs as the image default user (parity with the stand). Moving
  to `user: "1000:1000"` is a hardening follow-up to test on the stand first.
- Mobile web (ADR-046) plugs into the reserved block in the Caddy snippet.
