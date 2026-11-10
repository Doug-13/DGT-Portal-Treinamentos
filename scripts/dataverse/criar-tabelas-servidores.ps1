<#
.SYNOPSIS
  Cria no Dataverse as tabelas do SELETOR DE SERVIDOR (aba Kits →
  Servidores; painel "Servidor da central" da Seleção de kit):
    dgt_servidorcatalogo  uma linha por faixa/opção de memorial de cálculo
    dgt_servidoralerta    textos e níveis dos alertas do seletor

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/bom/ServidoresService.ts

  Tabelas da ORGANIZAÇÃO (um catálogo para todos). Privilégios (opcional):
    -PapelLeitores      Ler            (quem monta B.O.M.)
    -PapelMantenedores  Criar, Ler, Gravar  (quem mantém os memoriais)
  Ninguém recebe Excluir: linha fora de uso é desativada.

  Depois: portal → Kits → Servidores → "Importar catálogo padrão".

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-servidores.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao NOME_EXCLUSIVO -PapelLeitores "DGT Treinamentos - Colaboradores" -PapelMantenedores "DGT Treinamentos - Administradores"
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


# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_ServidorCatalogo' 'Servidor (memorial)' 'Servidores (memoriais)' 'Faixa/opção de memorial de cálculo de servidor (Digifort, Milestone, IPX, Digifort + IPX).'
New-Tabela 'dgt_ServidorAlerta' 'Alerta do seletor de servidor' 'Alertas do seletor de servidor' 'Texto e nível de um alerta do seletor de servidor (regra geral ou de uma linha).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_servidorcatalogo" -ForegroundColor Cyan
$T = 'dgt_servidorcatalogo'
New-Texto      $T 'dgt_Software'             'Software' 30
New-Texto      $T 'dgt_Finalidade'           'Finalidade' 30
New-Inteiro    $T 'dgt_Capacidade'           'Capacidade (câmeras)'
New-Texto      $T 'dgt_Opcao'                'Opção (A, B, C)' 10
New-Inteiro    $T 'dgt_QtdServidores'        'Quantidade de servidores'
New-Inteiro    $T 'dgt_CamerasPorServidor'   'Câmeras por servidor'
New-TextoLongo $T 'dgt_Processadores'        'Processadores (um por linha)' 2000
New-Texto      $T 'dgt_Ram'                  'RAM' 100
New-Texto      $T 'dgt_DiscoSo'              'Disco do SO' 200
New-Quantidade $T 'dgt_ArmazServidorTb'      'Armazenamento por servidor (TB)'
New-Quantidade $T 'dgt_ArmazTotalTb'         'Armazenamento total (TB)'
New-Inteiro    $T 'dgt_DiscosQtd'            'Discos por servidor'
New-Quantidade $T 'dgt_DiscoTamanhoTb'       'Tamanho do disco (TB)'
New-Texto      $T 'dgt_Arranjo'              'Arranjo' 100
New-TextoLongo $T 'dgt_Gpus'                 'GPUs (uma por linha)' 2000
New-TextoLongo $T 'dgt_SistemasOperacionais' 'Sistemas operacionais (um por linha)' 2000
New-Texto      $T 'dgt_CompressaoRef'        'Compressão de referência' 10
New-Texto      $T 'dgt_Iops'                 'IOPS' 100
New-Quantidade $T 'dgt_RedeCamerasMbps'      'Rede das câmeras (Mbps)'
New-Texto      $T 'dgt_CodigoCigam'          'Código CIGAM' 50
New-Texto      $T 'dgt_VersaoMemorial'       'Versão do memorial' 300
New-TextoLongo $T 'dgt_Observacao'           'Observação' 2000
New-SimNao     $T 'dgt_Ativo'                'Ativo' $true

Write-Host "`n3) Colunas de dgt_servidoralerta" -ForegroundColor Cyan
$T = 'dgt_servidoralerta'
New-Texto      $T 'dgt_Nivel'                'Nível (bloqueio, aviso, informacao)' 20
New-TextoLongo $T 'dgt_Texto'                'Texto' 2000
New-SimNao     $T 'dgt_Ativo'                'Ativo' $true

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n4) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_servidorcatalogo</entity><entity>dgt_servidoralerta</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 5) Privilégios (opcional) — nível ORGANIZAÇÃO, sem Excluir
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

$tabelasServidor = @('dgt_servidorcatalogo', 'dgt_servidoralerta')

if ($PapelLeitores) {
  Grant-Privilegios $PapelLeitores 'Global' $tabelasServidor @('Read')
}
if ($PapelMantenedores) {
  Grant-Privilegios $PapelMantenedores 'Global' $tabelasServidor @('Create', 'Read', 'Write')
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Quem monta B.O.M. precisa LER as duas tabelas (senão o seletor usa o catálogo padrão do código).'
Write-Host '  2. Portal > Kits > Servidores > "Importar catálogo padrão".'
Write-Host '  3. Cole as linhas da planilha "Servidores — Consolidado Memoriais de Cálculo" (Digifort, Milestone, IPX).'
