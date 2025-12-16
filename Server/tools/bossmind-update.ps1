# BossMind Safe Self-Update (Windows / PM2 SAFE) - ASCII ONLY

$ErrorActionPreference = "Stop"

$ProjectDir = "D:\Shakhsy11\Bossmind-orchestrator"
$HealthUrl  = "http://127.0.0.1:5055/health"
$Pm2Name    = "BossMind"
$Branch     = "master"
$Remote     = "origin"

function Log {
    param([string]$Msg)
    Write-Host "[BossMind-Update] $Msg"
}

function HealthCheck {
    try {
        $r = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5
        if ($r.status -eq "ok" -and $r.router -eq "ENFORCED") { return $true }
        return $false
    } catch {
        return $false
    }
}

Set-Location $ProjectDir

Log "Starting safe update"

$CurrentCommit = (git rev-parse --short HEAD)
Log "Current commit: $CurrentCommit"

$Dirty = (git status --porcelain)
if ($Dirty) {
    Log "BLOCKED: Uncommitted changes detected"
    exit 10
}

if (-not (HealthCheck)) {
    Log "BLOCKED: Health check FAILED before update"
    exit 11
}

$RollbackCommit = (git rev-parse HEAD)
Log "Rollback commit saved: $RollbackCommit"

Log "Fetching from origin"
git fetch $Remote

Log "Pulling latest changes"
git pull $Remote $Branch

Log "Restarting PM2 process"
pm2 restart $Pm2Name | Out-Null
Start-Sleep 3

if (-not (HealthCheck)) {
    Log "FAILED: Health check after update - rolling back"

    git reset --hard $RollbackCommit
    pm2 restart $Pm2Name | Out-Null
    Start-Sleep 3

    if (-not (HealthCheck)) {
        Log "CRITICAL: Rollback failed - manual check required"
        exit 20
    }

    Log "Rollback successful"
    exit 21
}

$NewCommit = (git rev-parse --short HEAD)
Log "Update successful - now running $NewCommit"
exit 0
