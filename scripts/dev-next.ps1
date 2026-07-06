$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root ".env.local"
$caDir = Join-Path $root ".agents"
$caFile = Join-Path $caDir "node-extra-ca.pem"

function Read-EnvValue([string] $path, [string] $name) {
  if (-not (Test-Path -LiteralPath $path)) {
    return $null
  }

  foreach ($line in Get-Content -LiteralPath $path) {
    if ($line -match "^$([regex]::Escape($name))=(.*)$") {
      $value = $Matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        return $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function Test-NodeFetch([string] $url) {
  $script = @"
fetch('$url/auth/v1/health')
  .then((response) => {
    console.log(response.status);
  })
  .catch((error) => {
    console.error(error && (error.stack || error.message || String(error)));
    process.exit(1);
  });
"@

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = $script | node - 2>&1
    return @{
      Ok = $LASTEXITCODE -eq 0
      Output = ($output -join "`n")
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Export-RemoteCertificateChain([string] $hostName, [string] $targetPath) {
  New-Item -ItemType Directory -Force -Path (Split-Path $targetPath) | Out-Null

  $tcp = [System.Net.Sockets.TcpClient]::new($hostName, 443)
  try {
    $ssl = [System.Net.Security.SslStream]::new($tcp.GetStream(), $false, { $true })
    try {
      $ssl.AuthenticateAsClient($hostName)
      $remote = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($ssl.RemoteCertificate)
      $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
      $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
      [void] $chain.Build($remote)

      $pemBlocks = foreach ($element in $chain.ChainElements) {
        $cert = $element.Certificate
        $base64 = [Convert]::ToBase64String(
          $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert),
          [Base64FormattingOptions]::InsertLineBreaks
        )
        "-----BEGIN CERTIFICATE-----`n$base64`n-----END CERTIFICATE-----`n"
      }

      if (-not $pemBlocks -or $pemBlocks.Count -eq 0) {
        throw "Nao foi possivel extrair a cadeia de certificados de $hostName."
      }

      Set-Content -LiteralPath $targetPath -Value ($pemBlocks -join "`n") -Encoding ascii
    } finally {
      $ssl.Dispose()
    }
  } finally {
    $tcp.Dispose()
  }
}

$supabaseUrl = Read-EnvValue $envFile "NEXT_PUBLIC_SUPABASE_URL"
if ($supabaseUrl -and $supabaseUrl.StartsWith("https://")) {
  $healthCheck = Test-NodeFetch $supabaseUrl
  if (-not $healthCheck.Ok -and $healthCheck.Output -match "UNABLE_TO_VERIFY|certificate|CERT_") {
    $hostName = ([uri] $supabaseUrl).Host
    Write-Host "Node nao confiou na cadeia TLS de $hostName; preparando CA local em .agents/node-extra-ca.pem."
    Export-RemoteCertificateChain $hostName $caFile
    $env:NODE_EXTRA_CA_CERTS = $caFile
    [Environment]::SetEnvironmentVariable("NODE_EXTRA_CA_CERTS", $caFile, "User")

    $retry = Test-NodeFetch $supabaseUrl
    if (-not $retry.Ok) {
      throw "Node ainda nao conseguiu validar TLS para $hostName depois de configurar NODE_EXTRA_CA_CERTS.`n$($retry.Output)"
    }
  } elseif (Test-Path -LiteralPath $caFile) {
    $env:NODE_EXTRA_CA_CERTS = $caFile
  }
}

$nextBin = Join-Path $root "node_modules\.bin\next.cmd"
if (-not (Test-Path -LiteralPath $nextBin)) {
  throw "Next.js local nao encontrado em node_modules. Rode npm ci antes de npm run dev."
}

& $nextBin dev
