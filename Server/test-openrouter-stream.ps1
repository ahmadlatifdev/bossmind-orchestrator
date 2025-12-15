$uri = "http://127.0.0.1:5000/api/openrouter/chat"

$body = @{
  messages = @(
    @{ role = "user"; content = "BossMind streaming test via OpenRouter. Reply with 3 short lines." }
  )
} | ConvertTo-Json -Depth 10

Write-Host "POST $uri"
Write-Host "---- STREAM START ----"

# Use Invoke-WebRequest to keep the connection open and print SSE chunks as they arrive
$response = Invoke-WebRequest `
  -Method Post `
  -Uri $uri `
  -Headers @{ "Accept" = "text/event-stream" } `
  -ContentType "application/json" `
  -Body $body `
  -TimeoutSec 300

# Print the raw SSE output
$response.Content

Write-Host "---- STREAM END ----"
