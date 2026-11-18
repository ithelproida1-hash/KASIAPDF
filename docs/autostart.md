# Start Jindal Kasia PDF automatically with Windows

The app and its Stirling-PDF engine can start automatically when you sign in. A
single Task Scheduler task (`JindalKasiaPDF`) runs a hidden PowerShell script that:

1. Starts Docker Desktop if it is not already running.
2. Creates or starts the `stirling-pdf` container and waits for it to become healthy.
3. Builds the production bundle if `.next\BUILD_ID` is missing.
4. Serves the app with `next start` on port 3000.

## Install

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1
```

Add `-StartNow` to start the task immediately after registering it:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1 -StartNow
```

The script runs the production build first when needed, so the first sign-in does not
have to wait for compilation. Task Scheduler restarts the task if the process exits
unexpectedly.

## Verify

```powershell
Get-ScheduledTask -TaskName JindalKasiaPDF | Select-Object TaskName, State
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

Open <http://localhost:3000>. Startup output is appended to `logs\app.log`; the file is
rotated once it exceeds 10 MB.

## Change the port

Edit the action argument, or run the start script directly while testing:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-app.ps1 -Port 3001
```

If you change the port for the scheduled task, update the task action as well.

## Remove

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-autostart.ps1
```

This removes the scheduled task only. Docker Desktop, the `stirling-pdf` container and
`logs\app.log` are left in place.

## Notes

- The task starts at sign-in, so the Windows user account must be signed in. For a
  truly unattended server, use the "Run whether user is logged on or not" option in
  Task Scheduler and store the account password.
- Docker Desktop must be installed at its default location for the automatic launch.
  If Docker runs as a Windows service instead, the script uses the already-running
  engine.
- The archived uploads folder (`UPLOAD_BACKUP_DIR`, default `storage/uploads`) is not
  created until the first successful upload. Exclude or back it up according to your
  company's document-retention policy.
