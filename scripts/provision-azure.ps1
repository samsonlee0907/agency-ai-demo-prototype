[CmdletBinding()]
param(
  [string]$SubscriptionId,
  [string]$Location = "swedencentral",
  [string]$ResourceGroupName = "rg-aurelia-agency-ai-repro",
  [ValidatePattern("^[a-z0-9-]{3,32}$")]
  [string]$BaseName = "aurelia-agency-ai",
  [string]$PortalUsername,
  [SecureString]$PortalPassword,
  [ValidateRange(1, 1000)]
  [int]$GptCapacity = 10,
  [ValidateRange(1, 100)]
  [int]$MaiCapacity = 1,
  [switch]$SkipMai,
  [switch]$SkipTests,
  [switch]$SkipApplicationDeploy,
  [switch]$AllowExistingResourceGroup,
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$templatePath = Join-Path $repoRoot "infra/main.bicep"
$packagePath = Join-Path $repoRoot "artifacts/deploy/agency-ai-demo.zip"
$parameterPath = $null
$passwordPointer = [IntPtr]::Zero
$plainPassword = $null

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found."
  }
}

function Invoke-AzJson {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  $output = & az @Arguments --only-show-errors -o json
  if ($LASTEXITCODE -ne 0) {
    throw "az $($Arguments -join ' ') failed."
  }
  if (-not $output) {
    return $null
  }
  return ($output | ConvertFrom-Json)
}

function Ensure-ProviderRegistration {
  param(
    [string]$Namespace,
    [bool]$AllowRegistration
  )

  $state = (& az provider show --namespace $Namespace --query registrationState -o tsv --only-show-errors).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect provider $Namespace."
  }
  if ($state -eq "Registered") {
    return
  }
  if (-not $AllowRegistration) {
    throw "Provider $Namespace is not registered. What-if does not change provider state; run a real deployment or register it explicitly first."
  }

  Write-Host "Registering Azure resource provider $Namespace..."
  & az provider register --namespace $Namespace --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to register provider $Namespace."
  }
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    Start-Sleep -Seconds 5
    $state = (& az provider show --namespace $Namespace --query registrationState -o tsv --only-show-errors).Trim()
    if ($state -eq "Registered") {
      return
    }
  }
  throw "Provider $Namespace did not reach Registered state."
}

function Assert-ModelCapacity {
  param(
    [object[]]$Catalog,
    [object[]]$Usage,
    [string]$ModelName,
    [string]$Version,
    [string]$Sku,
    [string]$UsageName,
    [int]$RequiredCapacity
  )

  $supported = @($Catalog | Where-Object {
    $_.model.name -eq $ModelName -and
    $_.model.version -eq $Version -and
    @($_.model.skus.name) -contains $Sku
  })
  if ($supported.Count -eq 0) {
    throw "$ModelName version $Version with SKU $Sku is not available in $Location."
  }

  $quota = @($Usage | Where-Object { $_.name.value -eq $UsageName }) | Select-Object -First 1
  if (-not $quota) {
    throw "No quota record named $UsageName was found in $Location."
  }
  $available = [double]$quota.limit - [double]$quota.currentValue
  if ($available -lt $RequiredCapacity) {
    throw "$ModelName requires capacity $RequiredCapacity, but only $available is available for $UsageName in $Location."
  }
  Write-Host "$ModelName ${Version}: $available capacity available; $RequiredCapacity requested."
}

