<#
.SYNOPSIS
  Arquitetura de Soluções — atualiza as opções da DEMANDA (dgt_bom_demanda):
    • Modalidade: "Proposta direta" passa a "Proposta Técnica" e entram
      "Dispensa de Licitação", "Inexigibilidade", "MIP" e
      "Proposta Comercial" (esta só para o canal Privado).
    • Tipo de projeto: entra "Locação 48 meses".

.DESCRIPTION
  Os VALORES das opções são fixos (o portal usa os mesmos números em
  services/bom/esquemaBom.ts). Pode ser executado mais de uma vez: o
  que já existe não é alterado. Nenhum registro é apagado.

.EXAMPLE
  .\atualizar-opcoes-bom.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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
# Auxiliares de opções (escolha local ou global)
# ------------------------------------------------------------

function Get-ConjuntoOpcoes {
  param([string] $Tabela, [string] $Coluna)
  $attr = Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Coluna')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet,GlobalOptionSet"
  $global = ($attr.GlobalOptionSet -and $attr.GlobalOptionSet.IsGlobal -eq $true) -or ($attr.OptionSet -and $attr.OptionSet.IsGlobal -eq $true)
  $conjunto = if ($attr.OptionSet) { $attr.OptionSet } else { $attr.GlobalOptionSet }
  return @{ Global = $global; Conjunto = $conjunto }
}

function Get-RotuloOpcao {
  param($Conjunto, [int] $Valor)
  foreach ($op in $Conjunto.Options) {
    if ($op.Value -eq $Valor) { return ($op.Label.LocalizedLabels | Select-Object -First 1).Label }
  }
  return $null
}

function Add-Opcao {
  param([string] $Tabela, [string] $Coluna, [int] $Valor, [string] $Texto)
  $info = Get-ConjuntoOpcoes $Tabela $Coluna
  $atual = Get-RotuloOpcao $info.Conjunto $Valor
  if ($atual) {
    Write-Host "  = $Coluna $Valor já existe ($atual)"
    return
  }
  Write-Host "  + $Coluna $Valor '$Texto'" -ForegroundColor Green
  $corpo = @{ Value = $Valor; Label = Rotulo $Texto; SolutionUniqueName = $Solucao }
  if ($info.Global) { $corpo.OptionSetName = $info.Conjunto.Name }
  else { $corpo.EntityLogicalName = $Tabela; $corpo.AttributeLogicalName = $Coluna }
  Invoke-Dv -Metodo 'POST' -Caminho 'InsertOptionValue' -Corpo $corpo | Out-Null
}

function Set-RotuloOpcao {
  param([string] $Tabela, [string] $Coluna, [int] $Valor, [string] $Texto)
  $info = Get-ConjuntoOpcoes $Tabela $Coluna
  $atual = Get-RotuloOpcao $info.Conjunto $Valor
  if (-not $atual) {
    Write-Host "  ! $Coluna $Valor não existe — nada a renomear" -ForegroundColor Yellow
    return
  }
  if ($atual -eq $Texto) {
    Write-Host "  = $Coluna $Valor já se chama '$Texto'"
    return
  }
  Write-Host "  ~ $Coluna $Valor '$atual' → '$Texto'" -ForegroundColor Green
  $corpo = @{ Value = $Valor; Label = Rotulo $Texto; MergeLabels = $true; SolutionUniqueName = $Solucao }
  if ($info.Global) { $corpo.OptionSetName = $info.Conjunto.Name }
  else { $corpo.EntityLogicalName = $Tabela; $corpo.AttributeLogicalName = $Coluna }
  Invoke-Dv -Metodo 'POST' -Caminho 'UpdateOptionValue' -Corpo $corpo | Out-Null
}

# ------------------------------------------------------------
# 1) Modalidade
# ------------------------------------------------------------

Write-Host "`n1) Modalidade (dgt_bom_demanda.dgt_bom_modalidade)" -ForegroundColor Cyan

Set-RotuloOpcao 'dgt_bom_demanda' 'dgt_bom_modalidade' 100000002 'Proposta Técnica'
Add-Opcao 'dgt_bom_demanda' 'dgt_bom_modalidade' 100000005 'Dispensa de Licitação'
Add-Opcao 'dgt_bom_demanda' 'dgt_bom_modalidade' 100000006 'Inexigibilidade'
Add-Opcao 'dgt_bom_demanda' 'dgt_bom_modalidade' 100000007 'MIP'
Add-Opcao 'dgt_bom_demanda' 'dgt_bom_modalidade' 100000008 'Proposta Comercial'

# ------------------------------------------------------------
# 2) Tipo de projeto
# ------------------------------------------------------------

Write-Host "`n2) Tipo de projeto (dgt_bom_demanda.dgt_bom_tipoprojeto)" -ForegroundColor Cyan

Add-Opcao 'dgt_bom_demanda' 'dgt_bom_tipoprojeto' 100000005 'Locação 48 meses'

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_bom_demanda</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
