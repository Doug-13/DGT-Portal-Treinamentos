<#
.SYNOPSIS
  Cria no Dataverse a Custom API da IA DOS DASHBOARDS:

    dgt_PerguntarDashboardIa  chamada pela caixa "Pergunte à IA"

.DESCRIPTION
  Não cria tabelas: a pergunta e a resposta NÃO são gravadas. Elas
  existem só na tela de quem perguntou e somem ao fechar a aba.

  Pode ser executado mais de uma vez. Se encontrar o que a versão
  anterior deste script criou (tabela dgt_dashboardperguntaia e a
  Custom API presa a ela), remove e recria a Custom API sem a tabela.

  Quem pode usar: quem tem LER em Dashboard (dgt_dashboard), ou seja,
  quem já vê as abas da página Indicadores.

  Os nomes DEVEM ser iguais aos de
    services/dashboards/assistenteDashboard.ts
    server/DGT.Treinamentos.Plugins/PerguntarDashboardIaPlugin.cs

.EXAMPLE
  .\scripts\dataverse\criar-ia-dashboards.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $Token
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.TrimEnd('/')
$Api = "$UrlAmbiente/api/data/v9.2"

# ------------------------------------------------------------
# Autenticação
# ------------------------------------------------------------

if (-not $Token) {

  if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    Write-Host 'Instalando o módulo Az.Accounts (apenas para o seu usuário)...' -ForegroundColor Yellow
    Install-Module Az.Accounts -Scope CurrentUser -Force -AllowClobber
  }

  Import-Module Az.Accounts

  if (-not (Get-AzContext)) {
    Connect-AzAccount | Out-Null
  }

  $resultadoToken = Get-AzAccessToken -ResourceUrl $UrlAmbiente

  if ($resultadoToken.Token -is [System.Security.SecureString]) {
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($resultadoToken.Token)
    try { $Token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  }
  else {
    $Token = $resultadoToken.Token
  }
}

$Cabecalhos = @{
  'Authorization'              = "Bearer $Token"
  'Accept'                     = 'application/json'
  'OData-MaxVersion'           = '4.0'
  'OData-Version'              = '4.0'
  'MSCRM.SolutionUniqueName'   = $Solucao
}

function Invoke-Dv {
  param([string] $Metodo, [string] $Caminho, $Corpo)

  $parametros = @{
    Method      = $Metodo
    Uri         = "$Api/$Caminho"
    Headers     = $Cabecalhos
    ContentType = 'application/json; charset=utf-8'
  }

  if ($null -ne $Corpo) {
    $json = $Corpo | ConvertTo-Json -Depth 30
    $parametros.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
  }

  Invoke-RestMethod @parametros
}

# Mensagem real devolvida pelo Dataverse (em vez de só "erro 400").
function Get-ErroDv {
  param($Registro)
  $texto = $null
  if ($Registro.ErrorDetails -and $Registro.ErrorDetails.Message) {
    $texto = $Registro.ErrorDetails.Message
    try {
      $json = $texto | ConvertFrom-Json
      if ($json.error.message) { $texto = $json.error.message }
    }
    catch { }
  }
  if (-not $texto) { $texto = $Registro.Exception.Message }
  return $texto
}

function Test-Existe {
  param([string] $Caminho)
  try {
    Invoke-Dv -Metodo 'GET' -Caminho $Caminho | Out-Null
    return $true
  }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 404) { return $false }
    throw
  }
}

# ------------------------------------------------------------
# Idioma base do ambiente (os rótulos precisam dele)
# ------------------------------------------------------------

$org = Invoke-Dv -Metodo 'GET' -Caminho 'organizations?$select=languagecode'
$Idioma = [int]$org.value[0].languagecode
Write-Host "Ambiente: $UrlAmbiente  |  Solução: $Solucao  |  Idioma base: $Idioma" -ForegroundColor Cyan

function Rotulo {
  param([string] $Texto)
  @{
    '@odata.type'   = 'Microsoft.Dynamics.CRM.Label'
    LocalizedLabels = @(
      @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'
        Label         = $Texto
        LanguageCode  = $Idioma
      }
    )
  }
}

# ------------------------------------------------------------
# Criadores
# ------------------------------------------------------------

function New-Tabela {
  param([string] $Schema, [string] $Nome, [string] $Plural, [string] $Descricao)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = tabela $logico já existe"
    return
  }

  Write-Host "  + criando tabela $logico..." -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'EntityDefinitions' -Corpo @{
    '@odata.type'          = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName             = $Schema
    DisplayName            = Rotulo $Nome
    DisplayCollectionName  = Rotulo $Plural
    Description            = Rotulo $Descricao
    OwnershipType          = 'UserOwned'
    IsActivity             = $false
    HasActivities          = $false
    HasNotes               = $false
    Attributes             = @(
      @{
        '@odata.type'  = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        SchemaName     = 'dgt_Name'
        IsPrimaryName  = $true
        RequiredLevel  = @{ Value = 'None' }
        MaxLength      = 200
        FormatName     = @{ Value = 'Text' }
        DisplayName    = Rotulo 'Nome'
      }
    )
  } | Out-Null
}

function New-Coluna {
  param([string] $Tabela, [string] $Schema, [hashtable] $Corpo)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }

  Write-Host "  + $Tabela.$logico" -ForegroundColor Green

  $Corpo.SchemaName = $Schema
  $Corpo.RequiredLevel = @{ Value = 'None' }

  Invoke-Dv -Metodo 'POST' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes" -Corpo $Corpo | Out-Null
}

function New-Texto {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
  }
}

function New-TextoLongo {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    Format        = 'TextArea'
  }
}

function New-Inteiro {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Format        = 'None'
    MinValue      = -2147483648
    MaxValue      = 2147483647
  }
}

