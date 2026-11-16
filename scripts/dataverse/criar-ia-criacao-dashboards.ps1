<#
.SYNOPSIS
  Prepara o Dataverse para a CRIAÇÃO DE DASHBOARDS COM IA no portal:

    dgt_dashboard.dgt_pessoal   dashboard pessoal (só o dono vê) ou publicado
    dgt_GerarDashboardIa        Custom API chamada por Indicadores › ✦ Criar com IA

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido.

  Dashboards pessoais: a tabela dgt_dashboard é "de usuário" (UserOwned).
  Com Criar/Gravar/Excluir no nível USUÁRIO, cada pessoa só altera ou
  exclui os PRÓPRIOS dashboards; o portal mostra os pessoais só ao dono.

  A Custom API exige Criar em dgt_dashboard (quem pode criar dashboards).

.EXAMPLE
  .\scripts\dataverse\criar-ia-criacao-dashboards.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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
  param([string] $Schema, [string] $Nome, [string] $Plural, [string] $Descricao, [string] $Propriedade = 'OrganizationOwned')

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
    OwnershipType          = $Propriedade
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

# Texto com SEGURANÇA DE COLUNA (sem perfil de leitura: só SYSTEM/admin do sistema).
function New-TextoProtegido {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
    IsSecured     = $true
  }
}

function New-DecimalPreciso {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Casas)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = $Casas
    MinValue      = 0
    MaxValue      = 100000000000
  }
}

function New-LookupUsuarioSistema {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Relacionamento)

  $logico = $Schema.ToLower()
  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }
  Write-Host "  + $Tabela.$logico (lookup → systemuser)" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'RelationshipDefinitions' -Corpo @{
    '@odata.type'        = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName           = $Relacionamento
    ReferencedEntity     = 'systemuser'
    ReferencingEntity    = $Tabela
    CascadeConfiguration = @{
      Assign = 'NoCascade'; Delete = 'RemoveLink'; Merge = 'NoCascade'
      Reparent = 'NoCascade'; Share = 'NoCascade'; Unshare = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName    = $Schema
      DisplayName   = Rotulo $Nome
      RequiredLevel = @{ Value = 'None' }
    }
  } | Out-Null
}

function Get-Privilegio {
  param([string] $Prefixo, [string] $NomeMinusculo)
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'$Prefixo')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq $NomeMinusculo) { return $item.name }
  }
  return $null
}


# ------------------------------------------------------------
# 1) Coluna "Pessoal" no dashboard
# ------------------------------------------------------------

Write-Host "`n1) Coluna dgt_dashboard.dgt_pessoal" -ForegroundColor Cyan

New-SimNao 'dgt_dashboard' 'dgt_Pessoal' 'Pessoal (só o dono vê)' $false

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_dashboard</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 2) Custom API dgt_GerarDashboardIa
# ------------------------------------------------------------

Write-Host "`n2) Custom API dgt_GerarDashboardIa" -ForegroundColor Cyan

$privilegioCriar = Get-Privilegio 'prvCreatedgt_' 'prvcreatedgt_dashboard'
if (-not $privilegioCriar) {
  throw 'Privilégio de Criar em dgt_dashboard não encontrado (a tabela de dashboards existe neste ambiente?).'
}
Write-Host "  · privilégio exigido: $privilegioCriar"

$consultaGerar = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_GerarDashboardIa'"

if ($consultaGerar.value.Count -gt 0) {
  Write-Host "  = Custom API já existe"
}
else {
  Write-Host "  + criando Custom API..." -ForegroundColor Green
  try {
    Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo @{
      uniquename                      = 'dgt_GerarDashboardIa'
      name                            = 'dgt_GerarDashboardIa'
      displayname                     = 'Gerar dashboard com IA'
      description                     = 'Cria ou ajusta a definição de um dashboard do portal a partir de uma descrição (plugin GerarDashboardIaPlugin). Não envia dados de registros à IA.'
      bindingtype                     = 0
      isfunction                      = $false
      isprivate                       = $false
      allowedcustomprocessingsteptype = 2
      executeprivilegename            = $privilegioCriar
      CustomAPIRequestParameters      = @(
        @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Pedido, catálogo permitido, painel atual e erros (JSON).'; type = 10; isoptional = $false }
      )
      CustomAPIResponseProperties     = @(
        @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Resumo e definição gerada (JSON).'; type = 10 }
      )
    } | Out-Null
  }
  catch {
    Write-Host ("  ! " + (Get-ErroDv $_)) -ForegroundColor Red
    throw 'Não foi possível criar a Custom API (mensagem acima).'
  }
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança de quem vai criar dashboards pessoais (ex.: Colaboradores e Gestores):'
Write-Host '       dgt_dashboard -> Criar, Gravar, Excluir e Acrescentar: nível USUÁRIO; Ler: ORGANIZAÇÃO.'
Write-Host '     (Administradores de dashboards: Gravar/Excluir em nível Organização, para publicar.)'
Write-Host '  2. Plugin Registration Tool: Update do assembly e Register New Step:'
Write-Host '       Message dgt_GerarDashboardIa, Primary Entity none, PostOperation, Synchronous,'
Write-Host '       sem Configuração segura e com "Delete AsyncOperation" DESMARCADO.'
