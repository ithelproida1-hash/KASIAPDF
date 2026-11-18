# Company PDF Tools

A private, company-internal PDF workspace built with Next.js, deployed on Vercel, and
powered by a self-hosted [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)
engine that runs on a Windows 11 machine behind a Cloudflare Tunnel.

The browser never talks to Stirling-PDF. All processing requests go through the
Next.js server, which keeps the engine URL and credentials private.

## Phase 1 scope

Implemented tools:

| Tool         | Route           | Engine endpoint                    |
| ------------ | --------------- | ---------------------------------- |
| Merge PDF    | `/merge-pdf`    | `POST /api/v1/general/merge-pdfs`  |
| Split PDF    | `/split-pdf`    | `POST /api/v1/general/split-pages` |
| Compress PDF | `/compress-pdf` | `POST /api/v1/misc/compress-pdf`   |
| Rotate PDF   | `/rotate-pdf`   | `POST /api/v1/general/rotate-pdf`  |
| JPG to PDF   | `/jpg-to-pdf`   | `POST /api/v1/convert/img/pdf`     |
| PDF to JPG   | `/pdf-to-jpg`   | `POST /api/v1/convert/pdf/img`     |

The other 29 tools listed in the plan appear in the dashboard as **Planned** and are
not routable or callable. Endpoints were verified against the live OpenAPI document
(v3.2.1) at `https://api.stirling.com/v1/api-docs`.

Also included: dashboard with searchable tool catalogue, responsive app shell,
dark/light theme, drag-and-drop uploader with validation, upload progress, safe error
states, health endpoint, admin status page, and a complete test suite.

Not in Phase 1: accounts/SSO, persistent storage (Supabase/R2), background job queue,
OCR/AI tools. Storage is deliberately stateless: files exist in memory only for the
duration of a request.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- pnpm 10+ (`corepack enable`, or run `corepack pnpm ...` as below)
- Stirling-PDF reachable over HTTP(S) — see [docs/windows-setup.md](docs/windows-setup.md)

> **Vercel limit:** Vercel Functions cap request bodies at roughly 4.5 MB. The default
> 100 MB/250 MB limits suit local or self-hosted deployments. On Vercel, set
> `MAX_FILE_SIZE_MB=4` and `MAX_TOTAL_UPLOAD_MB=4`, or wait for Phase 2's
> direct-to-storage uploads. See [docs/vercel.md](docs/vercel.md#0-read-this-first-request-body-size-on-vercel).

## Quick start (Windows PowerShell)

```powershell
corepack pnpm install
Copy-Item .env.example .env.local
# Edit .env.local: set STIRLING_PDF_URL (default http://localhost:8080)
corepack pnpm dev
```

Open http://localhost:3000. If Stirling is offline the app still loads; tool pages
show a friendly "service unavailable" error and `/api/health` returns `503`.

Verify the engine separately:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/info/status
```

## Environment variables

| Variable                                  | Required | Purpose                                                                               |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `STIRLING_PDF_URL`                        | yes      | Server-side engine URL (local or tunnel hostname).                                    |
| `STIRLING_PDF_API_KEY`                    | no       | Sent as `X-API-KEY` when Stirling login is enabled.                                   |
| `CLOUDFLARE_ACCESS_CLIENT_ID` / `_SECRET` | no       | Service token when the tunnel is protected by Cloudflare Access. Set both or neither. |
| `STIRLING_TIMEOUT_MS`                     | no       | Processing timeout, default `120000`.                                                 |
| `STIRLING_HEALTH_TIMEOUT_MS`              | no       | Health probe timeout, default `4000`.                                                 |
| `MAX_FILE_SIZE_MB`                        | no       | Per-file limit, default `100`.                                                        |
| `MAX_FILES_PER_JOB`                       | no       | Default `10`.                                                                         |
| `MAX_TOTAL_UPLOAD_MB`                     | no       | Default `250`; must be >= the per-file limit.                                         |
| `RATE_LIMIT_PER_MINUTE`                   | no       | Default `30` per client per instance.                                                 |
| `NEXT_PUBLIC_APP_NAME`                    | no       | Display name, default "Company PDF Tools".                                            |

Rules:

- Secrets must **never** be prefixed with `NEXT_PUBLIC_`.
- `.env.local` is git-ignored. Use `.env.example` as the template.
- Invalid values fail fast with an error naming the variable, never printing secrets.

## Scripts

```powershell
corepack pnpm dev         # development server
corepack pnpm build       # production build
corepack pnpm start       # serve the production build
corepack pnpm lint        # ESLint
corepack pnpm typecheck   # tsc --noEmit
corepack pnpm test        # Vitest unit + integration + UI
corepack pnpm test:e2e    # Playwright (installs Chromium on first run)
corepack pnpm format      # Prettier write
corepack pnpm fixtures    # regenerate PDF/PNG/JPEG test fixtures
```

E2E tests run against a dev server on port 3100 and mock the PDF engine at the
network boundary, so no Stirling instance is required.

## Architecture at a glance

```
Browser
  └─ upload + options ──► /api/pdf/[tool]  (Next.js route handler, Node runtime)
                              ├─ size / MIME / magic-byte validation
                              ├─ zod option validation (shared with the UI)
                              ├─ rate limit
                              ├─ StirlingClient ──► Stirling-PDF (tunnel)
                              └─ streamed attachment response
```

- `lib/pdf/tools.ts` is the single registry for tool metadata and availability.
- `lib/pdf/tool-options.ts` declares each form once and validates on both sides.
- `lib/pdf/tool-specs.ts` maps each available tool to its verified engine call.
- One dynamic API route serves all tools; no per-tool copy-paste.
- See [docs/architecture.md](docs/architecture.md) for decisions, error mapping and
  the differences from the plan's suggested folder layout.

## Security posture

- Engine URL/key and Cloudflare Access token live only on the server.
- Uploads are bounded by declared length, actual bytes, count and total size.
- MIME type, extension and magic bytes must agree; PDFs must start with `%PDF-`.
- Filenames are sanitised before they reach the engine or response headers.
- URL-based tools pass through the SSRF guard (allowlist + private-IP blocking).
- Upstream error bodies are never forwarded to the browser.
- Logs are structured and redact URL/path/filename/key/token fields.
- CSP, HSTS (production), `nosniff`, `DENY` framing and a strict referrer policy.
- Rate limiting is in-memory per instance; see `docs/architecture.md` for its limits.

## Documentation

- [Architecture and decisions](docs/architecture.md)
- [Windows 11 + Stirling-PDF setup](docs/windows-setup.md)
- [Cloudflare Tunnel + Access](docs/cloudflare-tunnel.md)
- [Vercel deployment](docs/vercel.md)

## Licensing note

This repository is the company frontend. Stirling-PDF is a separate open-core project
and is **not** forked or modified here. Its core is MIT-licensed, but parts of its
repository (`engine/`, `proprietary/`, `saas/`) have separate licences. Review
Stirling's licensing before redistribution or commercial resale; internal use of the
unmodified container is the intended deployment model.
