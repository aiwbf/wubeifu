param(
  [switch]$AnswersOnly
)

$ErrorActionPreference = "Stop"

function Get-XeLatex {
  $cmd = Get-Command xelatex -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }

  $fallback = "C:\Program Files\MiKTeX\miktex\bin\x64\xelatex.exe"
  if (Test-Path $fallback) { return $fallback }

  throw "xelatex not found. Please install TeX Live or MiKTeX."
}

$xelatex = Get-XeLatex

function Run-TeX {
  param(
    [string[]]$TexArgs
  )
  & $xelatex @TexArgs
  if ($LASTEXITCODE -ne 0) {
    throw "XeLaTeX failed with exit code $LASTEXITCODE. Args: $($TexArgs -join ' ')"
  }
}

if (-not $AnswersOnly) {
  Run-TeX @("-interaction=nonstopmode", "-halt-on-error", "paper.tex")
  Run-TeX @("-interaction=nonstopmode", "-halt-on-error", "paper.tex")
}

$driver = "_answers_driver.tex"
@'
\def\withanswers{1}
\input{paper.tex}
'@ | Set-Content -Path $driver -Encoding UTF8

Run-TeX @("-interaction=nonstopmode", "-halt-on-error", "-jobname=paper-answers", $driver)
Run-TeX @("-interaction=nonstopmode", "-halt-on-error", "-jobname=paper-answers", $driver)

Remove-Item $driver -Force

Write-Output "Build finished: paper.pdf and paper-answers.pdf"
