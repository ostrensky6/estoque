param(
  [string]$DestinationPath = "output"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI nao encontrado no PATH."
}

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root $DestinationPath
New-Item -ItemType Directory -Force -Path $out | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$schemaFile = Join-Path $out "orcamento-integrado-schema-$timestamp.sql"
$dataFile = Join-Path $out "orcamento-integrado-data-$timestamp.sql"

supabase db dump --linked --schema public --file $schemaFile
supabase db dump --linked --data-only --schema public --file $dataFile

Write-Output "Backup de schema criado em $schemaFile"
Write-Output "Backup de dados criado em $dataFile"
