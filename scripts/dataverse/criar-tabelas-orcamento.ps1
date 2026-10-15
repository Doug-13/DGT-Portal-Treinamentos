<#
.SYNOPSIS
  Cria no Dataverse as tabelas do PLANEJAMENTO ORÇAMENTÁRIO do Portal DGT:
  dgt_orcamentoplanilha (uma planilha por gestor e por ano),
  dgt_orcamentolinha (linhas da planilha, com os valores de jan a dez) e
  dgt_orcamentoevento (histórico: envios e devoluções para ajuste),
  dgt_orcamentoalteracao (log de alterações linha a linha),
  dgt_orcamentoregra (regras de cálculo, ex.: impostos) e
  dgt_orcamentoconfigarea (grupos de contas que cada área preenche).

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Cria:
    Tabela dgt_orcamentoplanilha (Planilha orçamentária)
      dgt_ano, dgt_gestor (pesquisa -> dgt_usuario), dgt_gestornome,
      dgt_areas, dgt_status, dgt_dataenvio, dgt_observacao, dgt_ativo,
      dgt_motivodevolucao, dgt_datadevolucao, dgt_devolvidopor,
      dgt_area (pesquisa -> dgt_area), dgt_prazoajuste

    Tabela dgt_orcamentolinha (Linha do orçamento)
      dgt_planilha (pesquisa -> dgt_orcamentoplanilha), dgt_cenario,
      dgt_grupo, dgt_codigo, dgt_conta, dgt_descricao, dgt_ordem,
      dgt_jan ... dgt_dez (decimal, 2 casas), dgt_ativo

    Tabela dgt_orcamentoevento (Evento do orçamento)
      dgt_planilha (pesquisa -> dgt_orcamentoplanilha), dgt_tipo,
      dgt_motivo, dgt_usuarionome

    Tabela dgt_orcamentoalteracao (Alteração do orçamento)
      dgt_planilha (pesquisa), dgt_linhaid, dgt_grupo, dgt_codigo,
      dgt_conta, dgt_tipo, dgt_origem, dgt_detalhes, dgt_resumo,
      dgt_usuarionome

    Tabela dgt_orcamentoregra (Regra de cálculo do orçamento)
      dgt_contadestino, dgt_contadestinonome, dgt_tipobase, dgt_base,
      dgt_percentual (4 casas), dgt_ordem, dgt_ativo

    Tabela dgt_orcamentoconfigarea (Contas por área do orçamento)
      dgt_area (pesquisa -> dgt_area), dgt_areanome, dgt_grupos, dgt_ativo,
      dgt_equipeid (equipe da área, preenchida por sincronizar-equipes-orcamento.ps1)

  Já executou uma versão anterior? Execute de novo: só o que falta
  (colunas de devolução e a tabela de histórico) é criado.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/orcamento/esquemaOrcamento.ts

  As duas tabelas são de propriedade de USUÁRIO (UserOwned). É isso que
  permite que cada gestor veja somente a própria planilha: o gestor
  recebe Ler no nível Usuário e o Administrador no nível Organização.

  Opcional: informando -PapelGestores e/ou -PapelAdministradores (NOME
  do perfil de segurança), o script já concede os privilégios.

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com
  (Power Apps > Configurações (engrenagem) > Detalhes da sessão > URL da instância)

.PARAMETER Solucao
  NOME (nome exclusivo) da solução, não o nome de exibição.
  (Power Apps > Soluções > coluna "Nome")

.PARAMETER PapelGestores
  Opcional. Nome do perfil de segurança dos gestores
  (ex.: "DGT Treinamentos - Gestores").

.PARAMETER PapelAdministradores
  Opcional. Nome do perfil de segurança dos administradores do portal
  (ex.: "DGT Treinamentos - Administradores").

.PARAMETER Token
  Opcional. Token de acesso já obtido. Se não for informado, o script
  usa o módulo Az.Accounts (Connect-AzAccount) para obter um.

.EXAMPLE
  .\criar-tabelas-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos

.EXAMPLE
  .\criar-tabelas-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos -PapelGestores "DGT Treinamentos - Gestores" -PapelAdministradores "DGT Treinamentos - Administradores"
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $PapelGestores,
  [string] $PapelAdministradores,
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