function New-SimNao {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [bool] $Padrao = $false)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
    DisplayName   = Rotulo $Nome
    DefaultValue  = $Padrao
    OptionSet     = @{
      '@odata.type'  = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
      OptionSetType  = 'Boolean'
      TrueOption     = @{ Value = 1; Label = Rotulo 'Sim' }
      FalseOption    = @{ Value = 0; Label = Rotulo 'Não' }
    }
  }
}

function New-DataHora {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateAndTime'
    DateTimeBehavior = @{ Value = 'UserLocal' }
  }
}

function New-Decimal {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 2
    MinValue      = 0
    MaxValue      = 100000000000
  }
}

# ------------------------------------------------------------
# 1) Privilégio exigido: Ler em dgt_dashboard
# ------------------------------------------------------------

Write-Host "`n1) Privilégio de leitura de Dashboard" -ForegroundColor Cyan

$privilegio = $null
$candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'prvReaddgt_')"
foreach ($item in $candidatos.value) {
  if ($item.name.ToLower() -eq 'prvreaddgt_dashboard') { $privilegio = $item.name }
}

if (-not $privilegio) {
  throw 'Privilégio de Ler em dgt_dashboard não encontrado. A tabela de dashboards existe neste ambiente? (scripts/dataverse/criar-tabela-dashboards.ps1)'
}

Write-Host "  · privilégio exigido: $privilegio"

# ------------------------------------------------------------
# 2) Limpeza do que a versão anterior criou (se existir)
# ------------------------------------------------------------

Write-Host "`n2) Verificando a versão anterior" -ForegroundColor Cyan

$consultaApi = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid,executeprivilegename&`$filter=uniquename eq 'dgt_PerguntarDashboardIa'"
$apiExistente = if ($consultaApi.value.Count -gt 0) { $consultaApi.value[0] } else { $null }

if ($apiExistente -and $apiExistente.executeprivilegename -ne $privilegio) {
  # Não apaga a API: só troca o privilégio exigido (campo alterável).
  Write-Host "  ~ ajustando a Custom API: $($apiExistente.executeprivilegename) -> $privilegio" -ForegroundColor Yellow
  try {
    Invoke-Dv -Metodo 'PATCH' -Caminho "customapis($($apiExistente.customapiid))" -Corpo @{
      executeprivilegename = $privilegio
    } | Out-Null
  }
  catch {
    Write-Host "  ! O Dataverse recusou a alteração:" -ForegroundColor Red
    Write-Host ("    " + (Get-ErroDv $_)) -ForegroundColor Red
    throw 'Copie a mensagem acima e envie para análise.'
  }
}

if (Test-Existe "EntityDefinitions(LogicalName='dgt_dashboardperguntaia')?`$select=LogicalName") {
  Write-Host "  - removendo a tabela dgt_dashboardperguntaia (não é mais usada)..." -ForegroundColor Yellow
  try {
    Invoke-Dv -Metodo 'DELETE' -Caminho "EntityDefinitions(LogicalName='dgt_dashboardperguntaia')" | Out-Null
  }
  catch {
    # Não impede o restante: a tabela vazia não atrapalha a IA.
    Write-Host "  ! Não foi possível remover a tabela agora (pode removê-la depois pelo make.powerapps.com):" -ForegroundColor Yellow
    Write-Host ("    " + (Get-ErroDv $_)) -ForegroundColor Yellow
  }
}
else {
  Write-Host "  = nada a remover"
}

# ------------------------------------------------------------
# 3) Custom API dgt_PerguntarDashboardIa (portal → plugin → Claude)
# ------------------------------------------------------------
# Sem plugin vinculado: PerguntarDashboardIaPlugin é registrado como
# PASSO (PostOperation) na mensagem desta API, para a chave ficar na
# "Configuração segura" do passo.

Write-Host "`n3) Custom API dgt_PerguntarDashboardIa" -ForegroundColor Cyan

if ($apiExistente) {
  Write-Host "  = Custom API já existe"
}
else {
  $corpoApi = @{
    uniquename                      = 'dgt_PerguntarDashboardIa'
    name                            = 'dgt_PerguntarDashboardIa'
    displayname                     = 'Perguntar à IA do dashboard'
    description                     = 'Envia a pergunta e os dados do painel ao Claude, com o escopo do dashboard (chave no passo do plugin PerguntarDashboardIaPlugin). Nada é gravado.'
    bindingtype                     = 0
    isfunction                      = $false
    isprivate                       = $false
    allowedcustomprocessingsteptype = 2
    executeprivilegename            = $privilegio
    CustomAPIRequestParameters      = @(
      @{
        uniquename  = 'PayloadJson'
        name        = 'PayloadJson'
        displayname = 'PayloadJson'
        description = 'Dashboard, pergunta, dados e histórico da conversa na tela (JSON).'
        type        = 10
        isoptional  = $false
      }
    )
    CustomAPIResponseProperties     = @(
      @{
        uniquename  = 'ResultadoJson'
        name        = 'ResultadoJson'
        displayname = 'ResultadoJson'
        description = 'Resposta da IA (JSON).'
        type        = 10
      }
    )
  }

  Write-Host "  + criando Custom API..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo $corpoApi | Out-Null
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximo passo:' -ForegroundColor Green
Write-Host '  Plugin Registration Tool: Update do assembly (novo tipo PerguntarDashboardIaPlugin) e'
Write-Host '  Register New Step: Message dgt_PerguntarDashboardIa, PostOperation, Synchronous,'
Write-Host '  Secure Configuration = a chave do Claude (só ali).'
Write-Host '  Permissão: quem tem Ler em Dashboard já pode perguntar (nenhum perfil novo).'
