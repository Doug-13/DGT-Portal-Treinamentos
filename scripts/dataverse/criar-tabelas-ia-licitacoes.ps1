<#
.SYNOPSIS
  Cria no Dataverse as tabelas da ANÁLISE POR IA das licitações:

    dgt_iaprompt            prompts da IA (com versões)
    dgt_licitacaoanaliseia  análises geradas (cache por edital)

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Os nomes DEVEM ser iguais aos de
    services/ia/PromptIaService.ts
    services/ia/LicitacaoAnaliseIaService.ts

  LGPD: não há colunas de CNPJ nem do link do PNCP. A chave do edital
  é a mesma (sem CNPJ) usada nos pareceres.

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-ia-licitacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# ------------------------------------------------------------
# 1) Prompts de IA
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_iaprompt" -ForegroundColor Cyan

New-Tabela 'dgt_IaPrompt' 'Prompt de IA' 'Prompts de IA' 'Prompts usados pelas análises de IA do portal. Cada alteração é uma nova versão; só uma fica ativa por chave.'

$P = 'dgt_iaprompt'

New-Texto      $P 'dgt_Chave'               'Chave' 100
New-Inteiro    $P 'dgt_Versao'              'Versão'
New-SimNao     $P 'dgt_Ativo'               'Ativo' $true
New-TextoLongo $P 'dgt_InstrucoesSistema'   'Instruções do sistema' 100000
New-TextoLongo $P 'dgt_ContextoEmpresa'     'Contexto da empresa' 100000
New-TextoLongo $P 'dgt_ModeloPrompt'        'Modelo do prompt' 100000
New-Texto      $P 'dgt_Provedor'            'Provedor' 20
New-Texto      $P 'dgt_ModeloIa'            'Modelo de IA' 200
New-Decimal    $P 'dgt_Temperatura'         'Temperatura'
New-Inteiro    $P 'dgt_MaxTokens'           'Máximo de tokens'
New-Inteiro    $P 'dgt_QtdHistorico'        'Pareceres no contexto'
New-SimNao     $P 'dgt_AnaliseAutomatica'   'Análise automática' $true
New-TextoLongo $P 'dgt_Observacoes'         'Observações' 4000
New-Texto      $P 'dgt_ResponsavelNome'     'Responsável' 200

# ------------------------------------------------------------
# 2) Análises de IA (cache por edital)
# ------------------------------------------------------------

Write-Host "`n2) Tabela dgt_licitacaoanaliseia" -ForegroundColor Cyan

New-Tabela 'dgt_LicitacaoAnaliseIa' 'Análise de IA de licitação' 'Análises de IA de licitações' 'Sugestão gerada pela IA para um edital do PNCP (cache). A decisão final fica em Pareceres de licitação.'

$A = 'dgt_licitacaoanaliseia'

New-Texto      $A 'dgt_ChaveEdital'         'Chave do edital' 400
New-Texto      $A 'dgt_Recomendacao'        'Recomendação' 20
New-Inteiro    $A 'dgt_Confianca'           'Confiança (%)'
New-TextoLongo $A 'dgt_Resumo'              'Resumo' 4000
New-TextoLongo $A 'dgt_RespostaJson'        'Resposta (JSON)' 100000
New-Texto      $A 'dgt_Provedor'            'Provedor' 20
New-Texto      $A 'dgt_ModeloIa'            'Modelo de IA' 200
New-Inteiro    $A 'dgt_PromptVersao'        'Versão do prompt'
New-Texto      $A 'dgt_Orgao'               'Órgão' 200
New-TextoLongo $A 'dgt_Objeto'              'Objeto' 4000

# ------------------------------------------------------------
# 2b) Custom API dgt_AnalisarLicitacaoIa (portal → plugin → Claude)
# ------------------------------------------------------------
# Sem plugin vinculado: o plugin AnalisarLicitacaoIaPlugin é
# registrado como PASSO (PostOperation) na mensagem desta API, para
# que a chave possa ficar na "Configuração segura" do passo.
# Só executa quem pode CRIAR em dgt_licitacaoanaliseia.

Write-Host "`n2b) Custom API dgt_AnalisarLicitacaoIa" -ForegroundColor Cyan

$existeApi = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_AnalisarLicitacaoIa'"

if ($existeApi.value.Count -gt 0) {
  Write-Host "  = Custom API já existe"
}
else {
  # O nome do privilégio segue o SchemaName da tabela (maiúsculas
  # variam: prvCreatedgt_LicitacaoAnaliseIa). Busca o nome exato.
  $privilegio = $null
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'prvCreatedgt_')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq 'prvcreatedgt_licitacaoanaliseia') { $privilegio = $item.name }
  }

  if ($privilegio) {
    Write-Host "  · privilégio exigido: $privilegio"
  }
  else {
    Write-Host "  ! privilégio de Criar em dgt_licitacaoanaliseia não encontrado; a API será criada sem essa restrição." -ForegroundColor Yellow
  }

  $corpoApi = @{
    uniquename                      = 'dgt_AnalisarLicitacaoIa'
    name                            = 'dgt_AnalisarLicitacaoIa'
    displayname                     = 'Analisar licitação com IA'
    description                     = 'Envia o prompt montado pelo portal ao Claude (chave no passo do plugin AnalisarLicitacaoIaPlugin).'
    bindingtype                     = 0
    isfunction                      = $false
    isprivate                       = $false
    allowedcustomprocessingsteptype = 2
    CustomAPIRequestParameters      = @(
      @{
        uniquename  = 'PayloadJson'
        name        = 'PayloadJson'
        displayname = 'PayloadJson'
        description = 'Prompt e parâmetros (JSON).'
        type        = 10
        isoptional  = $false
      }
    )
    CustomAPIResponseProperties     = @(
      @{
        uniquename  = 'ResultadoJson'
        name        = 'ResultadoJson'
        displayname = 'ResultadoJson'
        description = 'Texto gerado pela IA (JSON).'
        type        = 10
      }
    )
  }

  if ($privilegio) {
    $corpoApi.executeprivilegename = $privilegio
  }

  Write-Host "  + criando Custom API..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo $corpoApi | Out-Null
}

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_iaprompt</entity><entity>dgt_licitacaoanaliseia</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança de quem usa Licitações:'
Write-Host '       dgt_iaprompt           -> Ler (Organização). Administradores: Criar, Ler, Gravar.'
Write-Host '       dgt_licitacaoanaliseia -> Criar e Ler (Organização).'
Write-Host '  2. Plugin Registration Tool: Update do assembly (novo tipo AnalisarLicitacaoIaPlugin) e'
Write-Host '     Register New Step: Message dgt_AnalisarLicitacaoIa, PostOperation, Synchronous,'
Write-Host '     Secure Configuration = a chave do Claude (só ali).'
Write-Host '  3. No portal: Licitações > Configurar IA > provedor "API de IA" > Salvar nova versão.'
