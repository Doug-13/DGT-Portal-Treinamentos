<#
.SYNOPSIS
  Cria no Dataverse a ADMINISTRAÇÃO DA IA do portal:

    dgt_iaconfiguracao      chave da IA (coluna PROTEGIDA), preços por modelo,
                            limites mensais por área e área de cada funcionalidade
    dgt_iaconsumo           consumo de IA: uma linha por chamada (usuário, área,
                            funcionalidade, modelo, tokens e custo) — SEM conteúdo
    dgt_usuarioarea         nova coluna dgt_principal (área principal do usuário)
    dgt_GerenciarIa         Custom API para salvar / testar / remover a chave

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  A chave fica em dgt_iaconfiguracao.dgt_chaveapi, coluna com segurança
  de coluna ligada e SEM perfil que dê leitura: só o SYSTEM (os plugins)
  e administradores do sistema conseguem lê-la. O portal nunca a lê.

  Os nomes DEVEM ser iguais aos de
    server/DGT.Treinamentos.Plugins/IaComum.cs e GerenciarIaPlugin.cs
    services/ia/IaAdminService.ts e services/dashboards/fontesDashboard.ts

.EXAMPLE
  .\scripts\dataverse\criar-ia-administracao.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# Mensagem real devolvida pelo Dataverse (em vez de só "erro 400").
function Get-ErroDv {
  param($Registro)
  $texto = $null
  if ($Registro.ErrorDetails -and $Registro.ErrorDetails.Message) {
    $texto = $Registro.ErrorDetails.Message
    try {
      $json = $texto | ConvertFrom-Json
      if ($json.error.message) { $texto = $json.error.message }
    }
    catch { }
  }
  if (-not $texto) { $texto = $Registro.Exception.Message }
  return $texto
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
  param([string] $Schema, [string] $Nome, [string] $Plural, [string] $Descricao, [string] $Propriedade = 'OrganizationOwned')

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
    OwnershipType          = $Propriedade
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

# Texto com SEGURANÇA DE COLUNA (sem perfil de leitura: só SYSTEM/admin do sistema).
function New-TextoProtegido {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
    IsSecured     = $true
  }
}

function New-DecimalPreciso {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Casas)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = $Casas
    MinValue      = 0
    MaxValue      = 100000000000
  }
}

function New-LookupUsuarioSistema {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Relacionamento)

  $logico = $Schema.ToLower()
  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }
  Write-Host "  + $Tabela.$logico (lookup → systemuser)" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'RelationshipDefinitions' -Corpo @{
    '@odata.type'        = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName           = $Relacionamento
    ReferencedEntity     = 'systemuser'
    ReferencingEntity    = $Tabela
    CascadeConfiguration = @{
      Assign = 'NoCascade'; Delete = 'RemoveLink'; Merge = 'NoCascade'
      Reparent = 'NoCascade'; Share = 'NoCascade'; Unshare = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName    = $Schema
      DisplayName   = Rotulo $Nome
      RequiredLevel = @{ Value = 'None' }
    }
  } | Out-Null
}

function Get-Privilegio {
  param([string] $Prefixo, [string] $NomeMinusculo)
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'$Prefixo')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq $NomeMinusculo) { return $item.name }
  }
  return $null
}

# ------------------------------------------------------------
# 1) Configuração da IA
# ------------------------------------------------------------

Write-Host "`n1) Tabela dgt_iaconfiguracao" -ForegroundColor Cyan

New-Tabela 'dgt_IaConfiguracao' 'Configuração de IA' 'Configurações de IA' 'Chave (protegida), preços por modelo, limites por área e área de cada funcionalidade da IA do portal.'

$C = 'dgt_iaconfiguracao'

New-TextoProtegido $C 'dgt_ChaveApi'                  'Chave da API (protegida)' 500
New-Texto          $C 'dgt_ChaveFinal'                'Final da chave' 10
New-DataHora       $C 'dgt_ChaveAtualizadaEm'         'Chave atualizada em'
New-Texto          $C 'dgt_ChaveAtualizadaPor'        'Chave atualizada por' 200
New-TextoLongo     $C 'dgt_PrecosJson'                'Preços por modelo (JSON)' 20000
New-TextoLongo     $C 'dgt_LimitesJson'               'Limites mensais por área (JSON)' 20000
New-TextoLongo     $C 'dgt_AreasFuncionalidadeJson'   'Área de cada funcionalidade (JSON)' 4000

# ------------------------------------------------------------
# 2) Consumo da IA
# ------------------------------------------------------------

Write-Host "`n2) Tabela dgt_iaconsumo" -ForegroundColor Cyan

New-Tabela 'dgt_IaConsumo' 'Consumo de IA' 'Consumos de IA' 'Uma linha por chamada à IA: usuário, área, funcionalidade, modelo, tokens e custo. Não guarda pergunta, resposta nem dados.'

$T = 'dgt_iaconsumo'

