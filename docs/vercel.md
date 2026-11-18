# Vercel deployment

The Next.js app is the public/internal frontend. It calls the Windows-hosted
Stirling-PDF engine through the Cloudflare Tunnel; the engine is never deployed to
Vercel.

## 0. Read this first: request body size on Vercel

Vercel Functions have a **request body limit of about 4.5 MB**, and the limit applies
before the route handler runs. The app's defaults (100 MB per file, 250 MB total) are
intended for local/self-hosted use. On Vercel:

- Uploads larger than roughly 4 MB (including multipart overhead) will be rejected by
  the platform, not by the app.
- For a Vercel-only Phase 1, set conservative limits in the project environment:

  ```dotenv
  MAX_FILE_SIZE_MB="4"
  MAX_TOTAL_UPLOAD_MB="4"
  ```

- Supporting large PDFs on Vercel requires Phase 2's direct-to-storage upload or a
  streaming/queue design. Do not raise the env limits and expect Vercel to accept the
  body.

If large files are a hard requirement now, host the Next.js server on a VM/container
instead of Vercel; the rest of this guide still applies except the platform limit.

## 1. Put the project on GitHub

The repository is not initialised yet. From the project folder:

```powershell
git init
git add .
git commit -m "feat: phase 1 PDF platform"
git branch -M main
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

Before pushing, confirm `.env.local`, tunnel credentials and service tokens are not
staged:

```powershell
git status --short
git check-ignore -v .env.local
```

`.gitignore` already excludes `.env*.local`, `*.pem`, `*.key`, `credentials.json`,
`.next`, `test-results` and dependency folders.

## 2. Create the Vercel project

Dashboard route:

1. <https://vercel.com/new> → **Import Git Repository** → select the repo.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory: repository root.
4. Build settings (defaults are correct):
   - Install command: `pnpm install`
   - Build command: `pnpm build`
   - Output: `.next` (managed by Next.js)
   - Node.js version: 22.x (20.9+ is the minimum)
5. Deploy. The first build runs without engine connectivity; that is expected.

CLI alternative:

```powershell
npm i -g vercel
vercel link
vercel env add STIRLING_PDF_URL production
vercel --prod
```

## 3. Environment variables

Set these for **Production** and **Preview** (Preview may point at a staging tunnel):

| Name                              | Example                          | Notes                                |
| --------------------------------- | -------------------------------- | ------------------------------------ |
| `STIRLING_PDF_URL`                | `https://pdf-engine.example.com` | Tunnel hostname, no trailing slash   |
| `STIRLING_PDF_API_KEY`            | `…`                              | Only if Stirling login is enabled    |
| `CLOUDFLARE_ACCESS_CLIENT_ID`     | `….access`                       | Only if Access protects the tunnel   |
| `CLOUDFLARE_ACCESS_CLIENT_SECRET` | `…`                              | Must be set with the ID              |
| `MAX_FILE_SIZE_MB`                | `4`                              | See the body-size warning above      |
| `MAX_TOTAL_UPLOAD_MB`             | `4`                              | Must be >= `MAX_FILE_SIZE_MB`        |
| `MAX_FILES_PER_JOB`               | `10`                             |                                      |
| `RATE_LIMIT_PER_MINUTE`           | `30`                             | Per instance                         |
| `STIRLING_TIMEOUT_MS`             | `120000`                         | Keep below the function duration cap |
| `STIRLING_HEALTH_TIMEOUT_MS`      | `4000`                           |                                      |
| `NEXT_PUBLIC_APP_NAME`            | `Company PDF Tools`              | Public; no secrets                   |

Rules:

- Never prefix secrets with `NEXT_PUBLIC_`.
- Changing env vars requires a new deployment (or redeploy) to take effect.
- Use different Access service tokens for Production and Preview so one can be
  revoked independently.

## 4. Function duration

