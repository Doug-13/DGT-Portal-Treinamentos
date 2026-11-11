<#
  Cria a tabela de PEDIDOS DE ASSINATURA DIGITAL (dgt_assinatura) usada
  pela tarefa "Assinatura digital" dos fluxos. O portal cria o pedido; o
  Power Automate envia à Clicksign e grava o retorno.
  Pode ser executado de novo: só cria o que falta.
  Ver docs/assinatura-digital.md.
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
# 1) Tabela
# ------------------------------------------------------------

Write-Host "`n1) Tabela de pedidos de assinatura..." -ForegroundColor Cyan

New-Tabela 'dgt_Assinatura' 'Pedido de Assinatura' 'Pedidos de Assinatura' 'Pedido de assinatura digital de um documento/registro do portal. Enviado e acompanhado pelo Power Automate (Clicksign).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas..." -ForegroundColor Cyan

New-Texto      'dgt_assinatura' 'dgt_Chave'               'Chave do pedido' 100
New-Texto      'dgt_assinatura' 'dgt_Provedor'            'Provedor' 30
New-Texto      'dgt_assinatura' 'dgt_Situacao'            'Situação' 30
New-Texto      'dgt_assinatura' 'dgt_Origem'              'Origem (documento/ambiente)' 20
New-Texto      'dgt_assinatura' 'dgt_AlvoId'              'Revisão ou registro (id)' 100
New-Texto      'dgt_assinatura' 'dgt_Codigo'              'Código' 100
New-TextoLongo 'dgt_assinatura' 'dgt_ArquivosJson'        'Arquivos (JSON)' 20000
New-TextoLongo 'dgt_assinatura' 'dgt_SignatariosJson'     'Signatários (JSON)' 20000
New-SimNao     'dgt_assinatura' 'dgt_OrdemSequencial'     'Assinatura em ordem'
New-DataHora   'dgt_assinatura' 'dgt_Prazo'               'Prazo'
New-TextoLongo 'dgt_assinatura' 'dgt_Mensagem'            'Mensagem aos signatários' 4000
New-Texto      'dgt_assinatura' 'dgt_IdExterno'           'Id no provedor (envelope)' 100
New-Texto      'dgt_assinatura' 'dgt_LinkAcompanhamento'  'Link de acompanhamento' 1000
New-Texto      'dgt_assinatura' 'dgt_ArquivoAssinado'     'Arquivo assinado (link)' 1000
New-TextoLongo 'dgt_assinatura' 'dgt_Erro'                'Erro' 4000
New-Texto      'dgt_assinatura' 'dgt_SolicitadoPor'       'Solicitado por' 200
New-DataHora   'dgt_assinatura' 'dgt_ConcluidoEm'         'Concluído em'

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando a tabela..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_assinatura</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos (docs/assinatura-digital.md):' -ForegroundColor Green
Write-Host '  1. Perfis de segurança: dgt_assinatura -> Criar e Ler (Org.) para quem conclui etapas;'
Write-Host '     Gravar (Org.) para a conta do Power Automate e para Administradores (Reenviar). Ninguém com Excluir.'
Write-Host '  2. Crie os fluxos do Power Automate (envio e retorno) conforme o guia.'