try {
  foreach ($command in @("az", "git", "node", "npm", "pwsh")) {
    Assert-Command $command
  }

  $account = Invoke-AzJson account show
  if (-not $account) {
    throw "Azure CLI is not authenticated. Run az login first."
  }
  if (-not $SubscriptionId) {
    $SubscriptionId = $account.id
  }
  & az account set --subscription $SubscriptionId
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to select subscription $SubscriptionId."
  }

  if (-not $PortalUsername) {
    $PortalUsername = Read-Host "Portal username"
  }
  if ([string]::IsNullOrWhiteSpace($PortalUsername)) {
    throw "Portal username is required."
  }
  if (-not $PortalPassword) {
    $PortalPassword = Read-Host "Portal password" -AsSecureString
  }
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PortalPassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ($plainPassword.Length -lt 12) {
    throw "Portal password must contain at least 12 characters."
  }
  if ($plainPassword.Length -gt 256) {
    throw "Portal password must contain at most 256 characters."
  }

  $existingGroup = & az group exists --name $ResourceGroupName --only-show-errors
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect resource group $ResourceGroupName."
  }
  if ($ResourceGroupName -notmatch "(?i)(demo|repro|test|dev)") {
    throw "Resource group names must contain demo, repro, test, or dev so this script cannot target an unmarked production group."
  }
  if ($existingGroup.Trim() -eq "true") {
    if (-not $AllowExistingResourceGroup) {
      throw "Resource group $ResourceGroupName already exists. Use a new name or pass -AllowExistingResourceGroup for an intentional idempotent update."
    }
    $existingResourceGroup = Invoke-AzJson group show --name $ResourceGroupName
    if (
      $existingResourceGroup.tags.application -ne "Aurelia Agency AI Studio" -or
      $existingResourceGroup.tags.managedBy -ne "Bicep" -or
      $existingResourceGroup.tags.environment -ne "demo"
    ) {
      throw "Existing resource group $ResourceGroupName does not carry the expected Aurelia demo ownership tags and cannot be updated."
    }
  }

  if (-not $WhatIf) {
    $worktreeStatus = @(& git -C $repoRoot status --porcelain)
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to inspect the Git worktree."
    }
    if ($worktreeStatus.Count -gt 0) {
      throw "The worktree is dirty. Commit the intended source before provisioning so package creation cannot fail after Azure resources are created."
    }
  }

  if (-not $SkipTests) {
    Push-Location $repoRoot
    try {
      & npm ci
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
      & npm test
      if ($LASTEXITCODE -ne 0) { throw "npm test failed." }
      & npm run lint
      if ($LASTEXITCODE -ne 0) { throw "npm run lint failed." }
      & npm run verify:assets
      if ($LASTEXITCODE -ne 0) { throw "npm run verify:assets failed." }
    } finally {
      Pop-Location
    }
  }

  Ensure-ProviderRegistration "Microsoft.CognitiveServices" (-not [bool]$WhatIf)
  Ensure-ProviderRegistration "Microsoft.Web" (-not [bool]$WhatIf)

  Write-Host "Checking exact model versions, SKUs, and quota before provisioning..."
  $catalog = @(Invoke-AzJson cognitiveservices model list --location $Location)
  $usage = @(Invoke-AzJson cognitiveservices usage list --location $Location)
  Assert-ModelCapacity $catalog $usage "gpt-5.6-terra" "2026-07-09" "GlobalStandard" "OpenAI.GlobalStandard.gpt-5.6-terra" $GptCapacity
  if (-not $SkipMai) {
    Assert-ModelCapacity $catalog $usage "MAI-Image-2.5" "2026-06-02" "GlobalStandard" "AIServices.GlobalStandard.MAI-Image-2.5" $MaiCapacity
  }

  $authInput = @{ username = $PortalUsername; password = $plainPassword } | ConvertTo-Json -Compress
  $authProgram = @'
