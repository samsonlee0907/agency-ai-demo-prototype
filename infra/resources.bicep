@description('Azure region for all resources.')
param location string

@description('Globally unique App Service app name.')
param appName string

@description('App Service plan name.')
param appServicePlanName string

@description('Globally unique Foundry account name.')
param aiAccountName string

@secure()
param portalCredentialHash string

@secure()
param portalSessionSecret string

param deployMai bool
param gptModelVersion string
param gptCapacity int
param maiModelVersion string
param maiCapacity int
param tags object

var gptDeploymentName = 'gpt-5.6-terra'
var maiDeploymentName = 'MAI-Image-2.5'
var cognitiveServicesUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'a97b65f3-24c7-4388-baec-2e87135dc908'
)

resource aiAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: aiAccountName
  location: location
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: aiAccountName
    disableLocalAuth: true
    dynamicThrottlingEnabled: false
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
  tags: tags
}

resource gptDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  name: gptDeploymentName
  parent: aiAccount
  sku: {
    name: 'GlobalStandard'
    capacity: gptCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-5.6-terra'
      version: gptModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

resource maiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = if (deployMai) {
  name: maiDeploymentName
  parent: aiAccount
  sku: {
    name: 'GlobalStandard'
    capacity: maiCapacity
  }
  properties: {
    model: {
      format: 'Microsoft'
      name: 'MAI-Image-2.5'
      version: maiModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
  tags: tags
}

resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    serverFarmId: appServicePlan.id
    siteConfig: {
      alwaysOn: true
      ftpsState: 'Disabled'
      http20Enabled: true
      linuxFxVersion: 'NODE|20-lts'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'MODEL_MODE'
          value: 'live'
        }
        {
          name: 'GPT_ENDPOINT'
          value: 'https://${aiAccount.name}.openai.azure.com/openai/v1/'
        }
        {
          name: 'GPT_AUTH_MODE'
          value: 'entra'
        }
        {
          name: 'GPT_DEPLOYMENT'
          value: gptDeployment.name
        }
        {
          name: 'GPT_API_KEY'
          value: ''
        }
        {
          name: 'MAI_ENDPOINT'
          value: deployMai ? 'https://${aiAccount.name}.services.ai.azure.com' : ''
        }
        {
          name: 'MAI_AUTH_MODE'
          value: 'entra'
        }
        {
          name: 'MAI_MODEL'
          value: maiDeploymentName
        }
        {
          name: 'MAI_API_KEY'
          value: ''
        }
        {
          name: 'PORTAL_CREDENTIAL_HASH'
          value: portalCredentialHash
        }
        {
          name: 'PORTAL_SESSION_SECRET'
          value: portalSessionSecret
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'WEBSITE_HTTPLOGGING_RETENTION_DAYS'
          value: '3'
        }
      ]
    }
  }
  tags: tags
}

resource modelInferenceRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiAccount.id, webApp.id, cognitiveServicesUserRoleDefinitionId)
  scope: aiAccount
  properties: {
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesUserRoleDefinitionId
  }
}

output appName string = webApp.name
output appUrl string = 'https://${webApp.properties.defaultHostName}'
output aiAccountName string = aiAccount.name
output gptDeployment string = gptDeployment.name
output maiDeployment string = deployMai ? maiDeploymentName : ''
