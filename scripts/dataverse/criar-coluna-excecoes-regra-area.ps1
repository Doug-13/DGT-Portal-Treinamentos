<#
.SYNOPSIS
  Cria a coluna "Usuários excluídos" (dgt_usuariosexcluidos) em
  dgt_treinamentoarea (regra de atribuição por área).

.DESCRIPTION
  Atribuir → Por área: permite escolher quem da área NÃO recebe o
  treinamento (ex.: área com 10 pessoas, atribuir só para 8).

  A coluna guarda os ids de dgt_usuario separados por ';'. O
  AtribuirPorAreaPlugin não atribui a essas pessoas, nem quando a regra
  é criada/reativada nem se elas saírem e voltarem para a área.

  ORDEM DE IMPLANTAÇÃO
    1. Este script (cria a coluna).
    2. Publicar a nova versão do DGT.Treinamentos.Plugins
       (AtribuirPorAreaPlugin) no Plugin Registration Tool.
       O registro dos passos NÃO muda: a Post Image "PostImage"
       já tem todos os campos.
    3. Publicar a nova versão do portal (npm run build).
  Se o portal for publicado antes da coluna, a atribuição por área
  continua funcionando; só a remoção de pessoas fica bloqueada, com
  aviso na tela.

  Pode ser executado mais de uma vez: se a coluna já existir, nada é
  alterado. Tudo é criado dentro da solução informada.

.EXAMPLE
  .\criar-coluna-excecoes-regra-area.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

function New-Texto {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
  }
}

# ------------------------------------------------------------
# 1) Coluna
# ------------------------------------------------------------

Write-Host "`n1) Coluna" -ForegroundColor Cyan

# 100.000 caracteres: cabem mais de 2.500 ids (36 caracteres + ';').
New-TextoLongo 'dgt_treinamentoarea' 'dgt_UsuariosExcluidos' 'Usuários excluídos' 100000

# ------------------------------------------------------------
# 2) Publicação
# ------------------------------------------------------------

Write-Host "`n2) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_treinamentoarea</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Publique a nova versão do DGT.Treinamentos.Plugins (AtribuirPorAreaPlugin) no Plugin Registration Tool.'
Write-Host '  2. Publique a nova versão do portal (npm run build).'
Write-Host '  3. Atribuir → Por área: selecione as áreas e desmarque quem não deve receber o treinamento.'
