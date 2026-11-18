# Architecture and decisions

This document records how Phase 1 is put together, why it differs from the folder
sketch in `Plan.txt`, and what must change before the platform grows.

## 1. System context

```
                    ┌──────────────────────────────┐
   Staff browser ──►│ Next.js on Vercel            │
   (same origin)    │  UI + /api/pdf/[tool]        │
                    └──────────────┬───────────────┘
                                   │ HTTPS + X-API-KEY
                                   │ + optional CF Access service token
                    ┌──────────────▼───────────────┐
                    │ Cloudflare Tunnel            │
                    │ (outbound from Windows 11)   │
                    └──────────────┬───────────────┘
                    ┌──────────────▼───────────────┐
                    │ Stirling-PDF :8080           │
                    │ unmodified official image    │
                    └──────────────────────────────┘
```

- Only the Next.js server knows `STIRLING_PDF_URL`; the browser only calls same-origin
  routes. This satisfies the plan's rule that the browser must not call Stirling.
- The engine stays behind an outbound tunnel. No inbound port forwarding is required.
- **Bounded local archive:** every accepted upload is copied to `storage/uploads`
  (or `UPLOAD_BACKUP_DIR`) before processing, grouped by date. There is no database
  or cloud object storage; processed results are streamed back and not persisted.

## 2. Module map

```
app/
  page.tsx                    redirect / marketing entry
  dashboard/page.tsx          catalogue + search
  <tool>/page.tsx             a page for every available tool
  admin/page.tsx              internal engine/status view
  api/health/route.ts         public coarse health (503 when engine is down)
  api/admin/status/route.ts   detailed, secret-free status
  api/pdf/[tool]/route.ts     the only PDF processing entry point

components/
  layout/                     app shell, sidebar, theme
  dashboard/                  hero, explorer, cards
  pdf/                        tool workspace, uploader, file list, options, results
  ui/                         shadcn-style primitives (Radix + cva)

lib/
  config/env.ts               zod-validated server config, cached
  api/                        browser transport, limits hook, response helpers
  auth/current-user.ts        authentication seam for a future provider
  pdf/tools.ts                tool registry (single source of truth)
  pdf/tool-options.ts         declarative form schema + shared validation
  pdf/tool-specs.ts           tool id → verified engine call
  pdf/compare.ts              line diff and HTML comparison report
  pdf/web-capture.ts          SSRF-safe, DNS-pinned page fetch
  pdf/handler.ts              request orchestration
  storage/upload-archive.ts   dated local backup of accepted uploads
  security/                   validation, SSRF guard, rate limiter
  stirling/                   typed client, endpoints, errors, types
  logging/, metrics.ts        structured logs and process-local counters

scripts/
  generate-fixtures.mjs       real PDF/form/image fixtures
  start-app.ps1               production start (engine + Next.js)
  install-autostart.ps1       registers the sign-in scheduled task
  uninstall-autostart.ps1     removes the scheduled task

tests/
  unit/                       pure modules and handler contracts
  integration/                route handler end-to-end with mocked fetch
  ui/                         React Testing Library
  e2e/                        Playwright against a real Next.js server
  fixtures/                   generated real PDF/PNG/JPEG files
```

The plan suggested one API folder per tool (`api/pdf/merge/route.ts`, etc.). We kept
the public URLs but implemented a single registry-driven route,
`app/api/pdf/[tool]/route.ts`. Separate near-identical handlers would have duplicated
validation, rate limiting and error formatting; the dynamic route keeps that logic in
one place while the registry enforces which slugs are callable. This is the only
intentional deviation from the proposed structure.

## 3. Request lifecycle

1. **Registry check** — unknown or `planned` slugs return `404 TOOL_NOT_AVAILABLE`.
2. **Method check** — anything but `POST` is rejected.
3. **Declared size** — `Content-Length` above `maxTotalUploadBytes` + 1 MiB multipart
   overhead is rejected before parsing.
4. **Multipart parse** — failures become `400 INVALID_INPUT`.
5. **File validation** (`lib/security/validation.ts`):
   - per-file size, count and total size
   - MIME, extension and magic-byte agreement
   - PDF header check (`%PDF-`), image signature checks
   - filename sanitisation and deduplication
6. **Option validation** - the same zod schema the UI uses; safe field-level message.
7. **Rate limit** - fixed window per client IP, shared across tools.
8. **Upload archive** - accepted files are copied to a dated folder under
   `UPLOAD_BACKUP_DIR`. Archive failures are logged and never block processing.
9. **Engine call** - `StirlingClient` posts multipart to the verified endpoint with a
   timeout, `X-API-KEY` (if configured) and Access headers (if configured).
10. **Response** - bytes are returned as an attachment with `no-store`, a sanitised
    ASCII fallback filename and RFC 5987 UTF-8 filename. `X-Request-Id` is returned.
11. **Logging/metrics** - one structured line per request; no filenames, URLs or
    document contents.

Buffers are released when the response is garbage-collected. Only the deliberate
upload archive is written to disk; processed results are streamed back and never
persisted. Stirling itself may spool uploads in its container, which is outside this
app's control (see its temporary-file settings).

## 4. Tool registry

`lib/pdf/tools.ts` holds every tool with category, summary, status and, for available
tools, a verified endpoint. Helpers:

- `getToolBySlug`, `getAvailableTools`, `getPlannedTools`, `getNavigationGroups`
- `hasToolForm` / `getToolForm` gate UI and API alike

Adding a tool is a four-step change:

1. Add/verify the endpoint in `lib/stirling/endpoints.ts`.
2. Flip its registry entry to `status: "available"` with the endpoint.
3. Add a form in `lib/pdf/tool-options.ts`.
4. Add the execution case in `lib/pdf/tool-specs.ts` and a page re-export.

No route file, client transport or response-formatting code needs to change.

## 5. API contract

`POST /api/pdf/{tool}` with `multipart/form-data`:

- `file` — one or more uploads (field is repeated)
- option fields named exactly as in `lib/pdf/tool-options.ts`

Success: binary attachment, `200`, `Content-Disposition`, `X-Request-Id`.

Failure: JSON

```json
{
  "error": {
    "code": "STIRLING_UNAVAILABLE",
    "message": "The PDF processing service is not reachable right now. Please try again in a moment.",
    "requestId": "…",
    "retryable": true
  }
}
```

Status mapping (`lib/errors.ts`):

| Code                    | HTTP | Meaning                                 |
| ----------------------- | ---- | --------------------------------------- |
| `INVALID_INPUT`         | 400  | Bad options or malformed request        |
| `INVALID_PDF`           | 422  | File is not a readable PDF              |
| `UNSUPPORTED_FILE_TYPE` | 415  | MIME/signature mismatch                 |
| `FILE_TOO_LARGE`        | 413  | Per-file or total limit exceeded        |
| `TOO_MANY_FILES`        | 400  | File count limit exceeded               |
| `RATE_LIMITED`          | 429  | Window exhausted; `Retry-After` set     |
| `STIRLING_UNAVAILABLE`  | 503  | Tunnel/engine unreachable               |
| `STIRLING_TIMEOUT`      | 504  | Engine exceeded its timeout             |
| `STIRLING_UNAUTHORIZED` | 502  | Engine rejected our credentials         |
| `STIRLING_REJECTED`     | 422  | Engine refused the operation            |
| `PROCESSING_FAILED`     | 500  | Empty/invalid engine output             |
| `TOOL_NOT_AVAILABLE`    | 404  | Planned or unknown tool                 |
| `UNKNOWN`               | 500  | Unexpected; details stay in server logs |

Upstream response bodies are drained but never parsed into user-visible errors.

## 6. Security decisions

- **SSRF**: `lib/security/ssrf.ts` blocks credentials, non-HTTP(S) schemes, loopback,
  private/link-local/metadata addresses, and requires an allowlist entry when one is
  configured. Web to PDF resolves DNS, validates every address and pins the connection
  to that address before fetching redirects.
- **Tunnel protection**: optional Cloudflare Access service token headers, configured
  with `CLOUDFLARE_ACCESS_CLIENT_ID` / `CLOUDFLARE_ACCESS_CLIENT_SECRET`. Both must be
  present; the config parser rejects half-configured tokens.
- **Headers**: CSP (no third-party origins), HSTS in production, `nosniff`,
  `X-Frame-Options: DENY`, restrictive `Permissions-Policy`, same-origin COOP.
- **Logging**: values under keys containing `url`, `path`, `filename`, `key`, `secret`
  or `token` are redacted. Errors log codes, statuses and durations only.
- **Rate limiting**: process-local fixed window (default 30/min per IP). On Vercel this
  is per warm instance, not global. Acceptable for Phase 1; replace with Upstash/Redis
  or a Vercel WAF rule when real traffic or abuse appears.
- **Auth seam**: `getCurrentUser()` returns a local anonymous user. No feature reads a
  session directly, so SSO can be added without touching tool components.

## 7. Operational constraints

- **Synchronous calls only.** The route declares `maxDuration = 300`. Vercel Hobby
  caps functions at 60s; Pro allows up to 300s. Keep `STIRLING_TIMEOUT_MS` below the
  platform limit. Large jobs should move to Stirling's async job API in Phase 2
  (`/api/v1/general/job/{id}` endpoints are already documented in `endpoints.ts`).
- **No shared state.** Health and metrics are per instance. The admin page is
  therefore a diagnostic snapshot, not a global dashboard.
- **Cold starts** add latency to the first request after idle.
- **Memory**: `request.formData()` buffers the whole upload. The 250 MiB default total
  is within a 1 GiB Vercel function, but keep headroom for multipart overhead.
- **Engine version drift**: endpoints were verified against OpenAPI v3.3.0. Before
  upgrading Stirling, re-check `/v1/api-docs` on the installed instance.

## 8. Testing strategy

- Unit: registry, option schemas, file validation, SSRF, rate limiting, errors,
  Stirling client (headers, timeouts, empty bodies, upstream failures), upload
  archive, env parsing.
- Integration: the real route handler with `fetch` mocked at the engine boundary,
  including rate-limit and empty-response paths.
- UI: upload flow, option changes, success state, error state (jsdom).
- E2E: dashboard search, merge flow, web-to-PDF flow, tool pages, safe error
  rendering (Chromium, network mocked).

The engine itself is never required for tests. Live verification is a manual step:
start Stirling, run `pnpm dev`, upload a sample, and check `/admin` reports
"connected".
