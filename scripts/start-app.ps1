<#
    Starts the Jindal Kasia PDF stack for unattended use.

    - Starts Docker Desktop when it is not running.
    - Ensures the Stirling-PDF container exists and is running.
    - Builds the Next.js app once, then serves the production build on port 3000.

    This script is designed to run from Windows Task Scheduler at sign-in. It
    keeps running in the foreground (the task is hidden), and Task Scheduler
    restarts it if the process exits unexpectedly.

    Manual use:
        powershell -ExecutionPolicy Bypass -File .\scripts\start-app.ps1
#>

[CmdletBinding()]
param(
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$logDir = Join-Path $appDir "logs"
$logFile = Join-Path $logDir "app.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# PowerShell 5.1 redirects to file as UTF-16 by default; keep the Next.js log
# readable in editors and tail tools.
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

function Write-Log {
    param([string]$Message)

    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    try {
        Add-Content -Path $logFile -Value $line -Encoding UTF8 -ErrorAction Stop
    } catch {
        # The running server keeps the log open for its redirected output. A
        # diagnostic line must never stop the launcher from doing its job.
    }
}

# Keep the log from growing without bound.
if (Test-Path $logFile) {
    try {
        $sizeMb = (Get-Item $logFile).Length / 1MB
        if ($sizeMb -gt 10) {
            Move-Item -Force $logFile (Join-Path $logDir ("app-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss")))
        }
    } catch {
        # Locked by the running server; rotate on the next clean start.
    }
}

function Test-DockerReady {
    try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-ForDocker {
    param([int]$TimeoutSeconds = 300)

    if (Test-DockerReady) { return $true }

    $desktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $desktop) {
        Write-Log "Starting Docker Desktop"
        Start-Process $desktop | Out-Null
    } else {
        Write-Log "Docker Desktop not found; expecting the Docker service to be running"
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        if (Test-DockerReady) {
            Write-Log "Docker is ready"
            return $true
        }
    }

    Write-Log "Docker did not become ready within $TimeoutSeconds seconds"
    return $false
}

function Ensure-Stirling {
    docker container inspect stirling-pdf *> $null
    $exists = $LASTEXITCODE -eq 0

    if (-not $exists) {
        Write-Log "Creating the Stirling-PDF container"

        $trainingData = "C:\StirlingPDF\trainingData"
        $extraConfigs = "C:\StirlingPDF\extraConfigs"
        $logs = "C:\StirlingPDF\logs"
        New-Item -ItemType Directory -Force -Path $trainingData, $extraConfigs, $logs | Out-Null

        docker run -d --name stirling-pdf --restart unless-stopped `
            -p 127.0.0.1:8080:8080 `
            -v "${trainingData}:/usr/share/tessdata" `
            -v "${extraConfigs}:/configs" `
            -v "${logs}:/logs" `
            -e SECURITY_ENABLELOGIN=false `
            stirlingtools/stirling-pdf:latest | Out-Null
    } else {
        $running = (docker inspect -f "{{.State.Running}}" stirling-pdf) -eq "true"
        if (-not $running) {
            Write-Log "Starting the existing Stirling-PDF container"
            docker start stirling-pdf | Out-Null
        }
    }

    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:8080/api/v1/info/status" `
                -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Log "Stirling-PDF is online"
                return $true
            }
        } catch {
            Start-Sleep -Seconds 3
        }
    }

    Write-Log "Stirling-PDF did not become healthy in time"
    return $false
}

Set-Location $appDir

# If this app is already serving (for example after a manual task restart),
# adopt the running instance instead of failing with EADDRINUSE. A stale copy
# started from this folder is stopped so the new build can take over.
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($listener) {
    $alreadyServing = $false
    try {
        $probe = Invoke-WebRequest "http://127.0.0.1:$Port/dashboard" `
            -UseBasicParsing -TimeoutSec 4
        $alreadyServing = $probe.StatusCode -eq 200
    } catch {
        $alreadyServing = $false
    }

    if ($alreadyServing) {
        Write-Log "The web app is already running on port $Port; nothing to start"
        exit 0
    }

    $owner = Get-CimInstance Win32_Process `
        -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $ownerCommand = [string]$owner.CommandLine

    if ($ownerCommand.ToLowerInvariant().Contains($appDir.ToLowerInvariant())) {
        Write-Log "Stopping stale web app process $($listener.OwningProcess)"
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Log "Port $Port is in use by another process; refusing to start"
        exit 1
    }
}

if (-not (Wait-ForDocker)) {
    Write-Log "Continuing without Docker; PDF tools will report the engine as offline"
} else {
    Ensure-Stirling | Out-Null
}

$buildId = Join-Path $appDir ".next\BUILD_ID"
if (-not (Test-Path $buildId)) {
    Write-Log "No production build found; running pnpm build"
    & corepack pnpm build *>> $logFile
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Build failed with exit code $LASTEXITCODE"
        exit 1
    }
}

Write-Log "Starting the web app on http://localhost:$Port"

# Keep this process in the foreground so Task Scheduler can supervise it.
& corepack pnpm exec next start -p $Port *>> $logFile

Write-Log "The web app exited with code $LASTEXITCODE"
exit $LASTEXITCODE
