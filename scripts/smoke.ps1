param(
  [int]$Port = 4180,
  [switch]$TryConsoleCheck
)

$ErrorActionPreference = "Stop"

$server = Start-Process -FilePath python -ArgumentList "-m", "http.server", "$Port" -WorkingDirectory (Get-Location) -PassThru
Start-Sleep -Seconds 1

try {
  $url = "http://127.0.0.1:$Port/index.html"
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Unexpected HTTP status: $($resp.StatusCode)"
  }
  if ($resp.Content -notmatch "Highway Escape 3D") {
    throw "Expected game title not found in served HTML."
  }
  if ($resp.Content -notmatch 'id="startButton"') {
    throw "Start button markup not found in served HTML."
  }
  Write-Output "HTTP smoke test passed."

  if ($TryConsoleCheck) {
    try {
      & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
        "--headless=new" "--disable-gpu" "--no-sandbox" "--disable-breakpad" `
        "--disable-crash-reporter" "--user-data-dir=$env:TEMP\\edge_smoke_profile" `
        "--virtual-time-budget=3500" "--enable-logging=stderr" "--v=1" $url 2>&1 |
        Select-Object -First 80
    } catch {
      Write-Warning "Headless browser console check failed in this environment. See warning above."
    }
  }
}
finally {
  if ($server -and !$server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
