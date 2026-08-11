param(
  [string]$SourcePath = (Get-Location).Path,
  [string]$DestinationPath = "D:\Dropbox\Aplicativos\Kontrol\APP",
  [int]$KeepLast = 5
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Assert-RequiredSource {
  param([string]$Root)

  $requiredDirectories = @(
    "src",
    "public",
    "scripts",
    "supabase",
    "supabase\migrations",
    "docs",
    "seed",
    ".github\workflows"
  )
  $requiredFiles = @(
    "README.md",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "supabase\config.toml",
    "seed\seed.sql",
    ".github\workflows\ci.yml",
    ".env.example"
  )

  $missing = @()
  foreach ($relativePath in $requiredDirectories) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $relativePath) -PathType Container)) {
      $missing += "$relativePath/"
    }
  }
  foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $relativePath) -PathType Leaf)) {
      $missing += $relativePath
    }
  }

  if ($missing.Count -gt 0) {
    throw "A origem nao e um checkout completo do Kontrol. Ausentes: $($missing -join ', ')."
  }

  $migrationCount = @(
    Get-ChildItem -LiteralPath (Join-Path $Root "supabase\migrations") -File -Filter "*.sql"
  ).Count
  if ($migrationCount -eq 0) {
    throw "A origem nao contem migrations SQL do Supabase."
  }

  return $migrationCount
}

function Assert-Archive {
  param(
    [string]$ArchivePath,
    [int]$ExpectedMigrationCount
  )

  $requiredEntries = @(
    "README.md",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "supabase/config.toml",
    "seed/seed.sql",
    ".github/workflows/ci.yml",
    ".env.example",
    "kontrol-backup-manifest.json"
  )

  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })

    foreach ($entry in $entries) {
      if (
        $entry.StartsWith("/") -or
        $entry -match "^[A-Za-z]:" -or
        $entry -match "(^|/)\.\.(/|$)"
      ) {
        throw "O ZIP contem caminho inseguro: $entry"
      }
    }

    $missing = @($requiredEntries | Where-Object { $_ -notin $entries })
    if ($missing.Count -gt 0) {
      throw "O ZIP nao e restauravel. Entradas ausentes: $($missing -join ', ')."
    }

    foreach ($prefix in @("src/", "public/", "scripts/", "supabase/", "docs/", "seed/", ".github/workflows/")) {
      if (-not ($entries | Where-Object { $_.StartsWith($prefix) } | Select-Object -First 1)) {
        throw "O ZIP nao contem o diretorio obrigatorio $prefix"
      }
    }

    $migrationCount = @(
      $entries | Where-Object { $_ -match "^supabase/migrations/[^/]+\.sql$" }
    ).Count
    if ($migrationCount -ne $ExpectedMigrationCount) {
      throw "O ZIP contem $migrationCount migrations; esperado: $ExpectedMigrationCount."
    }

    $secretEnvFiles = @(
      $entries | Where-Object {
        [System.IO.Path]::GetFileName($_) -like ".env*" -and
        [System.IO.Path]::GetFileName($_) -ne ".env.example"
      }
    )
    if ($secretEnvFiles.Count -gt 0) {
      throw "O ZIP contem arquivo de ambiente privado."
    }

    foreach ($prefix in @(".git/", ".next/", "node_modules/", "output/", "playwright-report/", ".vercel/")) {
      if ($entries | Where-Object { $_.StartsWith($prefix) } | Select-Object -First 1) {
        throw "O ZIP contem artefato local/regeneravel: $prefix"
      }
    }
    if ($entries | Where-Object { [System.IO.Path]::GetFileName($_) -eq "tsconfig.tsbuildinfo" } | Select-Object -First 1) {
      throw "O ZIP contem artefato local/regeneravel: tsconfig.tsbuildinfo"
    }
  }
  finally {
    $archive.Dispose()
  }
}

$source = (Resolve-Path -LiteralPath $SourcePath).Path
$migrationCount = Assert-RequiredSource -Root $source

if ($KeepLast -lt 1) {
  throw "KeepLast deve ser maior ou igual a 1."
}

$destination = [System.IO.Path]::GetFullPath($DestinationPath)
$sourcePrefix = [System.IO.Path]::GetFullPath($source).TrimEnd("\") + "\"
$destinationPrefix = $destination.TrimEnd("\") + "\"
if ($destinationPrefix.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "O destino do backup nao pode ficar dentro da origem."
}

$insideWorkTree = (& git -C $source rev-parse --is-inside-work-tree 2>$null)
if ($LASTEXITCODE -ne 0 -or $insideWorkTree.Trim() -ne "true") {
  throw "A origem nao e um checkout Git completo do Kontrol."
}

$sourceCommit = (& git -C $source rev-parse HEAD 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sourceCommit)) {
  throw "Nao foi possivel identificar o commit da origem."
}

$relativeFiles = @(& git -C $source ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0 -or $relativeFiles.Count -eq 0) {
  throw "Nao foi possivel inventariar os arquivos Git da origem."
}

$relativeFiles = @(
  $relativeFiles |
    Where-Object {
      $normalizedPath = $_.Replace("\", "/")
      $fileName = [System.IO.Path]::GetFileName($_)
      $isExcludedPath =
        $normalizedPath.StartsWith(".git/") -or
        $normalizedPath.StartsWith(".next/") -or
        $normalizedPath.StartsWith("node_modules/") -or
        $normalizedPath.StartsWith("output/") -or
        $normalizedPath.StartsWith("playwright-report/") -or
        $normalizedPath.StartsWith(".vercel/")

      -not $isExcludedPath -and
        $fileName -ne "tsconfig.tsbuildinfo" -and
        -not ($fileName -like ".env*" -and $fileName -ne ".env.example")
    } |
    Sort-Object -Unique
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$backupName = "kontrol-app-$timestamp.zip"
$backupPath = Join-Path $destination $backupName
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "kontrol-app-backup-$([guid]::NewGuid().ToString('N'))"
$backupValidated = $false

try {
  New-Item -ItemType Directory -Force -Path $staging | Out-Null

  foreach ($relativePath in $relativeFiles) {
    $sourceFile = Join-Path $source $relativePath
    if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
      throw "Arquivo inventariado pelo Git nao existe na origem: $relativePath"
    }

    $destinationFile = Join-Path $staging $relativePath
    $destinationDirectory = Split-Path -Parent $destinationFile
    if ($destinationDirectory) {
      New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    }
    Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
  }

  $hasLocalChanges = -not [string]::IsNullOrWhiteSpace(
    ((& git -C $source status --porcelain --untracked-files=all) -join "`n")
  )
  $manifest = [ordered]@{
    formatVersion = 1
    createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    sourceCommit = $sourceCommit.Trim()
    hasLocalChanges = $hasLocalChanges
    fileCount = $relativeFiles.Count
    migrationCount = $migrationCount
    databaseIncluded = $false
    environmentPolicy = "Somente .env.example; demais .env* excluidos."
  }
  $manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $staging "kontrol-backup-manifest.json") -Encoding UTF8

  Assert-RequiredSource -Root $staging | Out-Null
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $staging,
    $backupPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  Assert-Archive -ArchivePath $backupPath -ExpectedMigrationCount $migrationCount
  $backupValidated = $true

  Get-ChildItem -LiteralPath $destination -File -Filter "kontrol-app-*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLast |
    Remove-Item -Force

  Write-Output "Backup restauravel do aplicativo criado em $backupPath"
}
catch {
  if (-not $backupValidated -and (Test-Path -LiteralPath $backupPath)) {
    Remove-Item -LiteralPath $backupPath -Force
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
