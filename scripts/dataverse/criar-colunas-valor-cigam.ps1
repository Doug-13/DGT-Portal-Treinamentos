<#
.SYNOPSIS
  Prepara o Dataverse para o VALOR (R$) dos itens de kit vindo do CIGAM:
    - colunas novas em dgt_kititem: dgt_valor, dgt_valoratualizadoem,
      dgt_valororigem, dgt_valorsituacao
    - tabela dgt_cigamsincronizacao: pedidos de atualização de preços
      (o portal cria; o fluxo do Power Automate processa)

.DESCRIPTION
  Pode ser executado mais de uma vez: só cria o que falta.
  Nomes iguais aos de services/bom/esquemaKits.ts (COL_ITEM_VALOR e
  COL_SINCRONIZACAO).

  NENHUMA credencial do CIGAM passa por aqui nem pelo portal: o login
  no CIGAM é feito pelo fluxo, com a senha guardada como variável de
  ambiente do tipo Segredo (Azure Key Vault) no Power Platform.
  Passo a passo do fluxo: docs/integracao-cigam-precos.md

.EXAMPLE
  .\scripts\dataverse\criar-colunas-valor-cigam.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos -PapelLeitores "DGT Treinamentos - Colaboradores" -PapelMantenedores "DGT Treinamentos - Administradores"
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $PapelLeitores,
  [string] $PapelMantenedores,
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
    OwnershipType          = 'OrganizationOwned'
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

# Valor em reais: aceita negativos (estornos/receitas negativas).
function New-Decimal {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 2
    MinValue      = -100000000000
    MaxValue      = 100000000000
  }
}

# Percentual com 4 casas (0 a 100).
function New-Percentual {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 4
    MinValue      = 0
    MaxValue      = 100
  }
}

# Quantidade: 2 casas, não negativa.
function New-Quantidade {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 2
    MinValue      = 0
    MaxValue      = 1000000
  }
}


# Valor com 4 casas (preços do CIGAM podem ter mais de 2 decimais).
function New-Valor {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 4
    MinValue      = 0
    MaxValue      = 100000000000
  }
}

# ------------------------------------------------------------
# 1) Colunas de valor em dgt_kititem
# ------------------------------------------------------------

Write-Host "`n1) Colunas de valor em dgt_kititem" -ForegroundColor Cyan
$T = 'dgt_kititem'
New-Valor      $T 'dgt_Valor'              'Valor unitário (R$) — CIGAM'
New-DataHora   $T 'dgt_ValorAtualizadoEm'  'Valor atualizado em'
New-Texto      $T 'dgt_ValorOrigem'        'Origem do valor (tabela de preços)' 200
New-Texto      $T 'dgt_ValorSituacao'      'Situação do valor' 300

# ------------------------------------------------------------
# 2) Tabela de pedidos de atualização
# ------------------------------------------------------------

Write-Host "`n2) Tabela dgt_cigamsincronizacao" -ForegroundColor Cyan
New-Tabela 'dgt_CigamSincronizacao' 'Sincronização com o CIGAM' 'Sincronizações com o CIGAM' 'Pedido de atualização de dados vindos do CIGAM (ex.: preços dos itens de kit), processado por fluxo do Power Automate.'
$T = 'dgt_cigamsincronizacao'
New-Texto      $T 'dgt_Tipo'               'Tipo' 100
New-Texto      $T 'dgt_Situacao'           'Situação (Pendente, Em andamento, Concluída, Erro)' 30
New-TextoLongo $T 'dgt_Mensagem'           'Mensagem' 4000
New-Texto      $T 'dgt_SolicitadoPor'      'Solicitado por' 200
New-Inteiro    $T 'dgt_ItensAtualizados'   'Itens atualizados'
New-Inteiro    $T 'dgt_ItensSemPreco'      'Itens sem preço'
New-DataHora   $T 'dgt_ConcluidoEm'        'Concluído em'

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan
Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_kititem</entity><entity>dgt_cigamsincronizacao</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 4) Privilégios da tabela de pedidos (opcional)
# ------------------------------------------------------------

# ------------------------------------------------------------
# 7) Privilégios (opcional) — nível ORGANIZAÇÃO, sem Excluir
# ------------------------------------------------------------
function Get-PrivilegioId {
  param([string] $Nome)
  $resultado = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=privilegeid&`$filter=name eq '$Nome'"
  if ($resultado.value.Count -eq 0) {
    throw "Privilégio $Nome não encontrado. A tabela foi publicada?"
  }
  return $resultado.value[0].privilegeid
}

function Grant-Privilegios {
  param([string] $NomePapel, [string] $Profundidade, [string[]] $Tabelas, [string[]] $Acoes)

  $nomeFiltro = $NomePapel.Replace("'", "''")
  $papeis = Invoke-Dv -Metodo 'GET' -Caminho "roles?`$select=roleid,name,_businessunitid_value&`$filter=name eq '$nomeFiltro' and _parentroleid_value eq null"

  if ($papeis.value.Count -eq 0) {
    Write-Host "  ! perfil de segurança '$NomePapel' não encontrado — conceda os privilégios manualmente." -ForegroundColor Yellow
    return
  }

  $papel = $papeis.value[0]
  $lista = @()

  foreach ($tabela in $Tabelas) {
    foreach ($acao in $Acoes) {
      $lista += @{
        PrivilegeId    = (Get-PrivilegioId "prv$acao$tabela")
        Depth          = $Profundidade
        BusinessUnitId = $papel._businessunitid_value
      }
    }
  }

  Invoke-Dv -Metodo 'POST' -Caminho "roles($($papel.roleid))/Microsoft.Dynamics.CRM.AddPrivilegesRole" -Corpo @{
    Privileges = $lista
  } | Out-Null

  Write-Host "  + '$NomePapel': $($Acoes -join ', ') ($Profundidade) em $($Tabelas -join ', ')" -ForegroundColor Green
}

if ($PapelLeitores) {
  Grant-Privilegios $PapelLeitores 'Global' @('dgt_cigamsincronizacao') @('Read')
}
if ($PapelMantenedores) {
  # Quem mantém os kits pode PEDIR a atualização (criar o pedido).
  Grant-Privilegios $PapelMantenedores 'Global' @('dgt_cigamsincronizacao') @('Create', 'Read')
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Conta do fluxo (conexão do Dataverse no Power Automate): Ler e Gravar em dgt_kititem e dgt_cigamsincronizacao.'
Write-Host '  2. Criar o fluxo conforme docs/integracao-cigam-precos.md (senha do CIGAM como variável de ambiente Segredo).'
Write-Host '  3. Portal > Kits > Equipamentos e itens > "Atualizar valores do CIGAM".'
