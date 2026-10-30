<#
.SYNOPSIS
  Cria no Dataverse as tabelas da aba KITS do Portal DGT (catálogo do
  montador de B.O.M.):
    dgt_kititem        (Item do catálogo de kits)
    dgt_kitkit         (Kit — parâmetros de cada kit)
    dgt_kitcomposicao  (Linha de composição do kit)
    dgt_kitalteracao   (Alteração do catálogo de kits — histórico)

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/bom/esquemaKits.ts

  As tabelas são de propriedade da ORGANIZAÇÃO: o catálogo é um só para
  todo mundo. Privilégios sugeridos (o script concede se você informar
  os perfis):
    -PapelLeitores        Ler  (quem monta B.O.M. e quem consulta Kits)
    -PapelMantenedores    Criar, Ler, Gravar  (quem altera os kits)
  Ninguém recebe Excluir: item ou linha retirada é DESATIVADA e cada
  alteração fica em dgt_kitalteracao.

  Depois de rodar: abra o portal > Kits > "Importar catálogo padrão".

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Solucao
  NOME (nome exclusivo) da solução, não o nome de exibição.

.PARAMETER PapelLeitores
  Opcional. Nome do perfil de segurança que só LÊ o catálogo
  (ex.: "DGT Treinamentos - Colaboradores"). IMPORTANTE: quem monta
  B.O.M. precisa ler estas tabelas; sem isso o montador usa o
  catálogo padrão do código.

.PARAMETER PapelMantenedores
  Opcional. Nome do perfil de segurança de quem ALTERA o catálogo
  (ex.: "DGT Treinamentos - Administradores").

.PARAMETER Token
  Opcional. Token de acesso já obtido.

.EXAMPLE
  .\criar-tabelas-kits.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos -PapelLeitores "DGT Treinamentos - Colaboradores" -PapelMantenedores "DGT Treinamentos - Administradores"
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

New-Tabela 'dgt_KitItem' 'Item do catálogo de kits' 'Itens do catálogo de kits' 'Equipamentos e itens usados pelo montador de B.O.M. (aba Kits).'
New-Tabela 'dgt_KitKit' 'Kit' 'Kits' 'Parâmetros de cada kit do montador de B.O.M.'
New-Tabela 'dgt_KitComposicao' 'Linha de composição do kit' 'Linhas de composição dos kits' 'O que entra no kit-base: item, quantidade, regra e condição.'
New-Tabela 'dgt_KitAlteracao' 'Alteração do catálogo de kits' 'Alterações do catálogo de kits' 'Histórico das alterações feitas na aba Kits (nunca é apagado).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_kititem" -ForegroundColor Cyan
New-Texto      'dgt_kititem' 'dgt_Chave'      'Chave interna' 200
New-Texto      'dgt_kititem' 'dgt_Codigo'     'Código CIGAM' 50
New-Texto      'dgt_kititem' 'dgt_Categoria'  'Categoria' 50
New-Texto      'dgt_kititem' 'dgt_Tipo'       'Tipo' 30
New-TextoLongo 'dgt_kititem' 'dgt_Atributos'  'Atributos técnicos (JSON)' 4000
New-Texto      'dgt_kititem' 'dgt_Situacao'   'Situação' 30
New-TextoLongo 'dgt_kititem' 'dgt_Observacao' 'Observação' 2000
New-Inteiro    'dgt_kititem' 'dgt_Ordem'      'Ordem'
New-SimNao     'dgt_kititem' 'dgt_Ativo'      'Ativo' $true

Write-Host "`n3) Colunas de dgt_kitkit" -ForegroundColor Cyan
New-Texto      'dgt_kitkit' 'dgt_Chave'       'Chave do kit' 50
New-Texto      'dgt_kitkit' 'dgt_CodigoCigam' 'Código do kit no CIGAM' 50
New-Inteiro    'dgt_kitkit' 'dgt_MaxCameras'  'Máximo de câmeras'
New-SimNao     'dgt_kitkit' 'dgt_AceitaOcr'   'Aceita câmera OCR/LPR' $false
New-Texto      'dgt_kitkit' 'dgt_Sinalizacao' 'Sinalização' 200
New-TextoLongo 'dgt_kitkit' 'dgt_Descricao'   'Descrição' 2000
New-SimNao     'dgt_kitkit' 'dgt_Ativo'       'Ativo' $true
# Kits configurados na aba Kits (rodar de novo o script cria só estas).
New-Texto      'dgt_kitkit' 'dgt_Modelo'      'Modelo de cálculo' 50
New-Inteiro    'dgt_kitkit' 'dgt_Ordem'       'Ordem de exibição'

