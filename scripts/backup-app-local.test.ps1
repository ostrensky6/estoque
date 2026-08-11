$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

$scriptPath = Join-Path $PSScriptRoot "backup-app-local.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "kontrol-backup-test-$([guid]::NewGuid().ToString('N'))"
$source = Join-Path $testRoot "source"
$destination = Join-Path $testRoot "backups"
$restore = Join-Path $testRoot "restore"
$incomplete = Join-Path $testRoot "incomplete"

try {
  foreach ($directory in @(
    "src",
    "public",
    "scripts",
    "supabase\migrations",
    "docs",
    "seed",
    ".github\workflows",
    "node_modules\pacote",
    ".next\cache",
    "output",
    ".vercel",
    "playwright-report"
  )) {
    New-Item -ItemType Directory -Force -Path (Join-Path $source $directory) | Out-Null
  }

  $files = @{
    "README.md" = "# Kontrol"
    "package.json" = '{"name":"kontrol-backup-fixture","version":"1.0.0"}'
    "package-lock.json" = '{"name":"kontrol-backup-fixture","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"kontrol-backup-fixture","version":"1.0.0"}}}'
    "next.config.ts" = "export default {};"
    "tsconfig.json" = "{}"
    "supabase\config.toml" = "project_id = 'fixture'"
    "supabase\migrations\0001_fixture.sql" = "select 1;"
    "seed\seed.sql" = "select 1;"
    ".github\workflows\ci.yml" = "name: CI"
    ".env.example" = "PUBLIC_VALUE=example"
    ".env.local" = "PRIVATE_VALUE=secret"
    ".gitignore" = ".env.local`nnode_modules/`n.next/`noutput/`n.vercel/`nplaywright-report/`ntsconfig.tsbuildinfo"
    "src\index.ts" = "export {};"
    "public\fixture.txt" = "fixture"
    "scripts\fixture.ps1" = "Write-Output fixture"
    "docs\fixture.md" = "fixture"
    "node_modules\pacote\index.js" = "ignored"
    ".next\cache\data" = "ignored"
    "output\report.txt" = "ignored"
    ".vercel\project.json" = "{}"
    "playwright-report\index.html" = "ignored"
    "tsconfig.tsbuildinfo" = "ignored"
  }

  foreach ($entry in $files.GetEnumerator()) {
    $path = Join-Path $source $entry.Key
    $parent = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Set-Content -LiteralPath $path -Value $entry.Value -Encoding UTF8
  }

  & git -C $source init --quiet
  & git -C $source config user.email "backup-test@localhost"
  & git -C $source config user.name "Kontrol Backup Test"
  & git -C $source add --all
  & git -C $source add --force -- ".vercel/project.json" "playwright-report/index.html" "tsconfig.tsbuildinfo"
  & git -C $source commit --quiet -m "fixture"

  & $scriptPath -SourcePath $source -DestinationPath $destination -KeepLast 1 | Out-Null
  $zip = Get-ChildItem -LiteralPath $destination -File -Filter "kontrol-app-*.zip" | Select-Object -First 1
  Assert-True ($null -ne $zip) "O backup valido nao foi criado."

  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
    Assert-True (".github/workflows/ci.yml" -in $entries) ".github/workflows/ci.yml ficou fora do ZIP."
    Assert-True ("supabase/migrations/0001_fixture.sql" -in $entries) "A migration ficou fora do ZIP."
    Assert-True ("seed/seed.sql" -in $entries) "seed.sql ficou fora do ZIP."
    Assert-True ("docs/fixture.md" -in $entries) "docs ficou fora do ZIP."
    Assert-True (".env.example" -in $entries) ".env.example ficou fora do ZIP."
    Assert-True (".env.local" -notin $entries) ".env.local entrou indevidamente no ZIP."
    Assert-True (-not ($entries | Where-Object { $_.StartsWith("node_modules/") })) "node_modules entrou no ZIP."
    Assert-True (-not ($entries | Where-Object { $_.StartsWith(".next/") })) ".next entrou no ZIP."
    Assert-True (-not ($entries | Where-Object { $_.StartsWith("output/") })) "output entrou no ZIP."
    Assert-True (-not ($entries | Where-Object { $_.StartsWith("playwright-report/") })) "playwright-report entrou no ZIP."
    Assert-True (-not ($entries | Where-Object { $_.StartsWith(".vercel/") })) ".vercel entrou no ZIP."
    Assert-True ("tsconfig.tsbuildinfo" -notin $entries) "tsconfig.tsbuildinfo entrou no ZIP."
    $unsafeEntries = @(
      $entries | Where-Object {
        $_.StartsWith("/") -or
        $_ -match "^[A-Za-z]:" -or
        $_ -match "(^|/)\.\.(/|$)"
      }
    )
    Assert-True ($unsafeEntries.Count -eq 0) "O ZIP contem caminho absoluto ou traversal."
  }
  finally {
    $archive.Dispose()
  }

  [System.IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $restore)
  Assert-True (Test-Path -LiteralPath (Join-Path $restore "package-lock.json") -PathType Leaf) "A restauracao perdeu package-lock.json."
  Assert-True (Test-Path -LiteralPath (Join-Path $restore ".github\workflows\ci.yml") -PathType Leaf) "A restauracao perdeu o workflow de CI."
  Assert-True (Test-Path -LiteralPath (Join-Path $restore "kontrol-backup-manifest.json") -PathType Leaf) "A restauracao perdeu o manifesto."

  New-Item -ItemType Directory -Force -Path $incomplete | Out-Null
  Set-Content -LiteralPath (Join-Path $incomplete "package.json") -Value "{}" -Encoding UTF8
  $failedClosed = $false
  try {
    & $scriptPath -SourcePath $incomplete -DestinationPath (Join-Path $testRoot "invalid") -KeepLast 1 | Out-Null
  }
  catch {
    $failedClosed = $true
  }
  Assert-True $failedClosed "Uma origem incompleta foi aceita."
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $testRoot "invalid"))) "A origem incompleta deixou artefato de backup."

  Write-Output "PASS: contrato de backup restauravel validado."
}
finally {
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
