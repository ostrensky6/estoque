Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionAlias = "kontrol-gia.vercel.app"
$VercelScope = "ostrensky-s-projects"

if (!$env:VERCEL_TOKEN) {
  throw "Defina VERCEL_TOKEN no ambiente. Nao passe token em texto solto no comando."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  & (Join-Path $PSScriptRoot "verify-production-target.ps1")

  Write-Host "Publicando producao Vercel em $VercelScope..."
  $deployOutput = & vercel deploy . --prod -y --scope $VercelScope --token $env:VERCEL_TOKEN 2>&1
  $deployText = $deployOutput -join "`n"
  Write-Host $deployText

  if ($LASTEXITCODE -ne 0) {
    throw "vercel deploy falhou."
  }

  $productionUrl = ($deployText | Select-String -Pattern 'Production:\s+(https://[^\s]+)' -AllMatches).Matches |
    Select-Object -Last 1 |
    ForEach-Object { $_.Groups[1].Value }

  if (!$productionUrl) {
    throw "Nao consegui identificar a URL Production no output da Vercel."
  }

  Write-Host "Fixando alias $ProductionAlias -> $productionUrl"
  & vercel alias set $productionUrl $ProductionAlias --scope $VercelScope --token $env:VERCEL_TOKEN
  if ($LASTEXITCODE -ne 0) {
    throw "vercel alias set falhou."
  }

  Write-Host "Deploy de producao concluido: https://$ProductionAlias" -ForegroundColor Green
} finally {
  Pop-Location
}
