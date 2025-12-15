$root = "D:\Shakhsy11\Bossmind-orchestrator\Server"
$portFile = Join-Path $root ".bossmind-port"

if (!(Test-Path $portFile)) {
  throw "Missing .bossmind-port. Start: node server.cjs"
}

function Test-LocalPort {
  param([int]$Port)
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $c.Connected) { $c.Close(); return $true }
    $c.Close()
    return $false
  } catch { return $false }
}

$portRaw = (Get-Content $portFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($portRaw)) {
  throw ".bossmind-port is empty. Start: node server.cjs"
}

$port = [int]$portRaw

# If port is stale, fail with clear message
if (-not (Test-LocalPort -Port $port)) {
  throw "BossMind is not reachable on 127.0.0.1:$port. Restart server.cjs and ensure it prints the listening port."
}

$uri = "http://127.0.0.1:$port/api/deepseek/chat"

$body = @{
  messages = @(
    @{ role = "user"; content = "BossMind test" }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body
