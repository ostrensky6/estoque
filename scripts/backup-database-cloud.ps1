param(
  [string]$DestinationPath = "D:\Dropbox\Aplicativos\Kontrol\BD",
  [string]$EnvFile = ".env.local",
  [string]$PgDumpPath = $env:PG_DUMP_PATH
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (!$line -or $line.StartsWith("#") -or !$line.Contains("=")) {
      return
    }

    $parts = $line.Split("=", 2)
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Get-PgDumpCommand {
  param([string]$ConfiguredPath)

  if ($ConfiguredPath) {
    if (!(Test-Path -LiteralPath $ConfiguredPath)) {
      throw "PG_DUMP_PATH aponta para um arquivo inexistente: $ConfiguredPath"
    }
    return $ConfiguredPath
  }

  $cmd = Get-Command "pg_dump" -ErrorAction SilentlyContinue
  if (!$cmd) {
    throw "pg_dump nao encontrado. Instale PostgreSQL ou configure PG_DUMP_PATH."
  }
  return $cmd.Source
}

Import-DotEnv -Path $EnvFile

$databaseUrl = $env:KONTROL_CLOUD_DATABASE_URL
if (!$databaseUrl) {
  $databaseUrl = $env:DATABASE_URL
}
if (!$databaseUrl) {
  throw "Configure KONTROL_CLOUD_DATABASE_URL no ambiente ou em .env.local com a URL PostgreSQL da nuvem."
}

$pgDump = Get-PgDumpCommand -ConfiguredPath $PgDumpPath
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $DestinationPath "kontrol-db-cloud-$timestamp.dump"

& $pgDump `
  "--format=custom" `
  "--no-owner" `
  "--no-privileges" `
  "--file=$backupPath" `
  $databaseUrl

if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $backupPath) {
    Remove-Item -LiteralPath $backupPath -Force
  }
  throw "pg_dump falhou com codigo $LASTEXITCODE."
}

# Retencao mensal: ao virar o mes, os backups do mes anterior sao apagados,
# preservando para sempre apenas os dos dias 1 e 15. O mes corrente fica intacto.
$now = Get-Date
$currentMonthStart = Get-Date -Year $now.Year -Month $now.Month -Day 1 -Hour 0 -Minute 0 -Second 0
Get-ChildItem -LiteralPath $DestinationPath -File -Filter "kontrol-db-cloud-*.dump" | ForEach-Object {
  $keepForever = $_.LastWriteTime.Day -eq 1 -or $_.LastWriteTime.Day -eq 15
  $isPreviousMonth = $_.LastWriteTime -lt $currentMonthStart

  if ($isPreviousMonth -and !$keepForever) {
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

Write-Output "Backup do banco da nuvem criado em $backupPath"
