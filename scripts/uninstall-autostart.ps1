<#
    Removes the Jindal Kasia PDF sign-in task.

        powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-autostart.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "JindalKasiaPDF"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed scheduled task '$taskName'."
} else {
    Write-Host "No scheduled task named '$taskName' was found."
}
