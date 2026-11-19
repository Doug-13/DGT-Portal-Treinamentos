<#
.SYNOPSIS
  Alinhamento das tabelas — fases 3 e 5 (opção A): cria as colunas de lookup
  que ligam os módulos aos cadastros de fabricante, área e fornecedor.

.DESCRIPTION
  Só ACRESCENTA colunas opcionais (lookups). Não renomeia, não remove e não
  altera nenhuma coluna existente; as colunas de texto continuam como estão.

    dgt_declaracaofabricante.dgt_FabricanteCadastro   → dgt_fabricante
    dgt_certificacaofabricante.dgt_FabricanteCadastro → dgt_fabricante
    dgt_certificacaofabricante.dgt_AreaCadastro       → dgt_area
    dgt_terceiro.dgt_AreaCadastro                     → dgt_area
    dgt_terceiro.dgt_Fornecedor                       → dgt_fornecedor            (fase 5, opção A)
    dgt_terceiro.dgt_FornecedorColaborador            → dgt_fornecedorcolaborador (fase 5, opção A)
    dgt_bom_ro.dgt_bom_FabricanteCadastro             → dgt_fabricante

  As tabelas de destino (dgt_area, dgt_fabricante, dgt_fornecedor,
  dgt_fornecedorcolaborador) não ganham colunas: só passam a ser
  referenciadas. Ao excluir um registro do cadastro, o vínculo é apenas
  retirado (RemoveLink); nada é apagado em cascata.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/cadastros/ReferenciasCadastroService.ts

  Pode ser executado mais de uma vez: o que já existe é mantido.
  Plano: docs/alinhamento-tabelas.md

.PARAMETER UrlAmbiente
  URL do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Solucao
  Nome (exclusivo) da solução do portal.

.PARAMETER LoginPorCodigo
  Login por código no navegador (Connect-AzAccount -UseDeviceAuthentication).

.EXAMPLE
  .\scripts\dataverse\criar-colunas-alinhamento.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [switch] $LoginPorCodigo
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.Trim().Trim('"', "'").Trim().TrimEnd('/')
if ($UrlAmbiente -notmatch '^https://[a-z0-9-]+\.crm\d*\.dynamics\.com$') {
  throw "URL do ambiente inválida: '$UrlAmbiente'. Use o formato https://suaorg.crm2.dynamics.com"
}
$Solucao = $Solucao.Trim().Trim('"', "'").Trim()
$Api = "$UrlAmbiente/api/data/v9.2"

# ------------------------------------------------------------
# Autenticação (interativa; o token nunca é exibido)
# ------------------------------------------------------------

if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
  Write-Host 'Instalando o módulo Az.Accounts (apenas para o seu usuário)...' -ForegroundColor Yellow
  Install-Module Az.Accounts -Scope CurrentUser -Force -AllowClobber
}
Import-Module Az.Accounts

function Connect-Portal {
  Write-Host 'Abrindo login da Microsoft...' -ForegroundColor Cyan
  Connect-AzAccount -UseDeviceAuthentication:$LoginPorCodigo | Out-Null
}

if (-not (Get-AzContext)) { Connect-Portal }

function Get-Token {
  try { $t = Get-AzAccessToken -ResourceUrl $UrlAmbiente -ErrorAction Stop }
  catch {
    Write-Host 'A sessão salva do Az não serviu. Refazendo o login...' -ForegroundColor Yellow
    Disconnect-AzAccount -ErrorAction SilentlyContinue | Out-Null
    Clear-AzContext -Force -ErrorAction SilentlyContinue | Out-Null
    Connect-Portal
    $t = Get-AzAccessToken -ResourceUrl $UrlAmbiente -ErrorAction Stop
  }
  if ($t.Token -is [System.Security.SecureString]) {
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($t.Token)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  }
  return $t.Token
}

$Cabecalhos = @{
  'Authorization'            = "Bearer $(Get-Token)"
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
    $parametros.Body = [System.Text.Encoding]::UTF8.GetBytes(($Corpo | ConvertTo-Json -Depth 30))
  }
  try { Invoke-RestMethod @parametros }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $erro = New-Object System.Exception("Dataverse (HTTP $status): $($_.ErrorDetails.Message)")
    $erro.Data['Status'] = $status
    throw $erro
  }
}

function Test-Existe {
  param([string] $Caminho)
  try { Invoke-Dv -Metodo 'GET' -Caminho $Caminho | Out-Null; return $true }
  catch {
    if ($_.Exception.Data['Status'] -eq 404) { return $false }
    throw
  }
}

$org = Invoke-Dv -Metodo 'GET' -Caminho 'organizations?$select=languagecode'
$Idioma = [int]$org.value[0].languagecode
Write-Host "Ambiente: $UrlAmbiente  |  Solução: $Solucao  |  Idioma base: $Idioma" -ForegroundColor Cyan

function Rotulo {
  param([string] $Texto)
  @{
    '@odata.type'   = 'Microsoft.Dynamics.CRM.Label'
    LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $Texto; LanguageCode = $Idioma })
  }
}

# ------------------------------------------------------------
# Pré-requisitos: todas as tabelas envolvidas existem
# ------------------------------------------------------------

