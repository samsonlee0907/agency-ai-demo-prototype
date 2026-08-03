[CmdletBinding()]
param(
  [string]$OutputPath = "artifacts/deploy/agency-ai-demo.zip",
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed."
  }
  return $output
}

$repoRoot = (Invoke-Git rev-parse --show-toplevel).Trim()
$status = @(Invoke-Git status --porcelain)
if ($status.Count -gt 0 -and -not $AllowDirty) {
  throw "The worktree is dirty. Commit the intended source before building a reproducible package, or pass -AllowDirty to package HEAD only."
}

$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputPath)) {
  [IO.Path]::GetFullPath($OutputPath)
} else {
  [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
}

$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
if (Test-Path $resolvedOutput) {
  Remove-Item -LiteralPath $resolvedOutput -Force
}

& git -C $repoRoot archive --format=zip --output=$resolvedOutput HEAD
if ($LASTEXITCODE -ne 0) {
  throw "git archive failed."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedOutput)
try {
  $entryNames = [Collections.Generic.HashSet[string]]::new(
    [string[]]$archive.Entries.FullName,
    [StringComparer]::OrdinalIgnoreCase
  )
  foreach ($required in @(
    "package.json",
    "package-lock.json",
    "server.js",
    "public/index.html",
    "public/assets/documents/meridian-house-office-lease-demo.pdf",
    "public/assets/floorplans/meridian-house-level-12-floorplan.jpeg"
  )) {
    if (-not $entryNames.Contains($required)) {
      throw "Deployment package is missing required entry: $required"
    }
  }
  if ($entryNames.Contains(".env")) {
    throw "Deployment package must not contain .env."
  }
} finally {
  $archive.Dispose()
}

$item = Get-Item $resolvedOutput
$hash = (Get-FileHash $resolvedOutput -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Created $resolvedOutput"
Write-Host "Bytes: $($item.Length)"
Write-Host "SHA-256: $hash"
