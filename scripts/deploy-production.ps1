Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProductionAlias = "kontrol-gia.vercel.app"
$VercelScope = "ostrensky-s-projects"
$ExpectedVercelOrgId = "team_HYxJGUZ1QLz2P0H2U4l9Ayn8"
$ExpectedVercelProjectId = "prj_EnHPskP6CjuCv8UCzC6iXjQpcwQi"
$ForbiddenVercelScopes = @(
  "ostrenskys-projects-17ce406b"
)

function Assert-ProductionVercelTarget([string]$RepoRoot) {
  foreach ($forbiddenScope in $ForbiddenVercelScopes) {
    if ($VercelScope -eq $forbiddenScope) {
      throw "Scope Vercel proibido '$forbiddenScope'. Use '$VercelScope'."
    }
  }

  $projectPath = Join-Path $RepoRoot ".vercel/project.json"
  if (!(Test-Path $projectPath)) {
    throw "Projeto Vercel nao esta linkado: .vercel/project.json ausente."
  }

  $project = Get-Content -Raw $projectPath | ConvertFrom-Json
  if ($project.orgId -ne $ExpectedVercelOrgId) {
    throw ".vercel/project.json orgId='$($project.orgId)', esperado '$ExpectedVercelOrgId'."
  }
  if ($project.projectId -ne $ExpectedVercelProjectId) {
    throw ".vercel/project.json projectId='$($project.projectId)', esperado '$ExpectedVercelProjectId'."
  }
}

if (!$env:VERCEL_TOKEN) {
  throw "Defina VERCEL_TOKEN no ambiente. Nao passe token em texto solto no comando."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  Assert-ProductionVercelTarget $repoRoot
  & (Join-Path $PSScriptRoot "verify-production-target.ps1")

  Write-Host "Publicando producao Vercel em $VercelScope..."
  $oldEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $deployOutput = & vercel deploy . --prod -y --scope $VercelScope --token $env:VERCEL_TOKEN 2>&1
  $ErrorActionPreference = $oldEap
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
