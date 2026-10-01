<#
.SYNOPSIS
  Cria no Dataverse as tabelas e colunas do fluxo configurável de
  revisão documental (Portal de Conhecimento e Treinamentos DGT).

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Cria:
    Tabelas novas : dgt_fluxo, dgt_processometadado, dgt_tarefafluxo,
                    dgt_historicofluxo
    Colunas novas : dgt_processo.dgt_area
                    dgt_documentoprocesso.dgt_principal
                    dgt_documentorevisao.dgt_fluxo / dgt_etapaatual /
                    dgt_situacaofluxo / dgt_estadofluxojson

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/fluxo/dataverse/esquemaFluxo.ts

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
  .\criar-tabelas-fluxo.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos
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

# Lookup = relacionamento 1:N. $AoExcluir: Restrict (protege o
# histórico) ou RemoveLink (só limpa o campo).
function New-Lookup {
  param(
    [string] $Tabela,
    [string] $Schema,
    [string] $Nome,
    [string] $TabelaDestino,
    [string] $AoExcluir = 'RemoveLink'
  )

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico (lookup) já existe"
    return
  }

  Write-Host "  + $Tabela.$logico -> $TabelaDestino" -ForegroundColor Green

  $nomeRelacao = "${TabelaDestino}_${Tabela}_${logico}"
  if ($nomeRelacao.Length -gt 90) { $nomeRelacao = $nomeRelacao.Substring(0, 90) }

  Invoke-Dv -Metodo 'POST' -Caminho 'RelationshipDefinitions' -Corpo @{
    '@odata.type'        = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName           = $nomeRelacao
    ReferencedEntity     = $TabelaDestino
    ReferencedAttribute  = "${TabelaDestino}id"
    ReferencingEntity    = $Tabela
    CascadeConfiguration = @{
      Assign   = 'NoCascade'
      Delete   = $AoExcluir
      Merge    = 'NoCascade'
      Reparent = 'NoCascade'
      Share    = 'NoCascade'
      Unshare  = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type'     = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      AttributeType     = 'Lookup'
      AttributeTypeName = @{ Value = 'LookupType' }
      SchemaName        = $Schema
      DisplayName       = Rotulo $Nome
      RequiredLevel     = @{ Value = 'None' }
    }
  } | Out-Null
}

# ------------------------------------------------------------
# Conferência das tabelas existentes que serão usadas
# ------------------------------------------------------------

foreach ($existente in @('dgt_processo', 'dgt_documentoprocesso', 'dgt_documentorevisao', 'dgt_documento', 'dgt_area', 'dgt_usuario')) {
  if (-not (Test-Existe "EntityDefinitions(LogicalName='$existente')?`$select=LogicalName")) {
    throw "A tabela $existente não foi encontrada neste ambiente. Confira a URL do ambiente."
  }
}

# ------------------------------------------------------------
# 1) Tabelas novas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas novas" -ForegroundColor Cyan

New-Tabela 'dgt_Fluxo' 'Fluxo' 'Fluxos' 'Versão do fluxo de revisão de um processo (desenho BPMN + configuração das etapas).'
New-Tabela 'dgt_ProcessoMetadado' 'Metadado do Processo' 'Metadados do Processo' 'Campo do processo usado nas etapas do fluxo. A ordem define a ordem nas telas.'
New-Tabela 'dgt_TarefaFluxo' 'Pendência do Fluxo' 'Pendências do Fluxo' 'Etapa do fluxo aguardando os responsáveis em uma revisão.'
New-Tabela 'dgt_HistoricoFluxo' 'Histórico do Fluxo' 'Históricos do Fluxo' 'Cada ação executada no fluxo de uma revisão (auditoria).'

# ------------------------------------------------------------
# 2) Colunas das tabelas novas
# ------------------------------------------------------------

Write-Host "`n2) dgt_fluxo" -ForegroundColor Cyan
New-Lookup    'dgt_fluxo' 'dgt_Processo' 'Processo' 'dgt_processo' 'Restrict'
New-Inteiro   'dgt_fluxo' 'dgt_Versao' 'Versão'
New-Texto     'dgt_fluxo' 'dgt_Situacao' 'Situação' 20
New-TextoLongo 'dgt_fluxo' 'dgt_DefinicaoJson' 'Definição (JSON)' 1048576
New-TextoLongo 'dgt_fluxo' 'dgt_BpmnXml' 'Desenho BPMN (XML)' 1048576
New-Texto     'dgt_fluxo' 'dgt_Modelo' 'Modelo de origem' 100
New-DataHora  'dgt_fluxo' 'dgt_PublicadoEm' 'Publicado em'
New-DataHora  'dgt_fluxo' 'dgt_ArquivadoEm' 'Arquivado em'

