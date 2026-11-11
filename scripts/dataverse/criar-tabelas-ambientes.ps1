<#
.SYNOPSIS
  Cria no Dataverse as tabelas dos AMBIENTES DINÂMICOS do Portal de
  Conhecimento e Treinamentos DGT (botão "+ Adicionar ambiente").

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Cria:
    Tabela dgt_ambiente (Ambiente / Ambientes)
      dgt_chave, dgt_descricao, dgt_subtitulo, dgt_icone, dgt_ordem,
      dgt_ativo, dgt_liberadoparatodos, dgt_perfispadrao,
      dgt_prefixocodigo, dgt_rotuloregistro, dgt_layoutjson,
      dgt_permiteanexos, dgt_bibliotecaanexos, dgt_mostrarsequencia,
      dgt_Processo (Pesquisa -> dgt_processo)

    Tabela dgt_ambienteregistro (Registro de Ambiente / Registros de Ambiente)
      dgt_codigo, dgt_descricao, dgt_situacao, dgt_etapaatual,
      dgt_prazoetapa, dgt_responsaveisetapa, dgt_fluxoestado,
      dgt_concluidoem, dgt_etapaatualid, dgt_valoresjson,
      dgt_Ambiente (Pesquisa -> dgt_ambiente, exclusão RESTRITA),
      dgt_Area (Pesquisa -> dgt_area),
      dgt_Solicitante (Pesquisa -> dgt_usuario)

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/ambientes/esquemaAmbientes.ts

  Pré-requisito: as tabelas do fluxo configurável (criar-tabelas-fluxo.ps1).

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
  .\criar-tabelas-ambientes.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos
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
# 0) Pré-requisitos
# ------------------------------------------------------------

Write-Host "`n0) Conferindo pré-requisitos" -ForegroundColor Cyan

foreach ($necessaria in @('dgt_processo', 'dgt_area', 'dgt_usuario')) {
  if (-not (Test-Existe "EntityDefinitions(LogicalName='$necessaria')?`$select=LogicalName")) {
    throw "A tabela $necessaria não existe neste ambiente. Execute antes criar-tabelas-fluxo.ps1 / crie as tabelas base do portal."
  }
  Write-Host "  = $necessaria ok"
}

# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_Ambiente' 'Ambiente' 'Ambientes' 'Ambiente criado no portal (ex.: Licitações). Cada um tem um processo com o fluxo que seus registros seguem.'
New-Tabela 'dgt_AmbienteRegistro' 'Registro de Ambiente' 'Registros de Ambiente' 'Registro (solicitação, processo licitatório...) de um ambiente. Segue o fluxo publicado do processo do ambiente.'

# ------------------------------------------------------------
# 2) Colunas de dgt_ambiente
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_ambiente" -ForegroundColor Cyan

New-Texto   'dgt_ambiente' 'dgt_Chave'             'Chave' 60
New-Texto   'dgt_ambiente' 'dgt_Descricao'         'Descrição' 500
New-Texto   'dgt_ambiente' 'dgt_Subtitulo'         'Subtítulo' 200
New-Texto   'dgt_ambiente' 'dgt_Icone'             'Ícone' 50
New-Inteiro 'dgt_ambiente' 'dgt_Ordem'             'Ordem'
New-SimNao  'dgt_ambiente' 'dgt_Ativo'             'Ativo' $true
New-SimNao  'dgt_ambiente' 'dgt_LiberadoParaTodos' 'Liberado para todos' $false
New-Texto   'dgt_ambiente' 'dgt_PerfisPadrao'      'Perfis com liberação padrão (JSON)' 200
New-Texto   'dgt_ambiente' 'dgt_PrefixoCodigo'     'Prefixo do código' 20
New-Texto   'dgt_ambiente' 'dgt_RotuloRegistro'    'Nome do registro' 100
New-Lookup  'dgt_ambiente' 'dgt_Processo'          'Processo do fluxo' 'dgt_processo'
# Telas configuráveis (visões, colunas, etapas) — layoutAmbiente.ts
New-TextoLongo 'dgt_ambiente' 'dgt_LayoutJson'     'Configuração das telas (JSON)' 100000
# Anexos dos registros (SharePoint) — AnexosAmbienteService
New-SimNao 'dgt_ambiente' 'dgt_PermiteAnexos'  'Permite anexos nos registros'
New-Texto      'dgt_ambiente' 'dgt_BibliotecaAnexos' 'Biblioteca dos anexos' 400
# Tela do registro: sequência de atividades no topo (vazio = mostra)
New-SimNao 'dgt_ambiente' 'dgt_MostrarSequencia' 'Mostrar sequência de atividades' $true

# ------------------------------------------------------------
# 3) Colunas de dgt_ambienteregistro
# ------------------------------------------------------------

Write-Host "`n3) Colunas de dgt_ambienteregistro" -ForegroundColor Cyan

New-Texto      'dgt_ambienteregistro' 'dgt_Codigo'             'Código' 50
New-TextoLongo 'dgt_ambienteregistro' 'dgt_Descricao'          'Descrição' 4000
New-Texto      'dgt_ambienteregistro' 'dgt_Situacao'           'Situação' 30
New-Texto      'dgt_ambienteregistro' 'dgt_EtapaAtual'         'Etapa atual' 200
New-DataHora   'dgt_ambienteregistro' 'dgt_PrazoEtapa'         'Prazo da etapa'
New-TextoLongo 'dgt_ambienteregistro' 'dgt_ResponsaveisEtapa'  'Responsáveis da etapa (JSON)' 100000
New-TextoLongo 'dgt_ambienteregistro' 'dgt_FluxoEstado'        'Estado do fluxo (JSON)' 1048576
New-DataHora   'dgt_ambienteregistro' 'dgt_ConcluidoEm'        'Concluído/cancelado em'
# Telas configuráveis: etapa atual (id do elemento) e valores dos campos
New-Texto      'dgt_ambienteregistro' 'dgt_EtapaAtualId'       'Etapa atual (id)' 100
New-TextoLongo 'dgt_ambienteregistro' 'dgt_ValoresJson'        'Valores dos campos (JSON)' 1048576

# Exclusão RESTRITA: um ambiente com registros não pode ser apagado
# (regra do projeto: nunca apagar histórico; desative o ambiente).
New-Lookup 'dgt_ambienteregistro' 'dgt_Ambiente'    'Ambiente'    'dgt_ambiente' 'Restrict'
New-Lookup 'dgt_ambienteregistro' 'dgt_Area'        'Área'        'dgt_area'
New-Lookup 'dgt_ambienteregistro' 'dgt_Solicitante' 'Aberto por'  'dgt_usuario'

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n4) Publicando as tabelas..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_ambiente</entity><entity>dgt_ambienteregistro</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos (detalhes em docs/ambientes.md):' -ForegroundColor Green
Write-Host '  1. Perfis de segurança:'
Write-Host '     dgt_ambiente          -> Ler (Org.) para todos; Criar/Gravar para Administradores.'
Write-Host '     dgt_ambienteregistro  -> Criar, Ler, Gravar, Acrescentar, Acrescentar a (Org.) para quem usa os ambientes.'
Write-Host '     NINGUÉM com Excluir em dgt_ambienteregistro (histórico).'
Write-Host '     dgt_processo          -> Criar para Administradores (o portal cria o processo do ambiente).'
Write-Host '  2. Recarregue o portal (Ctrl+F5) e use "+ Adicionar ambiente" no menu lateral.'
