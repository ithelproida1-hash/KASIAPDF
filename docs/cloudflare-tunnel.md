# Cloudflare Tunnel for the PDF engine

Goal: let Vercel reach `http://localhost:8080` on the Windows 11 machine without
opening any inbound port. Cloudflare Tunnel creates an outbound-only connection.

Architecture:

```
Vercel server ──HTTPS──► pdf-engine.example.com ──tunnel──► cloudflared (Windows)
                                                              └─► 127.0.0.1:8080
```

Only the hostname you create is routed, and only to the local Stirling port. Nothing
else on the machine is exposed.

## 1. Prerequisites

- A domain managed by Cloudflare (nameservers pointed at Cloudflare).
- Stirling-PDF running locally and passing:
  `Invoke-RestMethod http://localhost:8080/api/v1/info/status`
- Administrator PowerShell for service installation.

## 2. Install cloudflared

```powershell
winget install --id Cloudflare.cloudflared -e
cloudflared --version
```

If `winget` is unavailable, download `cloudflared-windows-amd64.exe` from the official
releases page and rename it to `cloudflared.exe`.

## 3. Authenticate

```powershell
cloudflared tunnel login
```

A browser window opens. Pick the zone (domain). This writes
`%USERPROFILE%\.cloudflared\cert.pem`.

## 4. Create the tunnel

```powershell
cloudflared tunnel create pdf-engine
cloudflared tunnel list
```

Note the tunnel UUID. Credentials are written to
`%USERPROFILE%\.cloudflared\<UUID>.json`. Treat that file as a secret.

## 5. Configure ingress

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: C:\Users\<YOU>\.cloudflared\<TUNNEL-UUID>.json

ingress:
  - hostname: pdf-engine.example.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Notes:

- Use `127.0.0.1`, not a LAN IP, so traffic cannot leave the machine.
- The final catch-all is required; it prevents accidental exposure of other services.
- Do not add a second ingress rule for another local service without a security review.

## 6. Route DNS

```powershell
cloudflared tunnel route dns pdf-engine pdf-engine.example.com
```

This creates a proxied CNAME to `<UUID>.cfargotunnel.com`. Confirm it resolves:

```powershell
Resolve-DnsName pdf-engine.example.com
```

## 7. Run and test

Foreground (good for first run):

```powershell
cloudflared tunnel run pdf-engine
```

From another network (or from the Vercel app), test:

```powershell
Invoke-RestMethod https://pdf-engine.example.com/api/v1/info/status | ConvertTo-Json
```

If login is enabled, include the key:

```powershell
Invoke-RestMethod https://pdf-engine.example.com/api/v1/info/status `
  -Headers @{ "X-API-KEY" = "<key>" } | ConvertTo-Json
```

Expected: the same JSON you get locally. A Cloudflare HTML login page means Access is
enabled and you have not supplied a service token yet.

## 8. Protect the endpoint with Cloudflare Access (recommended)

Without protection, anyone who learns the hostname can use your engine.

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**.
2. Application domain: `pdf-engine.example.com` (path can stay empty).
3. Policy:
   - Action: **Service Auth**
   - Include: **Service Token** → create one (e.g. `vercel-pdf-app`).
4. Copy the **Client ID** and **Client Secret** once. Cloudflare will not show the
   secret again.
5. In Vercel (and `.env.local` when testing through the tunnel), set:

   ```dotenv
   CLOUDFLARE_ACCESS_CLIENT_ID="<client-id>"
   CLOUDFLARE_ACCESS_CLIENT_SECRET="<client-secret>"
   ```

   The app sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` on every engine
   request. Both variables must be set together; the app refuses to start otherwise.

6. Test with the token:

   ```powershell
   Invoke-RestMethod https://pdf-engine.example.com/api/v1/info/status `
     -Headers @{
       "CF-Access-Client-Id"     = "<client-id>"
       "CF-Access-Client-Secret" = "<client-secret>"
     }
   ```

Optional hardening: add a WAF custom rule that blocks requests whose path does not
start with `/api/v1/` (Stirling's web UI is not needed by this app). Keep an exception
for your own admin IP if you want to open the UI for maintenance.

## 9. Run as a Windows service

Stop any foreground `cloudflared` process first (Ctrl+C), then in an elevated shell:

```powershell
cloudflared --config "$env:USERPROFILE\.cloudflared\config.yml" service install
Get-Service cloudflared
Start-Service cloudflared
```

The service starts automatically at boot. Useful commands:

```powershell
Restart-Service cloudflared
Stop-Service cloudflared
Get-Service cloudflared | Select-Object Status, StartType
```

Check logs in **Event Viewer → Windows Logs → Application** (source `cloudflared`). If
the service cannot find the config, confirm the file is exactly at
`%USERPROFILE%\.cloudflared\config.yml` for the account that runs the service, or pass
`--config` explicitly during install.

To remove the service:

```powershell
Stop-Service cloudflared
cloudflared service uninstall
```

## 10. Stopping, restarting and rotating

- Temporary stop: `Stop-Service cloudflared` (engine stays local-only and unreachable
  from Vercel).
- Restart after a config change: `Restart-Service cloudflared`.
- Rotate the Access secret: create a new service token, update Vercel env vars,
  redeploy, then delete the old token.
- Rotate tunnel credentials: `cloudflared tunnel rotate <UUID>` (Cloudflare docs) and
  update the credentials file reference.
- If the tunnel is deleted, recreate it, update DNS and the UUID in `config.yml`.

## 11. Troubleshooting

| Symptom                                   | Likely cause / fix                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `1033` / `502` from Cloudflare            | `cloudflared` is not running, or ingress points to the wrong port                                         |
| `530`                                     | DNS route missing; re-run `cloudflared tunnel route dns`                                                  |
| Cloudflare Access login page from the app | Service token missing or wrong; set both env vars and redeploy                                            |
| Works locally, fails from Vercel          | Vercel env var still points at localhost, or deployment predates the env change                           |
| Intermittent 502 under load               | Windows sleep/network drop; disable sleep on the PDF machine and set the service to restart automatically |
| Certificate errors                        | System clock wrong, or TLS inspection on the network                                                      |
| Tunnel works, Stirling returns 401        | `STIRLING_PDF_API_KEY` missing or wrong                                                                   |

Keep `%USERPROFILE%\.cloudflared\cert.pem`, the tunnel JSON and Access secrets out of
source control and tickets.