Write-Host "`n3) dgt_processometadado" -ForegroundColor Cyan
New-Lookup    'dgt_processometadado' 'dgt_Processo' 'Processo' 'dgt_processo' 'Restrict'
New-Texto     'dgt_processometadado' 'dgt_Chave' 'Chave' 100
New-Texto     'dgt_processometadado' 'dgt_Tipo' 'Tipo' 20
New-Inteiro   'dgt_processometadado' 'dgt_Ordem' 'Ordem'
New-TextoLongo 'dgt_processometadado' 'dgt_OpcoesJson' 'Opções (JSON)' 100000
New-TextoLongo 'dgt_processometadado' 'dgt_ColunasJson' 'Colunas da tabela (JSON)' 100000
New-Texto     'dgt_processometadado' 'dgt_Ajuda' 'Ajuda' 500
New-SimNao    'dgt_processometadado' 'dgt_Ativo' 'Ativo' $true

Write-Host "`n4) dgt_tarefafluxo" -ForegroundColor Cyan
New-Texto     'dgt_tarefafluxo' 'dgt_Chave' 'Chave' 150
New-Lookup    'dgt_tarefafluxo' 'dgt_DocumentoRevisao' 'Revisão do documento' 'dgt_documentorevisao' 'Restrict'
New-Lookup    'dgt_tarefafluxo' 'dgt_Fluxo' 'Fluxo' 'dgt_fluxo' 'Restrict'
New-Texto     'dgt_tarefafluxo' 'dgt_EtapaId' 'Id da etapa' 100
New-Texto     'dgt_tarefafluxo' 'dgt_EtapaNome' 'Etapa' 200
New-Texto     'dgt_tarefafluxo' 'dgt_Situacao' 'Situação' 20
New-TextoLongo 'dgt_tarefafluxo' 'dgt_ResponsaveisJson' 'Responsáveis (JSON)' 100000
New-DataHora  'dgt_tarefafluxo' 'dgt_Prazo' 'Prazo'
New-DataHora  'dgt_tarefafluxo' 'dgt_ConcluidaEm' 'Concluída em'
New-Lookup    'dgt_tarefafluxo' 'dgt_ConcluidaPor' 'Concluída por' 'dgt_usuario' 'RemoveLink'
New-Texto     'dgt_tarefafluxo' 'dgt_AcaoRotulo' 'Ação executada' 200

Write-Host "`n5) dgt_historicofluxo" -ForegroundColor Cyan
New-Texto     'dgt_historicofluxo' 'dgt_Chave' 'Chave' 150
New-Lookup    'dgt_historicofluxo' 'dgt_DocumentoRevisao' 'Revisão do documento' 'dgt_documentorevisao' 'Restrict'
New-Lookup    'dgt_historicofluxo' 'dgt_Fluxo' 'Fluxo' 'dgt_fluxo' 'Restrict'
New-Texto     'dgt_historicofluxo' 'dgt_EtapaId' 'Id da etapa' 100
New-Texto     'dgt_historicofluxo' 'dgt_EtapaNome' 'Etapa' 200
New-Texto     'dgt_historicofluxo' 'dgt_AcaoChave' 'Chave da ação' 100
New-Texto     'dgt_historicofluxo' 'dgt_AcaoRotulo' 'Ação' 200
New-Texto     'dgt_historicofluxo' 'dgt_Resultado' 'Resultado' 100
New-TextoLongo 'dgt_historicofluxo' 'dgt_Comentario' 'Comentário' 10000
New-Lookup    'dgt_historicofluxo' 'dgt_ExecutadoPor' 'Executado por' 'dgt_usuario' 'RemoveLink'
New-Texto     'dgt_historicofluxo' 'dgt_ExecutadoPorNome' 'Executado por (nome)' 200
New-SimNao    'dgt_historicofluxo' 'dgt_Sistema' 'Ação do sistema' $false
New-DataHora  'dgt_historicofluxo' 'dgt_DataEvento' 'Data do evento'

# ------------------------------------------------------------
# 3) Colunas novas em tabelas existentes
# ------------------------------------------------------------

Write-Host "`n6) Tabelas existentes" -ForegroundColor Cyan
New-Lookup    'dgt_processo' 'dgt_Area' 'Área' 'dgt_area' 'RemoveLink'
New-SimNao    'dgt_documentoprocesso' 'dgt_Principal' 'Processo principal' $false
New-Lookup    'dgt_documentorevisao' 'dgt_Fluxo' 'Fluxo' 'dgt_fluxo' 'RemoveLink'
New-Texto     'dgt_documentorevisao' 'dgt_EtapaAtual' 'Etapa atual do fluxo' 100
New-Texto     'dgt_documentorevisao' 'dgt_SituacaoFluxo' 'Situação do fluxo' 20
New-TextoLongo 'dgt_documentorevisao' 'dgt_EstadoFluxoJson' 'Estado do fluxo (JSON)' 1048576

# ------------------------------------------------------------
# 4) Publicação das personalizações
# ------------------------------------------------------------

Write-Host "`n7) Publicando personalizações (pode levar alguns minutos)..." -ForegroundColor Cyan
Invoke-Dv -Metodo 'POST' -Caminho 'PublishAllXml' -Corpo @{} | Out-Null

Write-Host "`nConcluído. Próximo passo: dar permissão às novas tabelas nos perfis de segurança (veja docs/fluxo-dataverse.md)." -ForegroundColor Green
