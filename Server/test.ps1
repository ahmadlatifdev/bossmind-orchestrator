# Save as test.ps1 in Server folder
$json = '{"messages":[{"role":"user","content":"Hello"}]}'

try {
    $result = curl.exe -X POST http://127.0.0.1:5055/api/deepseek/chat `
        -H "Content-Type: application/json" `
        -d $json
    
    Write-Host "RESULT:" -ForegroundColor Green
    Write-Host $result -ForegroundColor White
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Read-Host "Press Enter to continue"