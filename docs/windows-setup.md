# Windows 11 PDF server setup (Stirling-PDF)

This guide sets up the processing engine on the Windows 11 machine and connects it to
the Next.js app. Commands are PowerShell.

> Security baseline: do **not** create an inbound firewall rule for port 8080 and do
> **not** forward ports on the router. Remote access goes through Cloudflare Tunnel
> only (see [cloudflare-tunnel.md](cloudflare-tunnel.md)).

## 1. Choose an install method

Two supported options. Use whichever fits the machine; Docker is the easiest to keep
updated.

| Method         | Best for                                  | Requires                      |
| -------------- | ----------------------------------------- | ----------------------------- |
| Docker Desktop | Most machines; reproducible upgrades      | WSL2 + virtualization enabled |
| Portable JAR   | Machines where Docker/WSL2 is unavailable | A supported JDK (21+)         |

### Option A — Docker Desktop

1. Install Docker Desktop (reboot if prompted):

   ```powershell
   winget install --id Docker.DockerDesktop -e
   ```

2. Start Docker Desktop and wait until it reports "Engine running". Verify:

   ```powershell
   docker version
   docker run --rm hello-world
   ```

3. Create persistent folders:

   ```powershell
   New-Item -ItemType Directory -Force C:\StirlingPDF\trainingData, C:\StirlingPDF\extraConfigs, C:\StirlingPDF\logs | Out-Null
   ```

4. Start Stirling-PDF, bound to localhost only:

   ```powershell
   docker run -d --name stirling-pdf --restart unless-stopped `
     -p 127.0.0.1:8080:8080 `
     -v "C:\StirlingPDF\trainingData:/usr/share/tessdata" `
     -v "C:\StirlingPDF\extraConfigs:/configs" `
     -v "C:\StirlingPDF\logs:/logs" `
     -e DOCKER_ENABLE_SECURITY=false `
     stirlingtools/stirling-pdf:latest
   ```

   `-p 127.0.0.1:8080:8080` is deliberate: only the local machine (and therefore the
   local tunnel) can reach the engine.

   Check status and logs:

   ```powershell
   docker ps --filter name=stirling-pdf
   docker logs -f stirling-pdf
   ```

   Upgrades:

   ```powershell
   docker pull stirlingtools/stirling-pdf:latest
   docker stop stirling-pdf
   docker rm stirling-pdf
   # re-run the docker run command above
   ```

### Option B — Portable JAR (no Docker)

1. Install a current JDK (Stirling requires a modern LTS JDK; check the release
   notes for the exact minimum):

   ```powershell
   winget install --id EclipseAdoptium.Temurin.21.JDK -e
   java -version
   ```

2. Download the latest `Stirling-PDF.jar` from the official releases page:
   <https://github.com/Stirling-Tools/Stirling-PDF/releases>. If the release offers a
   Windows installer, you may use it instead; the JAR remains the fallback.

3. Run it from a dedicated folder so its data stays together:

   ```powershell
   New-Item -ItemType Directory -Force C:\StirlingPDF | Out-Null
   Set-Location C:\StirlingPDF
   java -jar .\Stirling-PDF.jar
   ```

4. Keep it running after logout with Task Scheduler:

   - Create Task → "Run whether user is logged on or not"
   - Trigger: "At startup"
   - Action: start `javaw.exe` with arguments `-jar C:\StirlingPDF\Stirling-PDF.jar`
   - Start in: `C:\StirlingPDF`

   (`javaw.exe` avoids a console window; use `java.exe` while testing so you can see
   logs.)

## 2. Verify the engine locally

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/info/status | ConvertTo-Json
```

Expected: a JSON object with a `status` field. If this fails, stop here and fix the
engine before touching the Next.js app.

Useful checks:

```powershell
# Port listening?
Get-NetTCPConnection -LocalPort 8080 -State Listen

# Swagger UI (interactive docs for the installed version)
Start-Process http://localhost:8080/swagger-ui/index.html

