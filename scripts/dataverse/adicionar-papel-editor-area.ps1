<#
.SYNOPSIS
  Adiciona o papel "Editor" ao campo Papel na área
  (dgt_usuarioarea.dgt_perfilarea) do Portal de Conhecimento e
  Treinamentos DGT.

.DESCRIPTION
  O papel Editor por área permite que o Administrador defina em quais
  áreas um Editor acompanha a equipe e atribui treinamentos.

  Cria a opção com o valor 100000003 (o mesmo usado em
  src/webparts/portalTreinamentosWebPart/services/AreaAdminService.ts).

  Pode ser executado mais de uma vez: se a opção já existir, nada muda.

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Solucao
  NOME (nome exclusivo) da solução, não o nome de exibição.

.PARAMETER Token
  Opcional. Token de acesso já obtido.

.EXAMPLE
  .\adicionar-papel-editor-area.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $Token
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.TrimEnd('/')
$Api = "$UrlAmbiente/api/data/v9.2"

$Tabela = 'dgt_usuarioarea'

$Logico = 'dgt_perfilarea'

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
  'Authorization'            = "Bearer $Token"
  'Accept'                   = 'application/json'
  'OData-MaxVersion'         = '4.0'
  'OData-Version'            = '4.0'
  'MSCRM.SolutionUniqueName' = $Solucao
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
$Valor = 100000003
$Rotulo = 'Editor'

# ------------------------------------------------------------
# 1) Campo Papel na área existe?
# ------------------------------------------------------------

Write-Host "`n1) Campo $Tabela.$Logico" -ForegroundColor Cyan

$caminhoAtributo = "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Logico')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet,GlobalOptionSet"

if (-not (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Logico')?`$select=LogicalName")) {
  throw "O campo $Tabela.$Logico não foi encontrado neste ambiente. Confira a URL do ambiente."
}

$atributo = Invoke-Dv -Metodo 'GET' -Caminho $caminhoAtributo

$conjunto = $atributo.OptionSet
$global = $false

if ($null -eq $conjunto -or $null -eq $conjunto.Options) {
  $conjunto = $atributo.GlobalOptionSet
  $global = $true
}
elseif ($conjunto.IsGlobal) {
  $global = $true
}

$existentes = @($conjunto.Options | ForEach-Object { [int]$_.Value })

Write-Host "  Opções atuais: $($existentes -join ', ')"

# ------------------------------------------------------------
# 2) Inclui a opção Editor
# ------------------------------------------------------------

Write-Host "`n2) Opção '$Rotulo' ($Valor)" -ForegroundColor Cyan

if ($existentes -contains $Valor) {

  Write-Host "  = a opção $Valor já existe. Nada a fazer." -ForegroundColor Yellow
}
else {

  $corpo = @{
    Value              = $Valor
    Label              = Rotulo $Rotulo
    Description        = Rotulo 'Cria conteúdo nos módulos liberados e acompanha a equipe desta área.'
    SolutionUniqueName = $Solucao
  }

  if ($global) {
    $corpo.OptionSetName = $conjunto.Name
    Write-Host "  + incluindo no conjunto global $($conjunto.Name)" -ForegroundColor Green
  }
  else {
    $corpo.EntityLogicalName = $Tabela
    $corpo.AttributeLogicalName = $Logico
    Write-Host "  + incluindo no campo $Tabela.$Logico" -ForegroundColor Green
  }

  Invoke-Dv -Metodo 'POST' -Caminho 'InsertOptionValue' -Corpo $corpo | Out-Null
}

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan

if ($global) {
  Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
    ParameterXml = "<importexportxml><optionsets><optionset>$($conjunto.Name)</optionset></optionsets></importexportxml>"
  } | Out-Null
}
else {
  Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
    ParameterXml = "<importexportxml><entities><entity>$Tabela</entity></entities></importexportxml>"
  } | Out-Null
}

Write-Host "`nConcluído: o papel 'Editor' já pode ser escolhido em Usuários e acessos > Papéis por área." -ForegroundColor Green
