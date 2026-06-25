param(
  [switch]$AllowNonMain
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Expected = @{
  VercelOrgId = "team_HYxJGUZ1QLz2P0H2U4l9Ayn8"
  VercelProjectId = "prj_EnHPskP6CjuCv8UCzC6iXjQpcwQi"
  VercelScope = "ostrensky-s-projects"
  VercelProject = "kontrol-gia"
  ProductionUrl = "https://kontrol-gia.vercel.app"
  SupabaseRef = "hhxwdcwphitfxywbgtju"
  SupabaseUrl = "https://hhxwdcwphitfxywbgtju.supabase.co"
}

$ForbiddenVercelScopes = @(
  "ostrenskys-projects-17ce406b"
)

$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure([string]$Message) {
  $Failures.Add($Message) | Out-Null
}

function Add-Warning([string]$Message) {
  $Warnings.Add($Message) | Out-Null
}

function Read-DotEnv([string]$Path) {
  $values = @{}
  if (!(Test-Path $Path)) {
    return $values
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
      $values[$matches[1]] = $matches[2].Trim('"').Trim("'")
    }
  }
  return $values
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot
try {
  $branch = (git branch --show-current).Trim()
  if (!$AllowNonMain -and $branch -ne "main") {
    Add-Failure "Branch atual '$branch' nao e 'main'. Use main para producao ou rode com -AllowNonMain conscientemente."
  }

  foreach ($forbiddenScope in $ForbiddenVercelScopes) {
    if ($Expected.VercelScope -eq $forbiddenScope) {
      Add-Failure "Configuracao de producao aponta para o scope proibido '$forbiddenScope'. Use '$($Expected.VercelScope)'."
    }
  }

  $vercelProjectPath = Join-Path $repoRoot ".vercel/project.json"
  if (!(Test-Path $vercelProjectPath)) {
    Add-Failure "Projeto Vercel nao esta linkado: .vercel/project.json ausente."
  } else {
    $vercelProject = Get-Content -Raw $vercelProjectPath | ConvertFrom-Json
    if ($vercelProject.orgId -ne $Expected.VercelOrgId) {
      Add-Failure ".vercel/project.json orgId='$($vercelProject.orgId)', esperado '$($Expected.VercelOrgId)'."
    }
    if ($vercelProject.projectId -ne $Expected.VercelProjectId) {
      Add-Failure ".vercel/project.json projectId='$($vercelProject.projectId)', esperado '$($Expected.VercelProjectId)'."
    }
    foreach ($forbiddenScope in $ForbiddenVercelScopes) {
      if (($vercelProject | ConvertTo-Json -Compress) -match [regex]::Escape($forbiddenScope)) {
        Add-Failure ".vercel/project.json contem o scope proibido '$forbiddenScope'."
      }
    }
  }

  $supabaseProjectRefPath = Join-Path $repoRoot "supabase/.temp/project-ref"
  if (!(Test-Path $supabaseProjectRefPath)) {
    Add-Failure "Supabase nao esta linkado. Rode: supabase link --project-ref $($Expected.SupabaseRef)"
  } else {
    $linkedRef = (Get-Content -Raw $supabaseProjectRefPath).Trim()
    if ($linkedRef -ne $Expected.SupabaseRef) {
      Add-Failure "Supabase linkado em '$linkedRef', esperado '$($Expected.SupabaseRef)'."
    }
  }

  $envLocal = Read-DotEnv (Join-Path $repoRoot ".env.local")
  if ($envLocal.ContainsKey("NEXT_PUBLIC_SUPABASE_URL") -and $envLocal["NEXT_PUBLIC_SUPABASE_URL"] -ne $Expected.SupabaseUrl) {
    Add-Warning ".env.local NEXT_PUBLIC_SUPABASE_URL aponta para '$($envLocal["NEXT_PUBLIC_SUPABASE_URL"])'. Isso e normal para desenvolvimento local; confirme as env vars Production na Vercel antes do deploy."
  }

  $migrationFiles = Get-ChildItem (Join-Path $repoRoot "supabase/migrations") -Filter "*.sql"
  $versions = $migrationFiles | ForEach-Object {
    if ($_.Name -match '^(\d{4})_') {
      [pscustomobject]@{ Version = $matches[1]; Name = $_.Name }
    }
  }

  $duplicates = $versions | Group-Object Version | Where-Object { $_.Count -gt 1 }
  foreach ($duplicate in $duplicates) {
    $names = ($duplicate.Group | ForEach-Object { $_.Name }) -join ", "
    Add-Failure "Versao de migration duplicada '$($duplicate.Name)': $names"
  }

  if (Test-Path (Join-Path $repoRoot "supabase/migrations/0026_pedido_compra_recebida.sql")) {
    Add-Failure "Migration 0026_pedido_compra_recebida.sql nao deve existir; ela deve ser 0032_pedido_compra_recebida.sql para evitar versao duplicada."
  }

  if (!(Test-Path (Join-Path $repoRoot "supabase/migrations/0032_pedido_compra_recebida.sql"))) {
    Add-Failure "Migration esperada ausente: supabase/migrations/0032_pedido_compra_recebida.sql"
  }

  if ($env:VERCEL_TOKEN) {
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $inspect = & vercel project inspect $Expected.VercelProject --scope $Expected.VercelScope --token $env:VERCEL_TOKEN 2>&1
    $ErrorActionPreference = $oldEap
    $inspectText = $inspect -join "`n"
    if ($LASTEXITCODE -ne 0) {
      Add-Failure "Token Vercel nao acessa $($Expected.VercelScope)/$($Expected.VercelProject)."
    } elseif ($inspectText -notmatch [regex]::Escape($Expected.VercelProjectId)) {
      Add-Failure "Vercel project inspect nao confirmou o Project ID esperado '$($Expected.VercelProjectId)'."
    } else {
      foreach ($forbiddenScope in $ForbiddenVercelScopes) {
        if ($inspectText -match [regex]::Escape($forbiddenScope)) {
          Add-Failure "Vercel project inspect retornou o scope proibido '$forbiddenScope'."
        }
      }
    }
  } else {
    Add-Warning "VERCEL_TOKEN nao definido; validacao remota da Vercel foi pulada."
  }

  if ($Warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Avisos:" -ForegroundColor Yellow
    foreach ($warning in $Warnings) {
      Write-Host " - $warning" -ForegroundColor Yellow
    }
  }

  if ($Failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Falha na validacao de producao:" -ForegroundColor Red
    foreach ($failure in $Failures) {
      Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
  }

  Write-Host "Validacao de producao OK:" -ForegroundColor Green
  Write-Host " - Vercel: $($Expected.VercelScope)/$($Expected.VercelProject) -> $($Expected.ProductionUrl)"
  Write-Host " - Supabase: $($Expected.SupabaseRef)"
  Write-Host " - Migrations: sem versoes duplicadas"
} finally {
  Pop-Location
}
