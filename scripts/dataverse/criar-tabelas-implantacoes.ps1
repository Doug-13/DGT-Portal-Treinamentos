<#
.SYNOPSIS
  Cria no Dataverse as tabelas do módulo Implantações (painel de gestão
  de implantações):
    dgt_implregistro   Dados do painel: um "documento" por linha
                       (projeto > coleção > documento, em JSON)
    dgt_implemail      Fila de e-mails dos relatórios (enviados por um
                       fluxo do Power Automate)
    dgt_impllog        Histórico de atividades do painel (acessos,
                       alterações de dados, usuários, setores, perfis)

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/implantacoes/esquemaImplantacoes.ts

  dgt_implregistro tem uma CHAVE ALTERNATIVA em dgt_chaveunica
  (projeto|coleção|documento): ela impede linhas duplicadas quando duas
  pessoas criam o mesmo documento ao mesmo tempo e serve de trava para o
  envio agendado de e-mails (só um navegador consegue criar a linha).

  Nada é apagado pela tela: excluir no painel marca dgt_excluido = Sim.

  Depois de rodar: liberar as duas tabelas nos perfis de segurança
  (docs/implantacoes.md, seção 2).

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-implantacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_EXCLUSIVO
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

function New-ChaveAlternativa {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string[]] $Colunas)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Keys(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = chave $Tabela.$logico já existe"
    return
  }

  Write-Host "  + chave alternativa $Tabela.$logico" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Keys" -Corpo @{
    SchemaName    = $Schema
    DisplayName   = Rotulo $Nome
    KeyAttributes = $Colunas
  } | Out-Null
}

# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_ImplRegistro' 'Registro de implantações' 'Registros de implantações' 'Dados do painel de gestão de implantações: um documento (JSON) por linha.'
New-Tabela 'dgt_ImplEmail' 'E-mail de implantações' 'E-mails de implantações' 'Fila de e-mails dos relatórios do painel de implantações (enviados pelo Power Automate).'
New-Tabela 'dgt_ImplLog' 'Atividade de implantações' 'Atividades de implantações' 'Histórico de atividades do painel de implantações (uma linha por evento; data = Criado em).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_implregistro (dgt_name = projeto|coleção|documento)" -ForegroundColor Cyan
$T = 'dgt_implregistro'
New-Texto      $T 'dgt_Balde'       'Projeto (balde)' 100
New-Texto      $T 'dgt_Colecao'     'Coleção' 100
New-Texto      $T 'dgt_Chave'       'Documento' 150
New-Texto      $T 'dgt_ChaveUnica'  'Chave única (projeto|coleção|documento)' 400
New-TextoLongo $T 'dgt_Dados'       'Dados (JSON)' 1048576
New-SimNao     $T 'dgt_Excluido'    'Excluído' $false

Write-Host "`n3) Colunas de dgt_implemail (dgt_name = assunto)" -ForegroundColor Cyan
$T = 'dgt_implemail'
New-Texto      $T 'dgt_Para'        'Para' 320
New-TextoLongo $T 'dgt_Corpo'       'Corpo (HTML)' 1048576
New-Texto      $T 'dgt_Tipo'        'Tipo de envio' 50
New-Texto      $T 'dgt_Motivo'      'Motivo' 200
New-Texto      $T 'dgt_Status'      'Status (Pendente / Enviado / Falha)' 30
New-TextoLongo $T 'dgt_Erro'        'Erro do envio' 4000

Write-Host "`n3b) Colunas de dgt_impllog (dgt_name = ação, ex.: dados.editar)" -ForegroundColor Cyan
$T = 'dgt_impllog'
New-Texto      $T 'dgt_UsuarioId'   'Usuário (id no painel)' 100
New-Texto      $T 'dgt_UsuarioNome' 'Usuário' 200
New-Texto      $T 'dgt_Setor'       'Setor' 100
New-Texto      $T 'dgt_Categoria'   'Categoria' 30
New-TextoLongo $T 'dgt_Alvo'        'Alvo (JSON)' 2000
New-TextoLongo $T 'dgt_Detalhe'     'Detalhe' 2000

# ------------------------------------------------------------
# 3) Chave alternativa (impede duplicar documentos)
# ------------------------------------------------------------

Write-Host "`n4) Chave alternativa" -ForegroundColor Cyan
New-ChaveAlternativa 'dgt_implregistro' 'dgt_ImplRegistroChaveUnica' 'Chave única do documento' @('dgt_chaveunica')

# ------------------------------------------------------------
# 4) Publicação
# ------------------------------------------------------------

Write-Host "`n5) Publicando as personalizações..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_implregistro</entity><entity>dgt_implemail</entity><entity>dgt_impllog</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'A chave alternativa é ativada em segundo plano: confira em Tabelas > Registro de implantações > Chaves se o status está "Ativo" antes de usar o painel.'
Write-Host 'Próximos passos (docs/implantacoes.md): perfis de segurança, pacote do portal, importação dos dados e fluxo de e-mail.'
