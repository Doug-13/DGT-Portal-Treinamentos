<#
.SYNOPSIS
  Cria no Dataverse a tabela dgt_treinamentorevisao (revisões de
  treinamento) e a opção "Revisão de treinamento" na origem da
  atribuição (dgt_usuariotreinamento.dgt_origem).

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Cria:
    Tabela : dgt_treinamentorevisao (Revisão de treinamento)
    Lookup : dgt_treinamento → dgt_treinamento
    Colunas: dgt_numero, dgt_datavigencia, dgt_motivo,
             dgt_descricaoalteracoes, dgt_requerretreinamento,
             dgt_justificativa, dgt_prazodias, dgt_usuariosimpactados,
             dgt_atribuicoescriadas, dgt_responsavelnome
    Opção  : "Revisão de treinamento" em dgt_usuariotreinamento.dgt_origem
             (somente se a coluna for do tipo Escolha)

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/TreinamentoRevisaoService.ts

.EXAMPLE
  .\criar-tabela-revisoes-treinamento.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# ------------------------------------------------------------
# 1) Tabela
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_treinamentorevisao" -ForegroundColor Cyan

New-Tabela 'dgt_TreinamentoRevisao' 'Revisão de treinamento' 'Revisões de treinamento' 'Revisão (versão) de um treinamento, com motivo, alterações e decisão de retreinamento. Nunca é apagada (histórico).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas" -ForegroundColor Cyan

$T = 'dgt_treinamentorevisao'

New-Lookup     $T 'dgt_Treinamento'            'Treinamento' 'dgt_treinamento' 'dgt_treinamento_dgt_treinamentorevisao'
New-Inteiro    $T 'dgt_Numero'                 'Número da revisão'
New-DataHora   $T 'dgt_DataVigencia'           'Data de vigência'
New-TextoLongo $T 'dgt_Motivo'                 'Motivo da revisão' 4000
New-TextoLongo $T 'dgt_DescricaoAlteracoes'    'Descrição das alterações' 4000
New-SimNao     $T 'dgt_RequerRetreinamento'    'Requer retreinamento' $false
New-TextoLongo $T 'dgt_Justificativa'          'Justificativa (sem retreinamento)' 4000
New-Inteiro    $T 'dgt_PrazoDias'              'Prazo do retreinamento (dias)'
New-Inteiro    $T 'dgt_UsuariosImpactados'     'Colaboradores impactados'
New-Inteiro    $T 'dgt_AtribuicoesCriadas'     'Atribuições criadas'
New-Texto      $T 'dgt_ResponsavelNome'        'Responsável pela revisão' 200

# ------------------------------------------------------------
# 3) Opção "Revisão de treinamento" na origem da atribuição
# ------------------------------------------------------------

Write-Host "`n3) Origem da atribuição" -ForegroundColor Cyan

$RotuloOrigem = 'Revisão de treinamento'

try {
  $attr = Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_usuariotreinamento')/Attributes(LogicalName='dgt_origem')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet,GlobalOptionSet"

  $conjunto = if ($attr.GlobalOptionSet) { $attr.GlobalOptionSet } else { $attr.OptionSet }

  $existe = $false
  foreach ($op in $conjunto.Options) {
    foreach ($rot in $op.Label.LocalizedLabels) {
      if ($rot.Label -eq $RotuloOrigem) { $existe = $true }
    }
  }

  if ($existe) {
    Write-Host "  = opção '$RotuloOrigem' já existe"
  }
  else {
    Write-Host "  + opção '$RotuloOrigem'" -ForegroundColor Green

    $corpo = @{ Label = Rotulo $RotuloOrigem; SolutionUniqueName = $Solucao }

    if ($attr.GlobalOptionSet) {
      $corpo.OptionSetName = $attr.GlobalOptionSet.Name
    }
    else {
      $corpo.EntityLogicalName = 'dgt_usuariotreinamento'
      $corpo.AttributeLogicalName = 'dgt_origem'
    }

    Invoke-Dv -Metodo 'POST' -Caminho 'InsertOptionValue' -Corpo $corpo | Out-Null
  }
}
catch {
  Write-Host "  = dgt_origem não é do tipo Escolha (ou não existe): nada a fazer." -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n4) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_treinamentorevisao</entity><entity>dgt_usuariotreinamento</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança:'
Write-Host '       Colaboradores  -> dgt_treinamentorevisao: Ler (Organização)'
Write-Host '                         (a tela Certificados mostra a revisão do treinamento).'
Write-Host '       Admin/Editores -> dgt_treinamentorevisao: Criar, Ler, Gravar (Organização).'
Write-Host '                         NÃO conceda Excluir (histórico).'
Write-Host '  2. Recompile e atualize o plugin DGT.Treinamentos.Plugins (Plugin Registration Tool).'
Write-Host '  3. Gere a versão do portal (Gerar-Versao.ps1) e publique o .sppkg.'
