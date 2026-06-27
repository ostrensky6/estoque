Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$appConfigPath = Join-Path $repoRoot "src\config\app.ts"
$packagePath = Join-Path $repoRoot "package.json"
$lockPath = Join-Path $repoRoot "package-lock.json"

function Get-NextVersion([string]$Version) {
  if ($Version -notmatch '^(\d+)\.(\d+)(?:\.(\d+))?$') {
    throw "Versao invalida '$Version'. Use o formato 1.0.0."
  }

  $major = [int]$Matches[1]
  $minor = [int]$Matches[2]
  $patch = if ($Matches[3]) { [int]$Matches[3] } else { 0 }

  if ($patch -lt 9) {
    $patch += 1
  } else {
    $minor += 1
    $patch = 0
  }

  return "$major.$minor.$patch"
}

$appConfig = Get-Content -Raw $appConfigPath
$match = [regex]::Match($appConfig, 'APP_VERSION\s*=\s*"([^"]+)"')
if (!$match.Success) {
  throw "Nao encontrei APP_VERSION em $appConfigPath."
}

$currentVersion = $match.Groups[1].Value
$nextVersion = Get-NextVersion $currentVersion

$appConfig = $appConfig -replace 'APP_VERSION\s*=\s*"[^"]+"', "APP_VERSION = `"$nextVersion`""
Set-Content -Path $appConfigPath -Value $appConfig -Encoding utf8

$packageJson = Get-Content -Raw $packagePath | ConvertFrom-Json
$packageJson.version = $nextVersion
$packageJson | ConvertTo-Json -Depth 100 | Set-Content -Path $packagePath -Encoding utf8

Push-Location $repoRoot
try {
  & npm version $nextVersion --no-git-tag-version --allow-same-version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "npm version falhou ao atualizar package.json/package-lock.json."
  }
} finally {
  Pop-Location
}

Write-Host "Versao atualizada: $currentVersion -> $nextVersion"
