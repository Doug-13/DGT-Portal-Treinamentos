<#
.SYNOPSIS
  Cria a Custom API dgt_BaixarArquivoPncp, ligada ao plugin
  BaixarArquivoPncpPlugin: baixa pelo SERVIDOR os documentos do PNCP
  (o navegador é bloqueado pelo cabeçalho CORS duplicado do PNCP) para
  o portal gravar na pasta do edital no SharePoint.

.DESCRIPTION
  ANTES: compilar o plugin e dar Update no assembly no Plugin
  Registration Tool (o tipo BaixarArquivoPncpPlugin precisa existir).
  Não é preciso registrar passo.

.EXAMPLE
  .\scripts\dataverse\criar-api-baixar-arquivo-pncp.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# Data/hora "independente de fuso": grava o horário de Brasília
# exatamente como o PNCP informa (sem conversão).
function New-DataHoraSemFuso {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateAndTime'
    DateTimeBehavior = @{ Value = 'TimeZoneIndependent' }
  }
}

# Lookup (relacionamento 1:N) para outra tabela
function New-Lookup {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Referenciada, [string] $Relacionamento)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }

  Write-Host "  + $Tabela.$logico (lookup → $Referenciada)" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'RelationshipDefinitions' -Corpo @{
    '@odata.type'        = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName           = $Relacionamento
    ReferencedEntity     = $Referenciada
    ReferencingEntity    = $Tabela
    CascadeConfiguration = @{
      Assign   = 'NoCascade'
      Delete   = 'RemoveLink'
      Merge    = 'NoCascade'
      Reparent = 'NoCascade'
      Share    = 'NoCascade'
      Unshare  = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName    = $Schema
      DisplayName   = Rotulo $Nome
      RequiredLevel = @{ Value = 'None' }
    }
  } | Out-Null
}

# Data sem hora (não muda com o fuso do usuário)
function New-SomenteData {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateOnly'
    DateTimeBehavior = @{ Value = 'DateOnly' }
  }
}

# Texto longo com SEGURANÇA DE CAMPO (coluna protegida)
function New-TextoLongoSeguro {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    Format        = 'TextArea'
    IsSecured     = $true
  }
}

# Custom API { PayloadJson } -> { ResultadoJson }, executada por quem
# tem o privilégio informado (o nome exato é buscado no ambiente).
function New-CustomApiJson {
  param([string] $Nome, [string] $Exibicao, [string] $Descricao, [string] $PrivilegioMinusculo)

  $existe = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq '$Nome'"
  if ($existe.value.Count -gt 0) {
    Write-Host "  = Custom API $Nome já existe"
    return
  }

  $privilegio = $null
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'prvWritedgt_')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq $PrivilegioMinusculo) { $privilegio = $item.name }
  }

  $corpo = @{
    uniquename                      = $Nome
    name                            = $Nome
    displayname                     = $Exibicao
    description                     = $Descricao
    bindingtype                     = 0
    isfunction                      = $false
    isprivate                       = $false
    allowedcustomprocessingsteptype = 2
    CustomAPIRequestParameters      = @(
      @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Entrada (JSON).'; type = 10; isoptional = $true }
    )
    CustomAPIResponseProperties     = @(
      @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Resultado (JSON).'; type = 10 }
    )
  }

  if ($privilegio) {
    $corpo.executeprivilegename = $privilegio
    Write-Host "  · $Nome exige o privilégio $privilegio"
  }
  else {
    Write-Host "  ! privilégio $PrivilegioMinusculo não encontrado; $Nome será criada sem essa restrição." -ForegroundColor Yellow
  }

  Write-Host "  + criando Custom API $Nome..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo $corpo | Out-Null
}

Write-Host "`n1) Plugin BaixarArquivoPncpPlugin" -ForegroundColor Cyan

$tipos = Invoke-Dv -Metodo 'GET' -Caminho "plugintypes?`$select=plugintypeid,typename&`$filter=typename eq 'DGT.Treinamentos.Plugins.BaixarArquivoPncpPlugin'"

if ($tipos.value.Count -eq 0) {
  Write-Host "  ! O plugin BaixarArquivoPncpPlugin ainda não está no Dataverse." -ForegroundColor Red
  Write-Host "    Compile o plugin (dotnet build -c Release) e dê Update no assembly no Plugin Registration Tool; depois rode este script de novo." -ForegroundColor Red
  exit 1
}

$idTipo = $tipos.value[0].plugintypeid
Write-Host "  · encontrado ($idTipo)"

Write-Host "`n2) Custom API dgt_BaixarArquivoPncp" -ForegroundColor Cyan

$existe = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_BaixarArquivoPncp'"

if ($existe.value.Count -gt 0) {
  Write-Host "  = já existe"
}
else {
  $privilegio = $null
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'prvWritedgt_')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq 'prvwritedgt_licitacaoacompanhamento') { $privilegio = $item.name }
  }

  $corpo = @{
    uniquename                      = 'dgt_BaixarArquivoPncp'
    name                            = 'dgt_BaixarArquivoPncp'
    displayname                     = 'Baixar arquivo do PNCP'
    description                     = 'Baixa pelo servidor um documento do PNCP para gravar na pasta do edital (plugin BaixarArquivoPncpPlugin).'
    bindingtype                     = 0
    isfunction                      = $false
    isprivate                       = $false
    allowedcustomprocessingsteptype = 0
    'PluginTypeId@odata.bind'       = "/plugintypes($idTipo)"
    CustomAPIRequestParameters      = @(
      @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Entrada (JSON).'; type = 10; isoptional = $false }
    )
    CustomAPIResponseProperties     = @(
      @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Arquivo em Base64 (JSON).'; type = 10 }
    )
  }

  if ($privilegio) {
    $corpo.executeprivilegename = $privilegio
    Write-Host "  · exige o privilégio $privilegio"
  }

  Write-Host "  + criando Custom API..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo $corpo | Out-Null
}

Write-Host "`nConcluído. Não é preciso registrar passo: a API já chama o plugin." -ForegroundColor Green
