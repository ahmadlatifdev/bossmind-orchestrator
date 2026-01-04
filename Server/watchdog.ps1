param(
    [string]$Mode = "start"
)

$serverPath = "D:\Shakhsy11\Bossmind-orchestrator\Server"
$nodeCmd = "node server.cjs"
$port = 5000

function Stop-Server {
    Write-Host "Stopping BossMind Orchestrator on port $port..."

    $pids = netstat -ano | findstr ":$port" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique

    foreach ($pid in $pids) {
        if ($pid -match '^\d+$') {
            Write-Host "Killing PID $pid"
            taskkill /PID $pid /F /T | Out-Null
        }
    }

    Write-Host "BossMind stopped."
}

function Start-Server {
    Write-Host "Starting BossMind Orchestrator..."
    Set-Location $serverPath
    Start-Process powershell "-NoExit -Command $nodeCmd"
}

if ($Mode -eq "stop") {
    Stop-Server
    exit
}

if ($Mode -eq "start") {
    Start-Server
}
