<#
.SYNOPSIS
  Cria no Dataverse a CONFIGURAÇÃO DE INTEGRAÇÕES do portal, no mesmo
  padrão da chave da IA (criar-ia-administracao.ps1):

    dgt_integracaoconfiguracao   uma linha por integração (ex.: CIGAM-BOM):
                                 endereço, ambiente e o SEGREDO numa coluna
                                 PROTEGIDA (o portal nunca a lê)
    dgt_GerenciarIntegracao      Custom API para salvar / verificar / remover
                                 o segredo e salvar o endereço

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido.
  O segredo NÃO passa por este script: é informado depois, no portal
  (menu do usuário › Integrações), por um Administrador.

  Os nomes DEVEM ser iguais aos de
    server/DGT.Treinamentos.Plugins/IntegracaoComum.cs e GerenciarIntegracaoPlugin.cs
    services/integracoes/IntegracaoAdminService.ts

.EXAMPLE
  .\scripts\dataverse\criar-integracoes-configuracao.ps1 -UrlAmbiente https://<org>.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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
# 1) Tabela de configuração das integrações
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_integracaoconfiguracao" -ForegroundColor Cyan

New-Tabela 'dgt_IntegracaoConfiguracao' 'Configuração de integração' 'Configurações de integrações' 'Endereço, ambiente e segredo (coluna protegida) de cada integração externa do portal. O portal nunca lê o segredo.'

$C = 'dgt_integracaoconfiguracao'

New-Texto          $C 'dgt_Descricao'              'Descrição' 300
New-Texto          $C 'dgt_Url'                    'Endereço (URL)' 500
New-Texto          $C 'dgt_Ambiente'               'Ambiente' 100
New-TextoProtegido $C 'dgt_Segredo'                'Segredo (protegido)' 2000
New-Texto          $C 'dgt_SegredoFinal'           'Final do segredo' 10
New-DataHora       $C 'dgt_SegredoAtualizadoEm'    'Segredo atualizado em'
New-Texto          $C 'dgt_SegredoAtualizadoPor'   'Segredo atualizado por' 200

# ------------------------------------------------------------
# 2) Publicação
# ------------------------------------------------------------

Write-Host "`n2) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_integracaoconfiguracao</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 3) Registro inicial CIGAM-BOM (sem segredo e sem endereço)
# ------------------------------------------------------------

Write-Host "`n3) Registro CIGAM-BOM" -ForegroundColor Cyan

$conjunto = (Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_integracaoconfiguracao')?`$select=EntitySetName").EntitySetName
$existente = Invoke-Dv -Metodo 'GET' -Caminho "$($conjunto)?`$select=dgt_integracaoconfiguracaoid&`$filter=dgt_name eq 'CIGAM-BOM'"
if ($existente.value.Count -gt 0) {
  Write-Host "  = registro CIGAM-BOM já existe (mantido)"
}
else {
  Write-Host "  + criando registro CIGAM-BOM" -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho $conjunto -Corpo @{
    dgt_name      = 'CIGAM-BOM'
    dgt_descricao = 'Lançamento do B.O.M. no CIGAM (webhook MAAX) — plugin EnviarBomCigamPlugin'
    dgt_ambiente  = 'Homologação'
  } | Out-Null
}

# ------------------------------------------------------------
# 4) Custom API dgt_GerenciarIntegracao
# ------------------------------------------------------------

Write-Host "`n4) Custom API dgt_GerenciarIntegracao" -ForegroundColor Cyan

$privilegio = Get-Privilegio 'prvWritedgt_' 'prvwritedgt_integracaoconfiguracao'
if (-not $privilegio) {
  throw 'Privilégio de Gravar em dgt_integracaoconfiguracao ainda não apareceu (a tabela acabou de ser criada). Espere alguns minutos e rode o script de novo.'
}
Write-Host "  · privilégio exigido: $privilegio"

$consulta = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_GerenciarIntegracao'"
if ($consulta.value.Count -gt 0) {
  Write-Host "  = Custom API já existe"
}
else {
  Write-Host "  + criando Custom API..." -ForegroundColor Green
  try {
    Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo @{
      uniquename                      = 'dgt_GerenciarIntegracao'
      name                            = 'dgt_GerenciarIntegracao'
      displayname                     = 'Gerenciar integração'
      description                     = 'Salva, verifica ou remove o segredo de uma integração e salva o endereço (plugin GerenciarIntegracaoPlugin). O segredo nunca volta ao navegador.'
      bindingtype                     = 0
      isfunction                      = $false
      isprivate                       = $false
      allowedcustomprocessingsteptype = 2
      executeprivilegename            = $privilegio
      CustomAPIRequestParameters      = @(
        @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Ação, integração e valores (JSON).'; type = 10; isoptional = $false }
      )
      CustomAPIResponseProperties     = @(
        @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Resultado (JSON).'; type = 10 }
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
Write-Host '  1. Perfil de segurança Administradores: dgt_integracaoconfiguracao -> Criar, Ler e Gravar (nível Organização).'
Write-Host '     NÃO dê acesso a Colaboradores nem Gestores. O EnviarBomCigamPlugin lê como SYSTEM.'
Write-Host '  2. Plugin Registration Tool: Update do assembly e Register New Step:'
Write-Host '       Message dgt_GerenciarIntegracao, Primary Entity none, PostOperation, Synchronous (sem Configuração segura).'
Write-Host '  3. Portal: menu do usuário › Integrações › CIGAM-BOM › endereço e segredo.'
