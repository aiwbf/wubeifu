param(
  [int]$Port = 4180
)

$ErrorActionPreference = "Stop"
Write-Output ("Serving on http://127.0.0.1:{0}/index.html" -f $Port)
python -m http.server $Port
