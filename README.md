# Jindal Kasia PDF

A private, Jindal Kasia PDF workspace built with Next.js, deployed on Vercel, and
powered by a self-hosted [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF)
engine that runs on a Windows 11 machine behind a Cloudflare Tunnel.

The browser never talks to Stirling-PDF. All processing requests go through the
Next.js server, which keeps the engine URL and credentials private.

## Implemented tools

Phase 1 (core):

| Tool         | Route           | Engine endpoint                    |
| ------------ | --------------- | ---------------------------------- |
| Merge PDF    | `/merge-pdf`    | `POST /api/v1/general/merge-pdfs`  |
| Split PDF    | `/split-pdf`    | `POST /api/v1/general/split-pages` |
| Compress PDF | `/compress-pdf` | `POST /api/v1/misc/compress-pdf`   |
| Rotate PDF   | `/rotate-pdf`   | `POST /api/v1/general/rotate-pdf`  |
| JPG to PDF   | `/jpg-to-pdf`   | `POST /api/v1/convert/img/pdf`     |
| PDF to JPG   | `/pdf-to-jpg`   | `POST /api/v1/convert/pdf/img`     |

Phase 2 (organise, convert, edit and secure) adds:

| Tool                  | Route                    | Engine endpoint                       |
| --------------------- | ------------------------ | ------------------------------------- |
| Remove Pages          | `/remove-pages`          | `POST /api/v1/general/remove-pages`   |
| Extract Pages         | `/extract-pages`         | `POST /api/v1/general/rearrange-pages` |
| Organize PDF          | `/organize-pdf`          | `POST /api/v1/general/rearrange-pages` |
| PDF to Word           | `/pdf-to-word`           | `POST /api/v1/convert/pdf/word`       |
| PDF to PowerPoint     | `/pdf-to-powerpoint`     | `POST /api/v1/convert/pdf/presentation` |
| PDF to Excel          | `/pdf-to-excel`          | `POST /api/v1/convert/pdf/xlsx`       |
| Word to PDF           | `/word-to-pdf`           | `POST /api/v1/convert/file/pdf`       |
| PowerPoint to PDF     | `/powerpoint-to-pdf`     | `POST /api/v1/convert/file/pdf`       |
| Excel to PDF          | `/excel-to-pdf`          | `POST /api/v1/convert/file/pdf`       |
| HTML to PDF           | `/html-to-pdf`           | `POST /api/v1/convert/html/pdf`       |
| PDF to PDF/A          | `/pdf-to-pdfa`           | `POST /api/v1/convert/pdf/pdfa`       |
| Watermark PDF         | `/watermark-pdf`         | `POST /api/v1/security/add-watermark` |
| Page Numbers          | `/page-numbers`          | `POST /api/v1/misc/add-page-numbers`  |
| Crop PDF              | `/crop-pdf`              | `POST /api/v1/general/crop`           |
| Unlock PDF            | `/unlock-pdf`            | `POST /api/v1/security/remove-password` |
| Protect PDF           | `/protect-pdf`           | `POST /api/v1/security/add-password`  |
| OCR PDF               | `/ocr-pdf`               | `POST /api/v1/misc/ocr-pdf`           |
| Repair PDF            | `/repair-pdf`            | `POST /api/v1/misc/repair`            |
| Redact PDF            | `/redact-pdf`            | `POST /api/v1/security/auto-redact`   |

PDF to Word runs OCR on scanned pages by default, skipping pages that already
contain text. You can turn OCR off or select another supported language in the
tool options.

Phase 3 (edit, forms, signing and automation) adds:

| Tool                  | Route                    | Engine endpoint                          |
| --------------------- | ------------------------ | ---------------------------------------- |
| Edit PDF              | `/edit-pdf`              | `POST /api/v1/misc/add-stamp`            |
| PDF Forms             | `/pdf-forms`             | `POST /api/v1/form/fill` / `extract-csv` / `extract-xlsx` |
| Sign PDF              | `/sign-pdf`              | `POST /api/v1/misc/add-stamp` / `security/cert-sign` |
| Compare PDF           | `/compare-pdf`           | `POST /api/v1/convert/pdf/text` then `convert/html/pdf` |
| PDF to Markdown       | `/pdf-to-markdown`       | `POST /api/v1/convert/pdf/markdown`      |
| Web to PDF            | `/web-to-pdf`            | App-side fetch then `POST /api/v1/convert/html/pdf` |
| Scan PDF              | `/scan-pdf`              | `POST /api/v1/convert/img/pdf`           |
| Workflows             | `/workflows`             | `POST /api/v1/pipeline/handleData`       |

AI Summarize and Translate remain **Planned**: this Stirling deployment has its AI
features disabled, so those buttons are not routable or callable. Endpoints were
verified against the installed OpenAPI document (v3.3.0).

Also included: dashboard with searchable tool catalogue, responsive app shell,
dark/light theme, drag-and-drop uploader with validation, upload progress, safe error
states, health endpoint, admin status page, and a complete test suite.

Not implemented: accounts/SSO, cloud storage (Supabase/R2), background job queue, AI
features. Every accepted upload is archived to a local backup folder before
processing (see `UPLOAD_BACKUP_DIR`); processed results are still streamed back and
never persisted by the app.

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
| `UPLOAD_BACKUP_DIR`                       | no       | Folder for the local upload backup. Default `storage/uploads`; set `off` to disable.   |
| `NEXT_PUBLIC_APP_NAME`                    | no       | Display name, default "Jindal Kasia PDF".                                             |

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

## Start automatically with Windows

The app and engine can start at sign-in through a Task Scheduler task:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1 -StartNow
```

The task starts Docker Desktop when needed, ensures the `stirling-pdf` container is
running, builds the production bundle once, then serves `next start` on port 3000.
Logs are written to `logs/app.log`. See [docs/autostart.md](docs/autostart.md) for
details and removal instructions.

## Architecture at a glance

```
Browser
  └─ upload + options ──► /api/pdf/[tool]  (Next.js route handler, Node runtime)
                              ├─ size / MIME / magic-byte validation
                              ├─ zod option validation (shared with the UI)
                              ├─ rate limit
                              ├─ local upload backup (UPLOAD_BACKUP_DIR)
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
- URL-based tools pass through the SSRF guard (allowlist + private-IP blocking). Web
  to PDF pins DNS to the validated address so redirects cannot rebind to an internal
  host.
- Accepted uploads are archived locally under `UPLOAD_BACKUP_DIR`; protect that folder
  with filesystem permissions and back it up as you would any company document store.
- Upstream error bodies are never forwarded to the browser.
- Logs are structured and redact URL/path/filename/key/token fields.
- CSP, HSTS (production), `nosniff`, `DENY` framing and a strict referrer policy.
- Rate limiting is in-memory per instance; see `docs/architecture.md` for its limits.

## Documentation

- [Architecture and decisions](docs/architecture.md)
- [Windows 11 + Stirling-PDF setup](docs/windows-setup.md)
- [Windows auto-start](docs/autostart.md)
- [Cloudflare Tunnel + Access](docs/cloudflare-tunnel.md)
- [Vercel deployment](docs/vercel.md)

## Licensing note

This repository is the company frontend. Stirling-PDF is a separate open-core project
and is **not** forked or modified here. Its core is MIT-licensed, but parts of its
repository (`engine/`, `proprietary/`, `saas/`) have separate licences. Review
Stirling's licensing before redistribution or commercial resale; internal use of the
unmodified container is the intended deployment model.
