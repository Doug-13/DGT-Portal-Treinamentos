<#
.SYNOPSIS
  Cria no Dataverse o ACOMPANHAMENTO DE LICITAÇÕES:

    dgt_licitacaoacompanhamento  um registro por edital acompanhado
    dgt_licitacaoalteracao       linha do tempo das alterações
    Custom API dgt_AcompanharLicitacao       (criptografa o identificador)
    Custom API dgt_AtualizarAcompanhamentos  (verificação automática)

.DESCRIPTION
  Pode ser executado mais de uma vez: só cria o que falta.

  LGPD / regra da DGT: o identificador do PNCP (que contém o CNPJ do
  órgão) só é gravado CRIPTOGRAFADO pelo plugin, na coluna
  dgt_identificadorcripto, criada com SEGURANÇA DE CAMPO (não aparece
  para usuários, relatórios nem Power BI).

  Os nomes DEVEM ser iguais aos de
    services/licitacoes/AcompanhamentoLicitacaoService.ts
    server/DGT.Treinamentos.Plugins/AcompanhamentoLicitacaoPlugin.cs

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-acompanhamento-licitacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# ------------------------------------------------------------
# 1) Acompanhamentos
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_licitacaoacompanhamento" -ForegroundColor Cyan

New-Tabela 'dgt_LicitacaoAcompanhamento' 'Acompanhamento de licitação' 'Acompanhamentos de licitações' 'Edital do PNCP acompanhado pela DGT, com a última foto dos dados (sem CNPJ).'

$T = 'dgt_licitacaoacompanhamento'

New-Texto             $T 'dgt_ChaveEdital'              'Chave do edital' 400
New-Texto             $T 'dgt_Orgao'                    'Órgão' 200
New-Texto             $T 'dgt_Local'                    'Local' 200
New-Texto             $T 'dgt_Modalidade'               'Modalidade' 100
New-Texto             $T 'dgt_NumeroEdital'             'Número do edital' 100
New-TextoLongo        $T 'dgt_Objeto'                   'Objeto' 4000
New-Texto             $T 'dgt_Situacao'                 'Situação' 200
New-Decimal           $T 'dgt_ValorEstimado'            'Valor estimado (R$)'
New-Texto             $T 'dgt_DataAbertura'             'Abertura das propostas' 30
New-Texto             $T 'dgt_DataEncerramento'         'Encerramento das propostas' 30
New-TextoLongo        $T 'dgt_SnapshotJson'             'Última foto (JSON)' 100000
New-TextoLongoSeguro  $T 'dgt_IdentificadorCripto'      'Identificador PNCP (criptografado)' 2000
New-SimNao            $T 'dgt_MonitoramentoAutomatico'  'Verificação automática' $false
New-SimNao            $T 'dgt_Ativo'                    'Ativo' $true
New-DataHora          $T 'dgt_UltimaVerificacao'        'Última verificação'
New-Texto             $T 'dgt_ResponsavelNome'          'Responsável' 200

# ------------------------------------------------------------
# 2) Alterações (linha do tempo)
# ------------------------------------------------------------

Write-Host "`n2) Tabela dgt_licitacaoalteracao" -ForegroundColor Cyan

New-Tabela 'dgt_LicitacaoAlteracao' 'Alteração de licitação' 'Alterações de licitações' 'O que mudou num edital acompanhado (situação, datas, valor, documentos, itens). Nunca é apagada.'

$L = 'dgt_licitacaoalteracao'

New-Lookup     $L 'dgt_Acompanhamento'  'Acompanhamento' 'dgt_licitacaoacompanhamento' 'dgt_licitacaoacompanhamento_dgt_licitacaoalteracao'
New-Texto      $L 'dgt_ChaveEdital'     'Chave do edital' 400
New-Texto      $L 'dgt_Tipo'            'Tipo' 50
New-TextoLongo $L 'dgt_Descricao'       'Descrição' 2000
New-TextoLongo $L 'dgt_ValorAnterior'   'Valor anterior' 4000
New-TextoLongo $L 'dgt_ValorNovo'       'Valor novo' 4000
New-Texto      $L 'dgt_Origem'          'Origem' 20
New-SimNao     $L 'dgt_Lida'            'Lida' $false

# ------------------------------------------------------------
# 3) Custom APIs
# ------------------------------------------------------------

Write-Host "`n3) Custom APIs" -ForegroundColor Cyan

New-CustomApiJson 'dgt_AcompanharLicitacao' 'Acompanhar licitação' 'Criptografa e guarda o identificador do PNCP de um edital acompanhado (plugin AcompanhamentoLicitacaoPlugin).' 'prvwritedgt_licitacaoacompanhamento'
New-CustomApiJson 'dgt_AtualizarAcompanhamentos' 'Atualizar acompanhamentos' 'Verifica no PNCP os editais acompanhados e registra as alterações (plugin AcompanhamentoLicitacaoPlugin).' 'prvwritedgt_licitacaoacompanhamento'

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n4) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_licitacaoacompanhamento</entity><entity>dgt_licitacaoalteracao</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos (ver docs/acompanhamento-licitacoes.md):' -ForegroundColor Green
Write-Host '  1. Perfis de quem usa Licitações: Acompanhamento -> Criar, Ler, Gravar; Alteração -> Criar, Ler, Gravar.'
Write-Host '  2. FASE 2: compilar o plugin, Update no assembly e registrar 2 passos do AcompanhamentoLicitacaoPlugin'
Write-Host '     (dgt_AcompanharLicitacao e dgt_AtualizarAcompanhamentos) com a MESMA chave de criptografia.'
Write-Host '  3. FASE 2: fluxo diário no Power Automate chamando dgt_AtualizarAcompanhamentos.'
