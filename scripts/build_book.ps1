param(
  [string]$Output = "book-draft.md"
)

$root = Split-Path -Parent $PSScriptRoot
$manuscript = Join-Path $root "manuscript"
$outPath = Join-Path $root $Output

$order = @(
  "ch00_preface.md",
  "ch01_timeline_and_key_nodes.md",
  "ch02_legal_process_and_institutions.md",
  "ch03_plea_bargains_and_accountability.md",
  "ch04_media_narratives_and_information_ecology.md",
  "ch05_elite_networks_verifiable_links_only.md",
  "ch06_political_polarization_and_conspiracy_politics.md",
  "ch07_governance_reform_and_policy_tradeoffs.md",
  "ch08_future_scenarios_1to3y.md",
  "ch09_future_scenarios_3to10y.md",
  "ch10_conclusion.md",
  "appendices.md"
)

$chunks = @()
foreach ($f in $order) {
  $p = Join-Path $manuscript $f
  if (Test-Path $p) {
    $chunks += (Get-Content -Path $p -Raw -Encoding UTF8)
  }
}

$final = $chunks -join "`r`n`r`n---`r`n`r`n"
Set-Content -Path $outPath -Value $final -Encoding UTF8
Write-Host "WROTE $outPath"
