<#
.SYNOPSIS
  Adiciona a opção "Cancelada" à coluna Status (dgt_status) da tabela
  Revisão do Documento (dgt_documentorevisao).

.DESCRIPTION
  Usada pelo portal quando um ADMINISTRADOR volta uma etapa de uma
  revisão que está na primeira etapa do fluxo (ex.: Rev.01A em
  Elaboração): a revisão é cancelada e o documento volta para a
  revisão vigente. A revisão cancelada continua registrada (nada é
  apagado), apenas com o status "Cancelada".

  Pode ser executado mais de uma vez: se a opção já existir, nada é
  alterado. A alteração é feita dentro da solução informada e
  publicada no final.

.EXAMPLE
  .\adicionar-status-cancelada-revisao.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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
# Opção "Cancelada" em dgt_documentorevisao.dgt_status
# ------------------------------------------------------------

$Tabela = 'dgt_documentorevisao'
$Coluna = 'dgt_status'
$Rotulo = 'Cancelada'

$meta = Invoke-Dv -Metodo 'GET' -Caminho ("EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Coluna')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata" + '?$select=LogicalName&$expand=OptionSet,GlobalOptionSet')

$conjunto = $meta.OptionSet
if (-not $conjunto) { $conjunto = $meta.GlobalOptionSet }

$existentes = @()
foreach ($opcao in $conjunto.Options) {
  $texto = $null
  if ($opcao.Label.UserLocalizedLabel) { $texto = $opcao.Label.UserLocalizedLabel.Label }
  $existentes += "$($opcao.Value) = $texto"
  if ($texto -and $texto.Trim().ToLower() -eq $Rotulo.ToLower()) {
    Write-Host "  = A opção '$Rotulo' já existe (valor $($opcao.Value)). Nada foi alterado." -ForegroundColor Yellow
    return
  }
}

Write-Host 'Opções atuais de Status:' -ForegroundColor Cyan
$existentes | ForEach-Object { Write-Host "    $_" }

$corpo = @{
  Label              = (Rotulo $Rotulo)
  SolutionUniqueName = $Solucao
}

if ($conjunto.IsGlobal) {
  $corpo.OptionSetName = $conjunto.Name
  $publicar = "<importexportxml><optionsets><optionset>$($conjunto.Name)</optionset></optionsets></importexportxml>"
}
else {
  $corpo.EntityLogicalName    = $Tabela
  $corpo.AttributeLogicalName = $Coluna
  $publicar = "<importexportxml><entities><entity>$Tabela</entity></entities></importexportxml>"
}

Write-Host "  + Opção '$Rotulo' em $Tabela.$Coluna" -ForegroundColor Green
$resultado = Invoke-Dv -Metodo 'POST' -Caminho 'InsertOptionValue' -Corpo $corpo
Write-Host "    valor criado: $($resultado.NewOptionValue)"

Write-Host 'Publicando...' -ForegroundColor Cyan
Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{ ParameterXml = $publicar } | Out-Null

Write-Host 'Concluído. Recarregue o portal (Ctrl+F5) antes de testar.' -ForegroundColor Green
