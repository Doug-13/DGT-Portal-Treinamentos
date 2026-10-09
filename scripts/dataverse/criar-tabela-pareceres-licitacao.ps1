<#
.SYNOPSIS
  Cria no Dataverse a tabela dgt_licitacaoparecer, usada pelo módulo
  Licitações do Portal DGT para registrar o parecer
  "Participar / Não participar" de cada edital, com justificativa.

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Cria:
    Tabela : dgt_licitacaoparecer (Parecer de licitação / Pareceres de licitação)
    Colunas: dgt_chaveedital, dgt_decisao, dgt_justificativa, dgt_orgao,
             dgt_local, dgt_modalidade, dgt_numeroedital, dgt_objeto,
             dgt_valorestimado, dgt_dataencerramento, dgt_aderencia,
             dgt_responsavelnome
    Chave alternativa: nenhuma (de propósito — cada decisão é um
             registro novo; o histórico do edital nunca é sobrescrito).

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/LicitacaoParecerService.ts

  LGPD: a tabela NÃO tem coluna de CNPJ nem de link do PNCP (o link
  contém o CNPJ do órgão).

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com
  (Power Apps > Configurações (engrenagem) > Detalhes da sessão > URL da instância)

.PARAMETER Solucao
  NOME (nome exclusivo) da solução, não o nome de exibição.
  (Power Apps > Soluções > coluna "Nome")

.PARAMETER Token
  Opcional. Token de acesso já obtido. Se não for informado, o script
  usa o módulo Az.Accounts (Connect-AzAccount) para obter um.

.EXAMPLE
  .\criar-tabela-pareceres-licitacao.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos
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

# ------------------------------------------------------------
# 1) Tabela
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_licitacaoparecer" -ForegroundColor Cyan

New-Tabela 'dgt_LicitacaoParecer' 'Parecer de licitação' 'Pareceres de licitação' 'Parecer da DGT (Participar / Não participar) sobre um edital do PNCP, com justificativa. Cada decisão é um registro novo (histórico).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas" -ForegroundColor Cyan

$T = 'dgt_licitacaoparecer'

New-Texto           $T 'dgt_ChaveEdital'       'Chave do edital' 400
New-Texto           $T 'dgt_Decisao'           'Decisão' 20
New-TextoLongo      $T 'dgt_Justificativa'     'Justificativa' 4000
New-Texto           $T 'dgt_Orgao'             'Órgão' 200
New-Texto           $T 'dgt_Local'             'Local' 200
New-Texto           $T 'dgt_Modalidade'        'Modalidade' 100
New-Texto           $T 'dgt_NumeroEdital'      'Número do edital' 100
New-TextoLongo      $T 'dgt_Objeto'            'Objeto' 4000
New-Decimal         $T 'dgt_ValorEstimado'     'Valor estimado (R$)'
New-DataHoraSemFuso $T 'dgt_DataEncerramento'  'Encerramento das propostas'
New-Inteiro         $T 'dgt_Aderencia'         'Aderência (%)'
New-Texto           $T 'dgt_ResponsavelNome'   'Responsável pelo parecer' 200

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando a tabela dgt_licitacaoparecer..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_licitacaoparecer</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança de quem usa o módulo Licitações:'
Write-Host '       dgt_licitacaoparecer -> Criar (Usuário) e Ler (ORGANIZAÇÃO).'
Write-Host '     Ler precisa ser no nível Organização para todos verem os pareceres'
Write-Host '     dados pelos colegas. NÃO conceda Gravar nem Excluir (histórico).'
Write-Host '  2. Administradores: Ler/Criar/Gravar/Excluir (Organização), se necessário.'
Write-Host '  3. Gere o pacote (npm run build) e publique o .sppkg.'
