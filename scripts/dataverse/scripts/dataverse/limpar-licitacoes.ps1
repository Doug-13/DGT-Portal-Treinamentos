<#
.SYNOPSIS
  Limpa os dados de TESTE do módulo LICITAÇÕES, para deixar o ambiente
  pronto para o uso real.

.DESCRIPTION
  Exclui os registros de:
    dgt_licitacaoalteracao       linha do tempo do acompanhamento
    dgt_licitacaoacompanhamento  editais acompanhados (inclui o
                                 identificador criptografado)
    dgt_licitacaoanaliseia       análises da IA (cache)
    dgt_licitacaoparecer         pareceres Participar / Não participar
    dgt_iaprompt                 SÓ com -IncluirPrompts (por padrão os
                                 prompts da IA são MANTIDOS: são
                                 configuração, não teste)

  NÃO mexe na estrutura (tabelas, colunas, Custom APIs, plugins), nem
  em treinamentos, documentos, processos, orçamento ou usuários.

  FORA DO DATAVERSE (este script não apaga):
    • tarefas criadas no ClickUp (lista Licitações);
    • pastas e arquivos criados no SharePoint (DGT - Comercial).
  O script LISTA esses links no fim e no backup, para você apagar à mão
  só o que foi teste.

  SEGURANÇA
    • Sem -Executar o script só SIMULA (conta o que seria apagado).
    • Com -Executar pede para digitar LIMPAR antes de começar.
    • Antes de apagar, salva um BACKUP em JSON (sem o identificador
      criptografado) na pasta indicada.

  PERMISSÃO
    Quem executa precisa poder excluir registros dessas tabelas (ex.:
    Administrador do sistema). Os perfis do portal NÃO têm Excluir.

.EXAMPLE
  # 1) Simular (não apaga nada)
  .\scripts\dataverse\limpar-licitacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com

.EXAMPLE
  # 2) Apagar de verdade (mantém os prompts da IA)
  .\scripts\dataverse\limpar-licitacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Executar

.EXAMPLE
  # Apagar também os prompts da IA
  .\scripts\dataverse\limpar-licitacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -IncluirPrompts -Executar
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [switch] $IncluirPrompts,
  [switch] $Executar,
  [string] $PastaBackup,
  [string] $Token
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.TrimEnd('/')
$Api = "$UrlAmbiente/api/data/v9.2"

# ------------------------------------------------------------
# Autenticação (mesma dos demais scripts)
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
  'Authorization'    = "Bearer $Token"
  'Accept'           = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  'Prefer'           = 'odata.maxpagesize=500'
}

function Invoke-Dv {
  param([string] $Metodo, [string] $Caminho, $Corpo)

  $uri = if ($Caminho -like 'http*') { $Caminho } else { "$Api/$Caminho" }

  $parametros = @{
    Method      = $Metodo
    Uri         = $uri
    Headers     = $Cabecalhos
    ContentType = 'application/json; charset=utf-8'
  }

  if ($null -ne $Corpo) {
    $json = $Corpo | ConvertTo-Json -Depth 30
    $parametros.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
  }

  Invoke-RestMethod @parametros
}

# GET com paginação (@odata.nextLink).
function Get-Todos {
  param([string] $Caminho)

  $lista = @()
  $proxima = $Caminho

  while ($proxima) {
    $resposta = Invoke-Dv -Metodo 'GET' -Caminho $proxima
    $lista += $resposta.value
    $proxima = $resposta.'@odata.nextLink'
  }

  return $lista
}