import { randomBytes } from "node:crypto";
import { createPortalCredentialHash } from "./src/portal-auth.js";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { username, password } = JSON.parse(input);
process.stdout.write(JSON.stringify({
  credentialHash: createPortalCredentialHash(username, password),
  sessionSecret: randomBytes(48).toString("base64url")
}));
'@
  Push-Location $repoRoot
  try {
    $authResultText = $authInput | & node --input-type=module -e $authProgram
  } finally {
    Pop-Location
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to generate portal authentication values."
  }
  $authResult = $authResultText | ConvertFrom-Json

  $parameterPath = [IO.Path]::GetTempFileName()
  @{
    '$schema' = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
    contentVersion = "1.0.0.0"
    parameters = @{
      resourceGroupName = @{ value = $ResourceGroupName }
      location = @{ value = $Location }
      baseName = @{ value = $BaseName }
      portalUsername = @{ value = $PortalUsername }
      portalCredentialHash = @{ value = $authResult.credentialHash }
      portalSessionSecret = @{ value = $authResult.sessionSecret }
      deployMai = @{ value = -not [bool]$SkipMai }
      gptCapacity = @{ value = $GptCapacity }
      maiCapacity = @{ value = $MaiCapacity }
    }
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $parameterPath -Encoding utf8NoBOM

  $deploymentName = "aurelia-agency-$(Get-Date -Format 'yyyyMMddHHmmss')"
  if ($WhatIf) {
    Write-Host "Running subscription deployment what-if; no resources will be changed."
    & az deployment sub what-if `
      --name $deploymentName `
      --location $Location `
      --template-file $templatePath `
      --parameters "@$parameterPath" `
      --result-format ResourceIdOnly
    if ($LASTEXITCODE -ne 0) {
      throw "Azure deployment what-if failed."
    }
    return
  }

  Write-Host "Provisioning a separate deployment in resource group $ResourceGroupName..."
  $deployment = Invoke-AzJson deployment sub create `
    --name $deploymentName `
    --location $Location `
    --template-file $templatePath `
    --parameters "@$parameterPath"

  $appName = $deployment.properties.outputs.appName.value
  $appUrl = $deployment.properties.outputs.appUrl.value
  if (-not $SkipApplicationDeploy) {
    & (Join-Path $PSScriptRoot "build-deployment-package.ps1") -OutputPath $packagePath
    if ($LASTEXITCODE -ne 0) {
      throw "Application package creation failed."
    }
    Write-Host "Deploying application package to $appName..."
    & az webapp deploy `
      --resource-group $ResourceGroupName `
      --name $appName `
      --src-path $packagePath `
      --type zip `
      --clean true `
      --restart true `
      --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Application ZIP deployment failed."
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
      try {
        $loginResponse = Invoke-WebRequest -Uri "$appUrl/login" -TimeoutSec 20 -SkipHttpErrorCheck
        if ($loginResponse.StatusCode -eq 200) {
          $ready = $true
          break
        }
      } catch {
        Start-Sleep -Seconds 10
      }
      Start-Sleep -Seconds 10
    }
    if (-not $ready) {
      throw "The portal did not become reachable at $appUrl/login."
    }

    $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
    Invoke-WebRequest `
      -Uri "$appUrl/auth/login" `
      -Method Post `
      -Body @{ username = $PortalUsername; password = $plainPassword } `
      -ContentType "application/x-www-form-urlencoded" `
      -WebSession $session `
      -TimeoutSec 30 | Out-Null
    $status = Invoke-RestMethod -Uri "$appUrl/api/status" -WebSession $session -TimeoutSec 30
    if (-not $status.gpt.configured -or $status.gpt.deployment -ne "gpt-5.6-terra") {
      throw "Portal is reachable, but GPT-5.6 Terra is not configured."
    }
    if (-not $SkipMai -and -not $status.mai.configured) {
      throw "Portal is reachable, but MAI-Image-2.5 is not configured."
    }
  }

  Write-Host ""
  Write-Host "Deployment complete."
  Write-Host "Resource group: $ResourceGroupName"
  Write-Host "App Service: $appName"
  Write-Host "Portal URL: $appUrl"
  Write-Host "Portal username: $PortalUsername"
} finally {
  if ($parameterPath -and (Test-Path -LiteralPath $parameterPath)) {
    Remove-Item -LiteralPath $parameterPath -Force
  }
  $plainPassword = $null
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}
