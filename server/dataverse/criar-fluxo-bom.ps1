<#
.SYNOPSIS
  Arquitetura de Soluções — prepara o B.O.M. para o fluxo de aprovação
  (processo ARQ-SOL, motor de fluxos do portal).

.DESCRIPTION
  1) Cria a coluna "Estado do fluxo (JSON)" em dgt_bom_bom
     (dgt_bom_fluxoestado): etapa atual, pendência com responsáveis e
     prazo, valores e histórico do fluxo de cada B.O.M.
  2) Inclui as etapas finais no campo Etapa (dgt_bom_bom.dgt_bom_etapa):
       100000007 Aprovado
       100000008 Encerrado (NO-GO)
     Os valores são fixos: o portal usa os mesmos números em
     services/bom/esquemaBom.ts.

  Pode ser executado mais de uma vez: o que já existe não é alterado.
  Nenhum registro é apagado. Nenhuma credencial é gravada: o acesso é
  feito com o seu login (Connect-AzAccount) ou com um token informado
  só na execução.

.EXAMPLE
  .\criar-fluxo-bom.ps1 -UrlAmbiente https://<seu-ambiente>.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

function New-TextoLongo {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    Format        = 'TextArea'
  }
}

# ------------------------------------------------------------
# 1) Coluna do estado do fluxo
# ------------------------------------------------------------

Write-Host "`n1) dgt_bom_bom.dgt_bom_fluxoestado" -ForegroundColor Cyan

New-TextoLongo 'dgt_bom_bom' 'dgt_bom_FluxoEstado' 'Estado do fluxo (JSON)' 1048576

# ------------------------------------------------------------
# 2) Etapas finais do fluxo
# ------------------------------------------------------------

Write-Host "`n2) Etapa (dgt_bom_bom.dgt_bom_etapa)" -ForegroundColor Cyan

Add-Opcao 'dgt_bom_bom' 'dgt_bom_etapa' 100000007 'Aprovado'
Add-Opcao 'dgt_bom_bom' 'dgt_bom_etapa' 100000008 'Encerrado (NO-GO)'

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_bom_bom</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Perfis de segurança: quem edita o B.O.M. já tem Gravar em dgt_bom_bom.'
Write-Host 'Aprovadores (ex.: Gestores da área ARQ) precisam de Ler e Gravar em dgt_bom_bom.'