Write-Host "`n4) Colunas de dgt_kitcomposicao" -ForegroundColor Cyan
New-Texto      'dgt_kitcomposicao' 'dgt_Kit'        'Kit' 50
New-Texto      'dgt_kitcomposicao' 'dgt_ItemChave'  'Item (chave)' 200
New-Quantidade 'dgt_kitcomposicao' 'dgt_Quantidade' 'Quantidade'
New-Texto      'dgt_kitcomposicao' 'dgt_Regra'      'Regra de quantidade' 50
New-Texto      'dgt_kitcomposicao' 'dgt_Condicao'   'Condição' 50
New-Inteiro    'dgt_kitcomposicao' 'dgt_Ordem'      'Ordem'
New-TextoLongo 'dgt_kitcomposicao' 'dgt_Observacao' 'Observação' 2000
New-SimNao     'dgt_kitcomposicao' 'dgt_Ativo'      'Ativo' $true

Write-Host "`n5) Colunas de dgt_kitalteracao" -ForegroundColor Cyan
New-Texto      'dgt_kitalteracao' 'dgt_Entidade'    'Entidade' 50
New-Texto      'dgt_kitalteracao' 'dgt_Chave'       'Chave' 200
New-Texto      'dgt_kitalteracao' 'dgt_Acao'        'Ação' 50
New-TextoLongo 'dgt_kitalteracao' 'dgt_Motivo'      'Motivo' 4000
New-TextoLongo 'dgt_kitalteracao' 'dgt_Detalhes'    'Detalhes (antes e depois, JSON)' 100000
New-Texto      'dgt_kitalteracao' 'dgt_UsuarioNome' 'Alterado por' 200

# ------------------------------------------------------------
# 6) Publicação
# ------------------------------------------------------------

Write-Host "`n6) Publicando as tabelas..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_kititem</entity><entity>dgt_kitkit</entity><entity>dgt_kitcomposicao</entity><entity>dgt_kitalteracao</entity></entities></importexportxml>'
} | Out-Null

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
$tabelasCatalogo = @('dgt_kititem', 'dgt_kitkit', 'dgt_kitcomposicao')

if ($PapelLeitores -or $PapelMantenedores) {
  Write-Host "`n7) Privilégios" -ForegroundColor Cyan
}

if ($PapelLeitores) {
  Grant-Privilegios $PapelLeitores 'Global' ($tabelasCatalogo + @('dgt_kitalteracao')) @('Read')
}

if ($PapelMantenedores) {
  Grant-Privilegios $PapelMantenedores 'Global' $tabelasCatalogo @('Create', 'Read', 'Write')
  # Histórico: só criar e ler (nunca alterar nem excluir).
  Grant-Privilegios $PapelMantenedores 'Global' @('dgt_kitalteracao') @('Create', 'Read')
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green

if (-not $PapelLeitores -or -not $PapelMantenedores) {
  Write-Host '  1. Perfis de segurança (Power Platform admin center > Ambiente > Configurações > Usuários + permissões > Perfis de segurança):'
  Write-Host '       Quem monta B.O.M. / consulta Kits -> dgt_kititem, dgt_kitkit, dgt_kitcomposicao, dgt_kitalteracao: Ler = ORGANIZAÇÃO'
  Write-Host '       Quem altera os kits               -> dgt_kititem, dgt_kitkit, dgt_kitcomposicao: Criar, Ler, Gravar = ORGANIZAÇÃO'
  Write-Host '                                            dgt_kitalteracao: Criar, Ler = ORGANIZAÇÃO'
  Write-Host '       NÃO conceda Excluir (item retirado é desativado; o histórico fica).'
}

Write-Host '  2. Portal > Usuários e acessos: libere o módulo "Kits" para quem consulta e marque "Administrador do módulo" para quem altera.'
Write-Host '  3. Portal > Kits > botão "Importar catálogo padrão" (uma vez; pode repetir sem duplicar).'
Write-Host '  4. (Recomendado) Ative a auditoria das quatro tabelas (Propriedades da tabela > Auditar alterações nos dados).'