New-LookupUsuarioSistema $T 'dgt_Usuario' 'Usuário' 'dgt_systemuser_dgt_iaconsumo_usuario'
New-Texto          $T 'dgt_UsuarioNome'       'Nome do usuário' 200
New-Texto          $T 'dgt_AreaId'            'Id da área' 100
New-Texto          $T 'dgt_AreaNome'          'Área' 200
New-Texto          $T 'dgt_OrigemArea'        'Origem da área' 30
New-Texto          $T 'dgt_Funcionalidade'    'Funcionalidade' 100
New-Texto          $T 'dgt_Detalhe'           'Detalhe' 200
New-Texto          $T 'dgt_ModeloIa'          'Modelo de IA' 200
New-Inteiro        $T 'dgt_TokensEntrada'     'Tokens de entrada'
New-Inteiro        $T 'dgt_TokensSaida'       'Tokens de saída'
New-DecimalPreciso $T 'dgt_CustoUsd'          'Custo (US$)' 6
New-DecimalPreciso $T 'dgt_CustoBrl'          'Custo (R$)' 2
New-SimNao         $T 'dgt_PrecoConfigurado'  'Preço do modelo configurado' $false

# ------------------------------------------------------------
# 3) Área principal do usuário (reserva do consumo)
# ------------------------------------------------------------

Write-Host "`n3) Coluna dgt_usuarioarea.dgt_principal" -ForegroundColor Cyan

New-SimNao 'dgt_usuarioarea' 'dgt_Principal' 'Área principal' $false

# ------------------------------------------------------------
# 4) Publicação (antes de gravar dados nas tabelas novas)
# ------------------------------------------------------------

Write-Host "`n4) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_iaconfiguracao</entity><entity>dgt_iaconsumo</entity><entity>dgt_usuarioarea</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 5) Registro inicial "Claude" com os preços (US$ por milhão de tokens)
# ------------------------------------------------------------
# Preços da página oficial da Anthropic em 13/11/2026 (Haiku 5.5: prompts
# de até 100 mil tokens). Confira e ajuste em Indicadores › Administrar IA.

Write-Host "`n5) Configuração inicial" -ForegroundColor Cyan

$conjunto = (Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_iaconfiguracao')?`$select=EntitySetName").EntitySetName
$existente = Invoke-Dv -Metodo 'GET' -Caminho "$($conjunto)?`$select=dgt_iaconfiguracaoid&`$filter=dgt_name eq 'Claude'"

if ($existente.value.Count -gt 0) {
  Write-Host "  = registro Claude já existe (preços e limites mantidos)"
}
else {
  $precos = @{
    cotacaoBrl = 0
    modelos    = @{
      'claude-sonnet-5-5' = @{ entrada = 2;   saida = 10 }
      'claude-haiku-5-5'  = @{ entrada = 0.1; saida = 0.5 }
    }
  } | ConvertTo-Json -Depth 5 -Compress

  Write-Host "  + criando registro Claude com os preços padrão" -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho $conjunto -Corpo @{
    dgt_name                     = 'Claude'
    dgt_precosjson               = $precos
    dgt_limitesjson              = '{}'
    dgt_areasfuncionalidadejson  = '{}'
  } | Out-Null
}

# ------------------------------------------------------------
# 6) Custom API dgt_GerenciarIa (salvar / testar / remover a chave)
# ------------------------------------------------------------

Write-Host "`n6) Custom API dgt_GerenciarIa" -ForegroundColor Cyan

$privilegio = Get-Privilegio 'prvWritedgt_' 'prvwritedgt_iaconfiguracao'
if (-not $privilegio) {
  throw 'Privilégio de Gravar em dgt_iaconfiguracao ainda não apareceu (a tabela acabou de ser criada). Espere alguns minutos e rode o script de novo.'
}
Write-Host "  · privilégio exigido: $privilegio"

$consultaGerenciar = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_GerenciarIa'"

if ($consultaGerenciar.value.Count -gt 0) {
  Write-Host "  = Custom API já existe"
}
else {
  Write-Host "  + criando Custom API..." -ForegroundColor Green
  try {
    Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo @{
      uniquename                      = 'dgt_GerenciarIa'
      name                            = 'dgt_GerenciarIa'
      displayname                     = 'Gerenciar a chave da IA'
      description                     = 'Salva, testa ou remove a chave da IA (plugin GerenciarIaPlugin). A chave nunca volta ao navegador.'
      bindingtype                     = 0
      isfunction                      = $false
      isprivate                       = $false
      allowedcustomprocessingsteptype = 2
      executeprivilegename            = $privilegio
      CustomAPIRequestParameters      = @(
        @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Ação e chave (JSON).'; type = 10; isoptional = $false }
      )
      CustomAPIResponseProperties     = @(
        @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Resultado (JSON).'; type = 10 }
      )
    } | Out-Null
  }
  catch {
    Write-Host ("  ! " + (Get-ErroDv $_)) -ForegroundColor Red
    throw 'Não foi possível criar a Custom API (mensagem acima).'
  }
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança:'
Write-Host '       Administradores: dgt_iaconfiguracao -> Ler e Gravar; dgt_iaconsumo -> Ler.'
Write-Host '       Gestores (se forem ver o dashboard de consumo): dgt_iaconsumo -> Ler.'
Write-Host '       Quem usa a IA não precisa de nada novo (os plugins gravam o consumo como SYSTEM).'
Write-Host '  2. Plugin Registration Tool: Update do assembly e Register New Step:'
Write-Host '       Message dgt_GerenciarIa, Primary Entity none, PostOperation, Synchronous (sem Configuração segura).'
Write-Host '  3. Portal: Indicadores › Administrar IA › Chave › Substituir chave.'
