<#
.SYNOPSIS
  Cria a coluna "Módulos de acesso" (dgt_modulosacesso) na tabela
  Usuário (dgt_usuario) do Portal de Conhecimento e Treinamentos DGT.

.DESCRIPTION
  Usada pela tela "Usuários e acessos" para guardar quais módulos cada
  usuário pode acessar (texto JSON, ex.: ["treinamentos","documentos"]).
  Vazio = todos os módulos que o perfil permite.

  Pode ser executado mais de uma vez: se a coluna já existir, nada muda.
  A coluna é criada dentro da solução informada.

  O nome DEVE ser igual ao usado em:
    src/webparts/portalTreinamentosWebPart/utils/modulosPortal.ts
    src/webparts/portalTreinamentosWebPart/services/AutorizacaoService.ts

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com
  (Power Apps > Configurações (engrenagem) > Detalhes da sessão > URL da instância)

.PARAMETER Solucao
  NOME (nome exclusivo) da solução, não o nome de exibição.
  (Power Apps > Soluções > coluna "Nome")

.PARAMETER Token
  Opcional. Token de acesso já obtido. Se não for informado, o script
  usa o módulo Az.Accounts (Connect-AzAccount) para obter um.

.EXAMPLE
  .\criar-coluna-modulos-acesso.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortalConhecimentoTreinamentos
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $Token
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.TrimEnd('/')
$Api = "$UrlAmbiente/api/data/v9.2"

$Tabela = 'dgt_usuario'
$Schema = 'dgt_ModulosAcesso'
$Logico = $Schema.ToLower()

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
# 1) Tabela dgt_usuario existe?
# ------------------------------------------------------------

if (-not (Test-Existe "EntityDefinitions(LogicalName='$Tabela')?`$select=LogicalName")) {
  throw "A tabela $Tabela não foi encontrada neste ambiente. Confira a URL do ambiente."
}

# ------------------------------------------------------------
# 2) Coluna dgt_modulosacesso
# ------------------------------------------------------------

Write-Host "`n1) Coluna $Tabela.$Logico" -ForegroundColor Cyan

if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Logico')?`$select=LogicalName") {

  Write-Host "  = $Tabela.$Logico já existe. Nada a fazer." -ForegroundColor Yellow
}
else {

  Write-Host "  + criando $Tabela.$Logico (Várias linhas de texto, 2000 caracteres)" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes" -Corpo @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    SchemaName    = $Schema
    DisplayName   = Rotulo 'Módulos de acesso'
    Description   = Rotulo 'Módulos do portal liberados ao usuário (JSON). Vazio = todos os que o perfil permite.'
    RequiredLevel = @{ Value = 'None' }
    MaxLength     = 2000
    Format        = 'TextArea'
  } | Out-Null
}

# ------------------------------------------------------------
# 3) Publicação (somente a tabela Usuário — mais rápido)
# ------------------------------------------------------------

Write-Host "`n2) Publicando a tabela $Tabela..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = "<importexportxml><entities><entity>$Tabela</entity></entities></importexportxml>"
} | Out-Null

# ------------------------------------------------------------
# 4) Conferência
# ------------------------------------------------------------

$coluna = Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Logico')?`$select=LogicalName,SchemaName,AttributeType"

Write-Host "`nConcluído: $($coluna.LogicalName) ($($coluna.AttributeType)) criada e publicada." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Atualize o portal (Ctrl+F5) e abra Usuários e acessos: o aviso amarelo deve sumir.'
Write-Host '  2. Os perfis de segurança que já leem/gravam a tabela Usuário passam a ler/gravar a coluna nova automaticamente.'