function Test-Tabela {
  param([string] $Nome)
  try {
    Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Nome')?`$select=LogicalName" | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Test-Coluna {
  param([string] $Tabela, [string] $Coluna)
  try {
    Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$Coluna')?`$select=LogicalName" | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Get-EntitySet {
  param([string] $Tabela)
  (Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Tabela')?`$select=EntitySetName").EntitySetName
}

# ------------------------------------------------------------
# 1) O que será limpo (ordem: filhos antes dos pais)
# ------------------------------------------------------------

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
if (-not $Executar) { Write-Host 'SIMULAÇÃO — nada será apagado. Use -Executar para apagar.' -ForegroundColor Yellow }

$tabelas = @(
  @{ Nome = 'dgt_licitacaoalteracao';      Id = 'dgt_licitacaoalteracaoid';      Rotulo = 'Alterações (linha do tempo)' },
  @{ Nome = 'dgt_licitacaoacompanhamento'; Id = 'dgt_licitacaoacompanhamentoid'; Rotulo = 'Acompanhamentos' },
  @{ Nome = 'dgt_licitacaoanaliseia';      Id = 'dgt_licitacaoanaliseiaid';      Rotulo = 'Análises da IA' },
  @{ Nome = 'dgt_licitacaoparecer';        Id = 'dgt_licitacaoparecerid';        Rotulo = 'Pareceres' }
)

if ($IncluirPrompts) {
  $tabelas += @{ Nome = 'dgt_iaprompt'; Id = 'dgt_iapromptid'; Rotulo = 'Prompts da IA' }
}

$dados = @{}
$total = 0

foreach ($t in $tabelas) {
  if (-not (Test-Tabela $t.Nome)) {
    Write-Host ("  - {0,-28} tabela não existe (ignorada)" -f $t.Rotulo)
    continue
  }
  $set = Get-EntitySet $t.Nome
  $t.Set = $set
  $registros = @(Get-Todos "$set")
  $dados[$t.Nome] = $registros
  $total += $registros.Count
  Write-Host ("  • {0,-28} {1,5} registro(s)" -f $t.Rotulo, $registros.Count)
}

if (-not $IncluirPrompts) {
  Write-Host '  = Prompts da IA                 mantidos (use -IncluirPrompts para apagar)'
}

# Links externos (ClickUp / SharePoint) dos acompanhamentos
$externos = @()
if ($dados.ContainsKey('dgt_licitacaoacompanhamento')) {
  foreach ($a in $dados['dgt_licitacaoacompanhamento']) {
    if ($a.dgt_clickupurl -or $a.dgt_pastasharepointurl) {
      $externos += [pscustomobject]@{
        Edital  = "$($a.dgt_orgao) $($a.dgt_numeroedital)"
        ClickUp = $a.dgt_clickupurl
        Pasta   = $a.dgt_pastasharepointurl
      }
    }
  }
}

if ($total -eq 0) {
  Write-Host "`nNada a limpar." -ForegroundColor Green
  return
}

if (-not $Executar) {
  Write-Host "`nTotal: $total registro(s) seriam apagados." -ForegroundColor Yellow
  if ($externos.Count -gt 0) {
    Write-Host "`nCriados FORA do Dataverse (apague à mão o que for teste):" -ForegroundColor Yellow
    $externos | Format-Table -AutoSize -Wrap | Out-String | Write-Host
  }
  Write-Host 'Para apagar de verdade, rode de novo com -Executar.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 2) Confirmação e backup
# ------------------------------------------------------------

$confirmacao = Read-Host "`nDigite LIMPAR para apagar $total registro(s) de Licitações"
if ($confirmacao -ne 'LIMPAR') {
  Write-Host 'Cancelado. Nada foi apagado.' -ForegroundColor Yellow
  return
}

if (-not $PastaBackup) {
  $PastaBackup = Join-Path (Get-Location) ("backup-licitacoes-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
New-Item -ItemType Directory -Force -Path $PastaBackup | Out-Null

foreach ($nome in $dados.Keys) {
  # O identificador criptografado NÃO vai para o backup.
  $limpos = $dados[$nome] | Select-Object * -ExcludeProperty dgt_identificadorcripto
  $limpos | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $PastaBackup "$nome.json") -Encoding utf8
}
if ($externos.Count -gt 0) {
  $externos | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $PastaBackup 'links-clickup-sharepoint.json') -Encoding utf8
}
Write-Host "Backup salvo em: $PastaBackup" -ForegroundColor Green

# ------------------------------------------------------------
# 3) Exclusão
# ------------------------------------------------------------

$apagados = 0
$falhas = 0

foreach ($t in $tabelas) {
  if (-not $dados.ContainsKey($t.Nome)) { continue }
  $lista = $dados[$t.Nome]
  if ($lista.Count -eq 0) { continue }
  Write-Host "`nApagando $($t.Rotulo)..." -ForegroundColor Cyan
  $i = 0
  foreach ($r in $lista) {
    $i++
    $id = $r.($t.Id)
    try {
      Invoke-Dv -Metodo 'DELETE' -Caminho "$($t.Set)($id)" | Out-Null
      $apagados++
    }
    catch {
      $falhas++
      Write-Host "  ! não apagado ($id): $($_.Exception.Message)" -ForegroundColor Red
    }
    if ($i % 25 -eq 0) { Write-Host "  $i de $($lista.Count)..." }
  }
}

Write-Host "`nConcluído: $apagados apagado(s), $falhas falha(s)." -ForegroundColor Green

if ($externos.Count -gt 0) {
  Write-Host "`nLembrete — criados FORA do Dataverse (apague à mão o que for teste):" -ForegroundColor Yellow
  $externos | Format-Table -AutoSize -Wrap | Out-String | Write-Host
  Write-Host "A lista também está em $PastaBackup\links-clickup-sharepoint.json"
}