function New-Lookup {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Referenciada, [string] $Relacionamento)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }

  Write-Host "  + $Tabela.$logico (pesquisa -> $Referenciada)" -ForegroundColor Green

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
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_OrcamentoPlanilha' 'Planilha orçamentária' 'Planilhas orçamentárias' 'Planejamento orçamentário: uma planilha por gestor e por ano. Nunca é excluída pelo portal.'
New-Tabela 'dgt_OrcamentoLinha'    'Linha do orçamento'    'Linhas do orçamento'    'Linha (conta) de uma planilha orçamentária, com os valores de janeiro a dezembro. Linha removida é desativada (histórico).'
New-Tabela 'dgt_OrcamentoEvento'   'Evento do orçamento'   'Eventos do orçamento'   'Histórico da planilha orçamentária: envios e devoluções para ajuste (com o motivo). Nunca é excluído.'
New-Tabela 'dgt_OrcamentoAlteracao'  'Alteração do orçamento'  'Alterações do orçamento'  'Log de alterações das linhas da planilha orçamentária (valor anterior e novo, quem e quando). Nunca é alterado nem excluído pelo portal.'
New-Tabela 'dgt_OrcamentoRegra'      'Regra de cálculo do orçamento' 'Regras de cálculo do orçamento' 'Conta calculada = percentual da soma de outras contas/grupos (ex.: impostos sobre a Receita bruta).'
New-Tabela 'dgt_OrcamentoConfigArea' 'Contas por área do orçamento'  'Contas por área do orçamento'   'Grupos de contas que cada área preenche no planejamento orçamentário.'

# ------------------------------------------------------------
# 2) Colunas da planilha
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_orcamentoplanilha" -ForegroundColor Cyan

$P = 'dgt_orcamentoplanilha'

New-Inteiro    $P 'dgt_Ano'          'Ano'
New-Lookup     $P 'dgt_Gestor'       'Gestor' 'dgt_usuario' 'dgt_usuario_dgt_orcamentoplanilha_gestor'
New-Texto      $P 'dgt_GestorNome'   'Nome do gestor' 200
New-Texto      $P 'dgt_Areas'        'Áreas' 400
New-Texto      $P 'dgt_Status'       'Situação' 40
New-DataHora   $P 'dgt_DataEnvio'    'Data de envio'
New-TextoLongo $P 'dgt_Observacao'   'Observação' 4000
New-SimNao     $P 'dgt_Ativo'        'Ativo' $true

# Última devolução para ajuste (o gestor lê o motivo daqui)
New-TextoLongo $P 'dgt_MotivoDevolucao' 'Motivo da devolução' 4000
New-DataHora   $P 'dgt_DataDevolucao'   'Data da devolução'
New-Texto      $P 'dgt_DevolvidoPor'    'Devolvido por' 200
New-DataHora   $P 'dgt_PrazoAjuste'     'Prazo para ajuste'

# Área da planilha (gestor de 2 áreas = 2 planilhas)
New-Lookup     $P 'dgt_Area'            'Área' 'dgt_area' 'dgt_area_dgt_orcamentoplanilha_area'

# ------------------------------------------------------------
# 3) Colunas da linha
# ------------------------------------------------------------

Write-Host "`n3) Colunas de dgt_orcamentolinha" -ForegroundColor Cyan

$L = 'dgt_orcamentolinha'

New-Lookup     $L 'dgt_Planilha'     'Planilha' 'dgt_orcamentoplanilha' 'dgt_orcamentoplanilha_dgt_orcamentolinha'
New-Texto      $L 'dgt_Cenario'      'Cenário' 40
New-Texto      $L 'dgt_Grupo'        'Grupo (linha da DRE)' 200
New-Texto      $L 'dgt_Codigo'       'Código da conta' 40
New-Texto      $L 'dgt_Conta'        'Conta' 200
New-Texto      $L 'dgt_Descricao'    'Descrição' 400
New-Inteiro    $L 'dgt_Ordem'        'Ordem'

$meses = @(
  @('dgt_Jan', 'Janeiro'), @('dgt_Fev', 'Fevereiro'), @('dgt_Mar', 'Março'),
  @('dgt_Abr', 'Abril'),   @('dgt_Mai', 'Maio'),      @('dgt_Jun', 'Junho'),
  @('dgt_Jul', 'Julho'),   @('dgt_Ago', 'Agosto'),    @('dgt_Set', 'Setembro'),
  @('dgt_Out', 'Outubro'), @('dgt_Nov', 'Novembro'),  @('dgt_Dez', 'Dezembro')
)