# OpenAPI JSON (use this to confirm endpoints after upgrades)
Invoke-WebRequest http://localhost:8080/v1/api-docs -UseBasicParsing |
  Select-Object -ExpandProperty StatusCode
```

The six endpoints used by Phase 1 are listed in
[`lib/stirling/endpoints.ts`](../lib/stirling/endpoints.ts). Re-verify them against
your installed version before upgrading.

## 3. Optional: enable API key authentication

If the engine will be reachable through a tunnel, add authentication. With Docker,
set security variables in the `docker run` command (or a compose file):

```powershell
-e DOCKER_ENABLE_SECURITY=true -e SECURITY_ENABLELOGIN=true
```

Then:

1. Open http://localhost:8080 and complete the first-run admin account.
2. Create an API key in the account/API settings.
3. Put it in the app's server environment as `STIRLING_PDF_API_KEY`. The client sends
   it as `X-API-KEY`.

Do not put the key in a `NEXT_PUBLIC_` variable, in client code, or in the repository.

If you protect the tunnel with Cloudflare Access instead, see
[cloudflare-tunnel.md](cloudflare-tunnel.md) and configure the service token pair.

## 4. Persistent data

- Docker: the three volume mounts above keep OCR data, configuration and logs across
  container recreation.
- JAR: keep the working directory (`C:\StirlingPDF`) backed up; configuration and
  tessdata live alongside the JAR or in its configured directories.

Phase 1 sends no files for long-term storage. Stirling may use its own temporary
working directory while processing; clear it if disk usage grows (see Stirling's
documentation for `system.tempFileManagement`).

## 5. Windows Firewall

No inbound rule is needed. Cloudflare Tunnel makes an outbound connection.

```powershell
# Confirm nothing is listening publicly (should show 127.0.0.1 / ::1 only)
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

If a previous step created a public rule, remove it:

```powershell
Get-NetFirewallRule -DisplayName "*Stirling*" | Remove-NetFirewallRule
```

Outbound HTTPS (443) must be allowed for the tunnel; Windows allows this by default.

## 6. Connect the app locally

In the app repository on the same machine:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Set:

```dotenv
STIRLING_PDF_URL="http://localhost:8080"
# STIRLING_PDF_API_KEY="..."   # only if engine login is enabled
```

Then:

```powershell
corepack pnpm dev
```

Open <http://localhost:3000/admin>. The engine should show **connected**. If it shows
disconnected, check the app terminal for a redacted `STIRLING_UNAVAILABLE` log line.

## 7. Expose it to Vercel

1. Follow [cloudflare-tunnel.md](cloudflare-tunnel.md) to create the hostname.
2. In Vercel, set `STIRLING_PDF_URL` to the tunnel hostname (Production and Preview).
3. Add the API key / Access service token if configured.
4. Redeploy or trigger a new deployment so the env vars apply.
5. Check `https://<your-app>/api/health` returns `200` with `"stirling": "healthy"`.

## 8. Troubleshooting

| Symptom                                   | Check                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `Invoke-RestMethod` cannot connect        | `docker ps`, `docker logs stirling-pdf`, or the JAR console; confirm port 8080      |
| App health is `503`, engine is up locally | `STIRLING_PDF_URL` value, trailing slash, tunnel status                             |
| `STIRLING_UNAUTHORIZED` in app logs       | API key mismatch, or Access token missing/expired                                   |
| `STIRLING_TIMEOUT`                        | Large file or slow machine; raise `STIRLING_TIMEOUT_MS` (keep below Vercel's limit) |
| Tunnel URL returns 502/1033               | `cloudflared` not running or ingress points at the wrong port                       |
| Tunnel URL returns Cloudflare login page  | Access is on; the app needs a service token                                         |
| Docker volume errors on Windows           | Enable file sharing for `C:` in Docker Desktop settings                             |
| Engine works but OCR fails                | Missing tessdata volume/permissions; re-create `C:\StirlingPDF\trainingData`        |

Never paste API keys, tunnel tokens or document contents into chat tools or tickets.
