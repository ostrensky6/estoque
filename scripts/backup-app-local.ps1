param(
  [string]$SourcePath = (Get-Location).Path,
  [string]$DestinationPath = "D:\Dropbox\Aplicativos\Kontrol\APP",
  [int]$KeepLast = 5
)

$ErrorActionPreference = "Stop"

$source = (Resolve-Path -LiteralPath $SourcePath).Path
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "kontrol-app-$timestamp.zip"
$backupPath = Join-Path $DestinationPath $backupName
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "kontrol-app-backup-$timestamp"

$excludeDirs = @(".git", ".next", "node_modules")
$excludeFiles = @("tsconfig.tsbuildinfo")

try {
  New-Item -ItemType Directory -Force -Path $staging | Out-Null

  $robocopyArgs = @(
    $source,
    $staging,
    "/MIR",
    "/R:2",
    "/W:2",
    "/NFL",
    "/NDL",
    "/NP",
    "/XD"
  ) + $excludeDirs + @("/XF") + $excludeFiles

  & robocopy @robocopyArgs | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "Robocopy falhou com codigo $LASTEXITCODE."
  }

  if (Test-Path -LiteralPath $backupPath) {
    Remove-Item -LiteralPath $backupPath -Force
  }

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $backupPath -CompressionLevel Optimal

  Get-ChildItem -LiteralPath $DestinationPath -File -Filter "kontrol-app-*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLast |
    Remove-Item -Force

  Write-Output "Backup do aplicativo criado em $backupPath"
}
finally {
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