Write-Host "`n1) Conferindo as tabelas" -ForegroundColor Cyan
$tabelas = @('dgt_declaracaofabricante', 'dgt_certificacaofabricante', 'dgt_terceiro', 'dgt_bom_ro',
             'dgt_fabricante', 'dgt_area', 'dgt_fornecedor', 'dgt_fornecedorcolaborador')
$faltando = @($tabelas | Where-Object { -not (Test-Existe "EntityDefinitions(LogicalName='$_')?`$select=LogicalName") })
if ($faltando.Count) { throw "Tabelas não encontradas: $($faltando -join ', '). Nada foi alterado." }
Write-Host '  = todas as tabelas existem'

# ------------------------------------------------------------
# Lookups
# ------------------------------------------------------------

function New-Lookup {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Descricao, [string] $Referenciada, [string] $Relacionamento)

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
      Assign = 'NoCascade'; Delete = 'RemoveLink'; Merge = 'NoCascade'
      Reparent = 'NoCascade'; Share = 'NoCascade'; Unshare = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName    = $Schema
      DisplayName   = Rotulo $Nome
      Description   = Rotulo $Descricao
      RequiredLevel = @{ Value = 'None' }
    }
  } | Out-Null
}

Write-Host "`n2) Fabricante (fase 3)" -ForegroundColor Cyan
New-Lookup 'dgt_declaracaofabricante' 'dgt_FabricanteCadastro' 'Fabricante (cadastro)' `
  'Fabricante no cadastro dgt_fabricante. O nome continua em dgt_fabricante (texto).' 'dgt_fabricante' 'dgt_fabricante_dgt_declaracaofabricante_cad'
New-Lookup 'dgt_certificacaofabricante' 'dgt_FabricanteCadastro' 'Fabricante (cadastro)' `
  'Fabricante no cadastro dgt_fabricante (só certificações de fabricante). O nome continua em dgt_emissor.' 'dgt_fabricante' 'dgt_fabricante_dgt_certificacaofabricante_cad'
New-Lookup 'dgt_bom_ro' 'dgt_bom_FabricanteCadastro' 'Fabricante (cadastro)' `
  'Fabricante no cadastro dgt_fabricante. O nome continua em dgt_bom_fabricante (texto).' 'dgt_fabricante' 'dgt_fabricante_dgt_bom_ro_cad'

Write-Host "`n3) Área (fase 3)" -ForegroundColor Cyan
New-Lookup 'dgt_certificacaofabricante' 'dgt_AreaCadastro' 'Área (cadastro)' `
  'Área no cadastro dgt_area. O nome continua em dgt_area (texto).' 'dgt_area' 'dgt_area_dgt_certificacaofabricante_cad'
New-Lookup 'dgt_terceiro' 'dgt_AreaCadastro' 'Área (cadastro)' `
  'Área no cadastro dgt_area. O nome continua em dgt_area (texto).' 'dgt_area' 'dgt_area_dgt_terceiro_cad'

Write-Host "`n4) Terceiro ↔ colaborador de fornecedor (fase 5, opção A)" -ForegroundColor Cyan
New-Lookup 'dgt_terceiro' 'dgt_FornecedorColaborador' 'Colaborador de fornecedor' `
  'Mesmo indivíduo no cadastro de Fornecedores. Vínculo apenas: CPF, ASO e NR ficam em Fornecedores.' 'dgt_fornecedorcolaborador' 'dgt_fornecedorcolaborador_dgt_terceiro'
New-Lookup 'dgt_terceiro' 'dgt_Fornecedor' 'Fornecedor' `
  'Fornecedor do colaborador vinculado.' 'dgt_fornecedor' 'dgt_fornecedor_dgt_terceiro'

# ------------------------------------------------------------
# Publicação
# ------------------------------------------------------------

Write-Host "`n5) Publicando..." -ForegroundColor Cyan
Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities>' +
    '<entity>dgt_declaracaofabricante</entity><entity>dgt_certificacaofabricante</entity>' +
    '<entity>dgt_terceiro</entity><entity>dgt_bom_ro</entity>' +
    '</entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança (para gravar os vínculos):'
Write-Host '       Quem usa RH e Pessoas:'
Write-Host '         Acrescentar em dgt_terceiro, dgt_certificacaofabricante, dgt_declaracaofabricante'
Write-Host '         Acrescentar a em dgt_fabricante, dgt_area, dgt_fornecedor, dgt_fornecedorcolaborador'
Write-Host '         Ler em dgt_fornecedorcolaborador (opcional: sem ele o campo de vínculo não aparece;'
Write-Host '         o CPF continua protegido pela segurança de coluna)'
Write-Host '       Quem cadastra Registros de Oportunidade:'
Write-Host '         Ler e Acrescentar a em dgt_fabricante; Acrescentar em dgt_bom_ro'
Write-Host '     Sem esses privilégios o portal continua salvando normalmente; só o vínculo fica vazio.'
Write-Host '  2. Rode a migração (primeiro em simulação):'
Write-Host '       .\scripts\dataverse\migrar-referencias-alinhamento.ps1 -UrlAmbiente ... (simulação)'
