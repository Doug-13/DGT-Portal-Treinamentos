<#
.SYNOPSIS
  Prepara o Dataverse para o CONTROLE DOCUMENTAL DOS TREINAMENTOS:
  cria a opção "TRN" no Tipo do documento (dgt_documento.dgt_tipo).

.DESCRIPTION
  Cada treinamento passa a ter um documento de controle (mesmo código,
  tipo TRN) que segue o fluxo do processo de treinamentos (TRE-001).

  Pode ser executado mais de uma vez: se a opção já existir, nada é
  alterado. Tudo é criado dentro da solução informada.

  O rótulo DEVE ser igual a CONTROLE_DOCUMENTAL.TIPO_DOCUMENTO em
  src/webparts/portalTreinamentosWebPart/constants/controleDocumental.ts

.EXAMPLE
  .\criar-tipo-documento-treinamento.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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
# 1) Opção TRN em dgt_documento.dgt_tipo
# ------------------------------------------------------------

$RotuloTipo = 'TRN'

Write-Host "`n1) Tipo de documento '$RotuloTipo'" -ForegroundColor Cyan

$attr = Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_documento')/Attributes(LogicalName='dgt_tipo')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet,GlobalOptionSet"

# Atenção: o Dataverse devolve o conjunto em "GlobalOptionSet" mesmo
# quando a escolha é LOCAL (só da coluna). O que define se é global é
# a propriedade IsGlobal. Para escolha local, InsertOptionValue exige
# EntityLogicalName + AttributeLogicalName (e não OptionSetName).
$ehGlobal = $false
if ($attr.GlobalOptionSet -and $attr.GlobalOptionSet.IsGlobal -eq $true) { $ehGlobal = $true }
if ($attr.OptionSet -and $attr.OptionSet.IsGlobal -eq $true) { $ehGlobal = $true }

$conjunto = if ($attr.OptionSet) { $attr.OptionSet } else { $attr.GlobalOptionSet }

Write-Host "  = escolha $(if ($ehGlobal) { 'global' } else { 'local (somente desta coluna)' })"

$existe = $false
foreach ($op in $conjunto.Options) {
  foreach ($rot in $op.Label.LocalizedLabels) {
    if ($rot.Label -eq $RotuloTipo) { $existe = $true }
  }
}

if ($existe) {
  Write-Host "  = opção '$RotuloTipo' já existe"
}
else {
  Write-Host "  + criando opção '$RotuloTipo'" -ForegroundColor Green

  $corpo = @{
    Label              = Rotulo $RotuloTipo
    Description        = Rotulo 'Documento de controle de treinamento'
    SolutionUniqueName = $Solucao
  }

  if ($ehGlobal) {
    $corpo.OptionSetName = $conjunto.Name
  }
  else {
    $corpo.EntityLogicalName = 'dgt_documento'
    $corpo.AttributeLogicalName = 'dgt_tipo'
  }

  Invoke-Dv -Metodo 'POST' -Caminho 'InsertOptionValue' -Corpo $corpo | Out-Null
}

# ------------------------------------------------------------
# 2) Conferências (somente leitura)
# ------------------------------------------------------------

Write-Host "`n2) Conferências" -ForegroundColor Cyan

$status = Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_documentorevisao')/Attributes(LogicalName='dgt_status')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet,GlobalOptionSet"
$conjStatus = if ($status.OptionSet) { $status.OptionSet } else { $status.GlobalOptionSet }
$rotulos = @()
foreach ($op in $conjStatus.Options) { foreach ($rot in $op.Label.LocalizedLabels) { $rotulos += $rot.Label } }

foreach ($necessario in @('Elaboração', 'Vigente')) {
  if ($rotulos -contains $necessario) {
    Write-Host "  = dgt_documentorevisao.dgt_status possui '$necessario'"
  }
  else {
    Write-Host "  ! dgt_documentorevisao.dgt_status NÃO possui '$necessario' (crie a opção manualmente)" -ForegroundColor Yellow
  }
}

try {
  $processos = Invoke-Dv -Metodo 'GET' -Caminho "dgt_processos?`$select=dgt_name&`$filter=contains(dgt_name,'reinamento')&`$top=5"
  if ($processos.value.Count -gt 0) {
    Write-Host "  = processo(s) de treinamento encontrado(s): $(($processos.value | ForEach-Object { $_.dgt_name }) -join ', ')"
  }
  else {
    Write-Host "  ! nenhum processo com 'treinamento' no nome. Cadastre o processo TRE-001 no portal (Processos) e publique o fluxo." -ForegroundColor Yellow
  }
}
catch {
  Write-Host "  ? não foi possível conferir os processos (confira no portal se o TRE-001 existe)." -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 3) Publicação
# ------------------------------------------------------------

Write-Host "`n3) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_documento</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. No portal, confira se o processo TRE-001 tem o fluxo PUBLICADO.'
Write-Host '  2. Perfis de segurança (Editores/Administradores de treinamento):'
Write-Host '       dgt_documento, dgt_documentorevisao, dgt_treinamentodocumento,'
Write-Host '       dgt_documentoprocesso: Criar, Ler, Gravar, Acrescentar, Acrescentar a (Organização).'
Write-Host '       NÃO conceda Excluir (histórico).'
Write-Host '  3. Gere a versão do portal (Gerar-Versao.ps1) e publique o .sppkg.'
