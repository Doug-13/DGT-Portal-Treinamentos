<#
.SYNOPSIS
  Cria no Dataverse as tabelas do CÁLCULO DE HH do Portal DGT:
    dgt_hhcalculo    (Cálculo de HH — uma linha por versão de cada área)
    dgt_hhalteracao  (Alteração do cálculo de HH — histórico)

.DESCRIPTION
  Pode ser executado mais de uma vez: só cria o que falta.
  Nomes iguais aos de src/webparts/portalTreinamentosWebPart/services/hh/HHService.ts.

  Propriedade da ORGANIZAÇÃO (um cálculo por área para toda a empresa).
    -PapelLeitores       Ler   (quem monta B.O.M. e quem consulta o HH)
    -PapelMantenedores   Criar, Ler, Gravar (quem mantém o cálculo)
  Ninguém recebe Excluir: versões nunca são apagadas.

  Depois de rodar: portal > Cálculo de HH > área > "Importar dados (.json)"
  com os arquivos hh-implantacao.json e hh-suporte.json, e "Publicar versão".

.EXAMPLE
  .\criar-tabelas-hh.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao NOME_EXCLUSIVO -PapelLeitores "DGT Treinamentos - Colaboradores" -PapelMantenedores "DGT Treinamentos - Administradores"
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


# Fração com 6 casas (ex.: % fixo 0,075).
function New-Fracao {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 6
    MinValue      = -1000
    MaxValue      = 1000
  }
}

# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan
New-Tabela 'dgt_HHCalculo' 'Cálculo de HH' 'Cálculos de HH' 'Uma versão do cálculo de homem-hora de uma área (Rascunho, Vigente ou Substituído).'
New-Tabela 'dgt_HHAlteracao' 'Alteração do cálculo de HH' 'Alterações do cálculo de HH' 'Histórico do cálculo de HH (nunca é apagado).'

Write-Host "`n2) Colunas de dgt_hhcalculo" -ForegroundColor Cyan
New-Texto      'dgt_hhcalculo' 'dgt_Area'           'Área' 50
New-Texto      'dgt_hhcalculo' 'dgt_MesReferencia'  'Mês de referência' 20
New-Texto      'dgt_hhcalculo' 'dgt_Status'         'Situação' 30
New-Inteiro    'dgt_hhcalculo' 'dgt_Versao'         'Versão'
New-TextoLongo 'dgt_hhcalculo' 'dgt_Dados'          'Dados do cálculo (JSON)' 1048576
New-TextoLongo 'dgt_hhcalculo' 'dgt_Resultados'     'Resultados (JSON)' 100000
New-Decimal    'dgt_hhcalculo' 'dgt_HHPorPonto'     'HH por ponto/localidade (R$)'
New-Fracao     'dgt_hhcalculo' 'dgt_PctFixo'        '% fixo no B.O.M (fração)'
New-TextoLongo 'dgt_hhcalculo' 'dgt_Motivo'         'Motivo' 4000
New-Texto      'dgt_hhcalculo' 'dgt_PublicadoPor'   'Publicado por' 200
New-Texto      'dgt_hhcalculo' 'dgt_DataPublicacao' 'Data da publicação (ISO)' 40
New-Texto      'dgt_hhcalculo' 'dgt_AlteradoPor'    'Alterado por' 200

Write-Host "`n3) Colunas de dgt_hhalteracao" -ForegroundColor Cyan
New-Texto      'dgt_hhalteracao' 'dgt_Area'         'Área' 50
New-Texto      'dgt_hhalteracao' 'dgt_Acao'         'Ação' 50
New-Inteiro    'dgt_hhalteracao' 'dgt_Versao'       'Versão'
New-TextoLongo 'dgt_hhalteracao' 'dgt_Motivo'       'Motivo' 4000
New-Texto      'dgt_hhalteracao' 'dgt_UsuarioNome'  'Alterado por' 200

Write-Host "`n4) Publicando as tabelas..." -ForegroundColor Cyan
Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_hhcalculo</entity><entity>dgt_hhalteracao</entity></entities></importexportxml>'
} | Out-Null

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
$tabelasHH = @('dgt_hhcalculo', 'dgt_hhalteracao')

if ($PapelLeitores -or $PapelMantenedores) {
  Write-Host "`n5) Privilégios" -ForegroundColor Cyan
}
if ($PapelLeitores) {
  Grant-Privilegios $PapelLeitores 'Global' $tabelasHH @('Read')
}
if ($PapelMantenedores) {
  Grant-Privilegios $PapelMantenedores 'Global' $tabelasHH @('Create', 'Read', 'Write')
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host '  1. Portal > Usuários e acessos: libere o módulo "Cálculo de HH" e marque "Administrador do módulo" para quem mantém o cálculo.'
Write-Host '  2. Portal > Cálculo de HH > Implantação > Importar dados (.json) > hh-implantacao.json > Publicar versão. Repita no Suporte.'
Write-Host '  3. Quem monta B.O.M. precisa de Ler nas duas tabelas (-PapelLeitores) para ver o HH na etapa 4.'