foreach ($mes in $meses) {
  New-Decimal $L $mes[0] "$($mes[1]) (R$)"
}

New-SimNao     $L 'dgt_Ativo'        'Ativo' $true

# ------------------------------------------------------------
# 3b) Colunas do histórico
# ------------------------------------------------------------

Write-Host "`n3b) Colunas de dgt_orcamentoevento" -ForegroundColor Cyan

$E = 'dgt_orcamentoevento'

New-Lookup     $E 'dgt_Planilha'     'Planilha' 'dgt_orcamentoplanilha' 'dgt_orcamentoplanilha_dgt_orcamentoevento'
New-Texto      $E 'dgt_Tipo'         'Tipo' 60
New-TextoLongo $E 'dgt_Motivo'       'Motivo' 4000
New-Texto      $E 'dgt_UsuarioNome'  'Usuário' 200

# ------------------------------------------------------------
# 3c) Log de alterações
# ------------------------------------------------------------

Write-Host "`n3c) Colunas de dgt_orcamentoalteracao" -ForegroundColor Cyan

$A = 'dgt_orcamentoalteracao'

New-Lookup     $A 'dgt_Planilha'     'Planilha' 'dgt_orcamentoplanilha' 'dgt_orcamentoplanilha_dgt_orcamentoalteracao'
New-Texto      $A 'dgt_LinhaId'      'Id da linha' 100
New-Texto      $A 'dgt_Grupo'        'Grupo' 200
New-Texto      $A 'dgt_Codigo'       'Código da conta' 40
New-Texto      $A 'dgt_Conta'        'Conta' 200
New-Texto      $A 'dgt_Tipo'         'Tipo' 40
New-Texto      $A 'dgt_Origem'       'Origem' 40
New-TextoLongo $A 'dgt_Detalhes'     'Detalhes (JSON)' 4000
New-TextoLongo $A 'dgt_Resumo'       'Resumo' 4000
New-Texto      $A 'dgt_UsuarioNome'  'Usuário' 200

# ------------------------------------------------------------
# 3d) Regras de cálculo
# ------------------------------------------------------------

Write-Host "`n3d) Colunas de dgt_orcamentoregra" -ForegroundColor Cyan

$R = 'dgt_orcamentoregra'

New-Texto      $R 'dgt_ContaDestino'     'Conta calculada (código)' 40
New-Texto      $R 'dgt_ContaDestinoNome' 'Conta calculada' 200
New-Texto      $R 'dgt_TipoBase'         'Tipo de base' 20
New-TextoLongo $R 'dgt_Base'             'Base (JSON)' 4000
New-Percentual $R 'dgt_Percentual'       'Percentual (%)'
New-Inteiro    $R 'dgt_Ordem'            'Ordem'
New-SimNao     $R 'dgt_Ativo'            'Ativo' $true

# ------------------------------------------------------------
# 3e) Contas por área
# ------------------------------------------------------------

Write-Host "`n3e) Colunas de dgt_orcamentoconfigarea" -ForegroundColor Cyan

$C = 'dgt_orcamentoconfigarea'

New-Lookup     $C 'dgt_Area'         'Área' 'dgt_area' 'dgt_area_dgt_orcamentoconfigarea'
New-Texto      $C 'dgt_AreaNome'     'Nome da área' 200
New-TextoLongo $C 'dgt_Grupos'       'Grupos (JSON)' 4000
New-SimNao     $C 'dgt_Ativo'        'Ativo' $true
New-Texto      $C 'dgt_EquipeId'     'Equipe da área (id)' 100

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n4) Publicando as tabelas..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_orcamentoplanilha</entity><entity>dgt_orcamentolinha</entity><entity>dgt_orcamentoevento</entity><entity>dgt_orcamentoalteracao</entity><entity>dgt_orcamentoregra</entity><entity>dgt_orcamentoconfigarea</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 5) Privilégios (opcional)
#
# Gestores:        Criar, Ler, Gravar, Acrescentar e Acrescentar a
#                  no nível USUÁRIO (cada um só vê o que é seu).
#                  Sem Excluir: linha removida é desativada.
#                  + Acrescentar a (Organização) em dgt_usuario, para
#                  gravar a pesquisa "Gestor".
# Administradores: Criar, Ler, Gravar, Acrescentar e Acrescentar a
#                  no nível ORGANIZAÇÃO (vê todas as planilhas).
#                  Sem Excluir (histórico).
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