`app/api/pdf/[tool]/route.ts` sets `export const maxDuration = 300`. The effective cap
depends on your Vercel plan; lower plans may clamp it or warn at build time. Keep
`STIRLING_TIMEOUT_MS` safely below the effective limit so the app returns a clean
`STIRLING_TIMEOUT` (504) instead of the platform killing the request.

Large or slow jobs should move to Stirling's async job API in Phase 2 rather than
raising timeouts further.

## 5. Domain

1. Vercel project → **Settings → Domains → Add**.
2. If the domain is on Cloudflare, create the record Vercel shows:
   - Preferred: `CNAME` to `cname.vercel-dns.com`
   - Apex: use Vercel's provided A/AAAA records or Cloudflare's CNAME flattening
3. Set the Cloudflare proxy status to **DNS only** (grey cloud) unless you have a
   specific reason to proxy; double-proxying complicates TLS and debugging.
4. Wait for "Valid Configuration" and the automatic certificate.

The app domain and the engine tunnel hostname should be different hostnames, ideally
on different subdomains.

## 6. Tunnel configuration

Complete [cloudflare-tunnel.md](cloudflare-tunnel.md) first, then:

1. Set `STIRLING_PDF_URL` to `https://pdf-engine.example.com`.
2. Add the Access service token pair if Access is enabled.
3. Redeploy.
4. Open `https://<your-app-domain>/api/health`.

Healthy response (`200`):

```json
{
  "status": "ok",
  "services": { "app": "healthy", "stirling": "healthy", "database": "not_configured" },
  "limits": { "maxFileSizeMb": 4, "maxFilesPerJob": 10, "maxTotalUploadMb": 4 }
}
```

`503` with `"stirling": "unreachable"` means the app is fine but the tunnel/engine is
not. Check the Windows machine first.

## 7. Production testing

Run through this checklist after the first deploy and after any engine/tunnel change:

1. `/dashboard` loads and shows 6 available tools.
2. `/admin` shows the engine as **connected**.
3. Merge two small PDFs (< 2 MB total) and download the result.
4. Split a PDF, compress it and rotate it; confirm each download opens.
5. Convert a JPG to PDF and a PDF to JPG.
6. Upload a `.txt` renamed to `.pdf`; expect a safe `415`/`422` error.
7. Upload a file above the configured limit; expect a clear size error (or the Vercel
   platform rejection described in section 0).
8. Confirm `/api/health` and error responses contain no URLs, keys or filenames.
9. Check **Vercel → Logs** for the request IDs and durations; no document contents
   should appear.

## 8. Operations

- **Logs**: Vercel → Project → Logs (or `vercel logs <deployment>`). Look for
  `STIRLING_UNAVAILABLE`, `STIRLING_TIMEOUT`, `STIRLING_UNAUTHORIZED`.
- **Rollback**: Deployments → select a previous healthy deployment → **Promote**.
- **Redeploy after env changes**: Deployments → ⋯ → **Redeploy**.
- **Cold starts**: the first request after idle is slower; health probes may report a
  transient failure.
- **Rate limiting** is per instance. Add a Vercel WAF rate-limit rule or a shared
  Redis limiter before exposing the app to many users.
- **Outbound IPs are dynamic.** Do not build an IP allowlist; use Cloudflare Access
  service tokens.
- **Secrets**: rotate the Access secret and API key on a schedule and after any
  suspected exposure; update Vercel and redeploy.

## 9. Troubleshooting

| Symptom                               | Check                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Build fails on `tsc`                  | Run `corepack pnpm typecheck` locally; ensure `tests` are included in the repo |
| Build succeeds, all tools 503         | `STIRLING_PDF_URL` wrong, tunnel down, or env var added without redeploy       |
| 502 from the app                      | Engine unauthorized: API key or Access token mismatch                          |
| Cloudflare HTML page in the app       | Access challenge reached the server; service token missing                     |
| `413` with no app log                 | Vercel body limit (section 0)                                                  |
| `504` at ~10–60s                      | Platform duration cap; lower `STIRLING_TIMEOUT_MS` or upgrade/host differently |
| Works in Preview, fails in Production | Env vars or Access token differ between environments                           |
