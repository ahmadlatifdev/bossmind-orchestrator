# bossmind-test.ps1
# BossMind Local DeepSeek Test Script

param(
    [string]$Port = "5001",
    [string]$Message = "Hello BossMind, test from PowerShell script."
)

Write-Host "=== BossMind Local Test Script ===" -ForegroundColor Cyan
Write-Host "Testing port: $Port" -ForegroundColor Yellow

# 1. Health check
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 3
    Write-Host "`n[✓] Server Healthy:" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 10
} catch {
    Write-Host "`n[✗] Health Check Failed" -ForegroundColor Red
    Write-Host "Error: $_"
    exit 1
}

# 2. Test message body
$body = @{
    messages = @(
        @{
            role    = "user"
            content = $Message
        }
    )
}

Write-Host "`nSending message: '$Message'" -ForegroundColor Yellow

# 3. POST request to DeepSeek proxy
try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:$Port/api/deepseek/chat" `
        -Method Post `
        -ContentType "application/json" `
        -Body ($body | ConvertTo-Json -Depth 10)

    Write-Host "`n[✓] Response Received:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10

} catch {
    Write-Host "`n[✗] Chat Request Failed" -ForegroundColor Red
    Write-Host "Error: $_"
}
