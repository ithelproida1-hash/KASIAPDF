<#
    Registers a Windows scheduled task that starts the Jindal Kasia PDF stack
    (Stirling-PDF + Next.js) whenever the current user signs in.

    Run once from an elevated or normal PowerShell:
        powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1

    Options:
        -StartNow   Start the task immediately after registering it.
#>

[CmdletBinding()]
param(
    [switch]$StartNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "JindalKasiaPDF"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$startScript = Join-Path $scriptDir "start-app.ps1"

if (-not (Test-Path $startScript)) {
    throw "start-app.ps1 was not found next to this script."
}

# A production build is required by "next start". Build now so the first
# sign-in does not have to wait for compilation.
$buildId = Join-Path $appDir ".next\BUILD_ID"
if (-not (Test-Path $buildId)) {
    Write-Host "Building the production bundle..."
    Push-Location $appDir
    try {
        & corepack pnpm build
        if ($LASTEXITCODE -ne 0) { throw "pnpm build failed." }
    } finally {
        Pop-Location
    }
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$description = "Starts Jindal Kasia PDF and the local Stirling-PDF engine at sign-in."

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description $description `
    -Force | Out-Null

Write-Host "Registered scheduled task '$taskName'."
Write-Host "Logs: $appDir\logs\app.log"

if ($StartNow) {
    # Restart cleanly: Stop-ScheduledTask does not always terminate the Node
    # child, so stop the task first and then the listener it left behind.
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($listener) {
        $owner = Get-CimInstance Win32_Process `
            -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
        $ownerCommand = ([string]$owner.CommandLine).ToLowerInvariant()

        if ($ownerCommand.Contains($appDir.ToLowerInvariant())) {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } else {
            throw "Port 3000 is in use by another process. Stop it, then run this script again."
        }
    }

    Start-ScheduledTask -TaskName $taskName
    Write-Host "Task started. The site will be available at http://localhost:3000."
}