$tabelasOrcamento = @('dgt_orcamentoplanilha', 'dgt_orcamentolinha')
$acoesOrcamento = @('Create', 'Read', 'Write', 'Append', 'AppendTo')

if ($PapelGestores -or $PapelAdministradores) {
  Write-Host "`n5) Privilégios" -ForegroundColor Cyan
}

# Histórico: só criar e ler (nunca alterar nem excluir).
$acoesEvento = @('Create', 'Read', 'Append')

# Configuração (regras e contas por área): gestor só lê.
$tabelasConfig = @('dgt_orcamentoregra', 'dgt_orcamentoconfigarea')

# Assign: o gestor cria linhas/log já com a EQUIPE da área como
# proprietária (planilha compartilhada pelos gestores da área).
$tabelasComEquipe = @('dgt_orcamentoplanilha', 'dgt_orcamentolinha', 'dgt_orcamentoevento', 'dgt_orcamentoalteracao')

if ($PapelGestores) {
  Grant-Privilegios $PapelGestores 'Basic' $tabelasOrcamento $acoesOrcamento
  Grant-Privilegios $PapelGestores 'Basic' $tabelasComEquipe @('Assign')
  Grant-Privilegios $PapelGestores 'Basic' @('dgt_orcamentoevento', 'dgt_orcamentoalteracao') $acoesEvento
  Grant-Privilegios $PapelGestores 'Global' $tabelasConfig @('Read')
  Grant-Privilegios $PapelGestores 'Global' @('dgt_usuario', 'dgt_area') @('AppendTo')
}

if ($PapelAdministradores) {
  Grant-Privilegios $PapelAdministradores 'Global' $tabelasOrcamento $acoesOrcamento
  Grant-Privilegios $PapelAdministradores 'Global' $tabelasComEquipe @('Assign')
  Grant-Privilegios $PapelAdministradores 'Global' @('dgt_orcamentoevento', 'dgt_orcamentoalteracao') $acoesEvento
  Grant-Privilegios $PapelAdministradores 'Global' $tabelasConfig @('Create', 'Read', 'Write', 'Append')
  Grant-Privilegios $PapelAdministradores 'Global' @('dgt_usuario', 'dgt_area') @('AppendTo')
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green

if (-not $PapelGestores -or -not $PapelAdministradores) {
  Write-Host '  1. Perfis de segurança (Power Platform admin center > Ambiente > Configurações > Usuários + permissões > Perfis de segurança):'
  Write-Host '       Gestores        -> dgt_orcamentoplanilha e dgt_orcamentolinha: Criar, Ler, Gravar, Acrescentar, Acrescentar a = USUÁRIO'
  Write-Host '                          dgt_usuario: Acrescentar a = ORGANIZAÇÃO'
  Write-Host '       Administradores -> as duas tabelas: Criar, Ler, Gravar, Acrescentar, Acrescentar a = ORGANIZAÇÃO'
  Write-Host '       dgt_orcamentoevento e dgt_orcamentoalteracao: Criar, Ler, Acrescentar = USUÁRIO (Gestores) / ORGANIZAÇÃO (Administradores)'
  Write-Host '       dgt_orcamentoregra e dgt_orcamentoconfigarea: Ler = ORGANIZAÇÃO (Gestores); Criar, Ler, Gravar, Acrescentar = ORGANIZAÇÃO (Administradores)'
  Write-Host '       dgt_usuario e dgt_area: Acrescentar a = ORGANIZAÇÃO (os dois perfis)'
  Write-Host '       NÃO conceda Excluir (linha removida é desativada; o histórico fica).'
  Write-Host '       NÃO conceda nada ao perfil dos Colaboradores.'
}

Write-Host '  2. Rode sincronizar-equipes-orcamento.ps1 (cria a equipe de cada área e coloca os gestores nela).'
Write-Host '  3. (Recomendado) Ative a auditoria das duas tabelas (Propriedades da tabela > Auditar alterações nos dados).'
Write-Host '  4. Gere o pacote (npm run build) e publique o .sppkg.'
