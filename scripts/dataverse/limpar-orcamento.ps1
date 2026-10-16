<#
.SYNOPSIS
  Limpa os dados do PLANEJAMENTO ORÇAMENTÁRIO (planilhas de teste), para
  deixar o ambiente pronto para o uso real.

.DESCRIPTION
  Atua nas tabelas dgt_orcamentoplanilha, dgt_orcamentolinha,
  dgt_orcamentoevento e dgt_orcamentoalteracao (log). NÃO mexe na
  estrutura (tabelas e colunas), nas REGRAS DE CÁLCULO, nas CONTAS POR
  ÁREA, em usuários, áreas, treinamentos ou qualquer outro dado do
  portal.

  SEGURANÇA
    • Sem -Executar o script só SIMULA: mostra o que seria limpo e não
      altera nada. Rode primeiro assim.
    • Com -Executar ele pede para digitar LIMPAR antes de começar.
    • Antes de alterar qualquer registro, salva um BACKUP em JSON
      (planilhas, linhas e histórico) na pasta indicada.

  MODOS
    Excluir (padrão) → exclui planilhas, linhas e histórico. No próximo
                       acesso o gestor vê "Iniciar planilha" e o portal
                       recria as contas do modelo.
    Zerar            → mantém as planilhas e as linhas, mas zera os
                       valores de janeiro a dezembro e as descrições,
                       volta a situação para "Em preenchimento", limpa o
                       motivo da última devolução e exclui o histórico.

  FILTROS (opcionais; sem filtro = TODAS as planilhas)
    -Ano 2027                         → só as planilhas desse ano
    -EmailGestor fulano@dgt.com.br    → só a planilha desse gestor

  PERMISSÃO
    Quem executa precisa poder excluir/alterar registros dessas tabelas
    (ex.: perfil Administrador do sistema do ambiente). Os perfis do
    portal NÃO têm Excluir, de propósito.

.PARAMETER UrlAmbiente
  Endereço do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Ano
  Opcional. Limpa só as planilhas desse ano.

.PARAMETER EmailGestor
  Opcional. Limpa só as planilhas do gestor com esse e-mail
  (coluna dgt_email de dgt_usuario).

.PARAMETER Modo
  Excluir (padrão) ou Zerar.

.PARAMETER Executar
  Sem esta opção, apenas simula.

.PARAMETER PastaBackup
  Onde salvar o backup. Padrão: .\backup-orcamento-AAAAMMDD-HHMMSS

.PARAMETER Token
  Opcional. Token de acesso já obtido. Se não for informado, o script
  usa o módulo Az.Accounts (Connect-AzAccount) para obter um.

.EXAMPLE
  # 1) Simular (não altera nada)
  .\limpar-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com

.EXAMPLE
  # 2) Excluir tudo de verdade
  .\limpar-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Executar

.EXAMPLE
  # Zerar só as planilhas de 2027 de um gestor
  .\limpar-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Ano 2027 -EmailGestor anaelise.cunha@dgt.com.br -Modo Zerar -Executar
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [int] $Ano,
  [string] $EmailGestor,
  [ValidateSet('Excluir', 'Zerar')] [string] $Modo = 'Excluir',
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

# ------------------------------------------------------------
# 1) O que será limpo
# ------------------------------------------------------------

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
Write-Host "Modo:     $Modo$(if (-not $Executar) { '  (SIMULAÇÃO — nada será alterado)' })" -ForegroundColor Cyan

if (-not (Test-Tabela 'dgt_orcamentoplanilha')) {
  Write-Host 'A tabela dgt_orcamentoplanilha não existe neste ambiente. Nada a limpar.' -ForegroundColor Yellow
  return
}

$temEventos = Test-Tabela 'dgt_orcamentoevento'
$temLog = Test-Tabela 'dgt_orcamentoalteracao'

$filtros = @()

if ($Ano) {
  $filtros += "dgt_ano eq $Ano"
}

if ($EmailGestor) {
  $emailFiltro = $EmailGestor.Trim().Replace("'", "''")
  $usuarios = Get-Todos "dgt_usuarios?`$select=dgt_usuarioid,dgt_name&`$filter=dgt_email eq '$emailFiltro'"
  if ($usuarios.Count -eq 0) {
    Write-Host "Nenhum usuário com o e-mail $EmailGestor em dgt_usuario." -ForegroundColor Yellow
    return
  }
  $condicoes = $usuarios | ForEach-Object { "_dgt_gestor_value eq $($_.dgt_usuarioid)" }
  $filtros += '(' + ($condicoes -join ' or ') + ')'
}

$consulta = 'dgt_orcamentoplanilhas?$select=dgt_orcamentoplanilhaid,dgt_name,dgt_ano,dgt_gestornome,dgt_status'
if ($filtros.Count -gt 0) {
  $consulta += '&$filter=' + ($filtros -join ' and ')
}

$planilhas = @(Get-Todos $consulta)

if ($planilhas.Count -eq 0) {
  Write-Host 'Nenhuma planilha encontrada com esses filtros. Nada a limpar.' -ForegroundColor Green
  return
}

# Linhas e histórico de cada planilha (inclui linhas desativadas).
$linhasPorPlanilha = @{}
$eventosPorPlanilha = @{}
$totalLinhas = 0
$totalEventos = 0

foreach ($planilha in $planilhas) {
  $id = $planilha.dgt_orcamentoplanilhaid

  $linhas = @(Get-Todos "dgt_orcamentolinhas?`$filter=_dgt_planilha_value eq $id")
  $linhasPorPlanilha[$id] = $linhas
  $totalLinhas += $linhas.Count

  if ($temEventos) {
    $eventos = @(Get-Todos "dgt_orcamentoeventos?`$filter=_dgt_planilha_value eq $id")
  }
  else {
    $eventos = @()
  }
  if ($temLog) {
    $logs = @(Get-Todos "dgt_orcamentoalteracaos?`$select=dgt_orcamentoalteracaoid&`$filter=_dgt_planilha_value eq $id")
  }
  else {
    $logs = @()
  }

  # Log entra junto com o histórico (é apagado nos dois modos).
  $eventosPorPlanilha[$id] = @($eventos) + @($logs)
  $totalEventos += $eventosPorPlanilha[$id].Count
}

Write-Host ''
Write-Host 'Planilhas encontradas:' -ForegroundColor Cyan
$planilhas |
  Sort-Object dgt_ano, dgt_gestornome |
  ForEach-Object {
    $id = $_.dgt_orcamentoplanilhaid
    [PSCustomObject]@{
      Ano       = $_.dgt_ano
      Gestor    = $_.dgt_gestornome
      Situacao  = $_.dgt_status
      Linhas    = $linhasPorPlanilha[$id].Count
      HistoricoELog = $eventosPorPlanilha[$id].Count
    }
  } |
  Format-Table -AutoSize |
  Out-String -Width 200 |
  Write-Host

Write-Host "Total: $($planilhas.Count) planilha(s), $totalLinhas linha(s), $totalEventos registro(s) de histórico e log."

if ($Modo -eq 'Excluir') {
  Write-Host 'Ação: EXCLUIR planilhas, linhas, histórico e log de alterações.' -ForegroundColor Yellow
}
else {
  Write-Host 'Ação: ZERAR valores e descrições, voltar para "Em preenchimento" e excluir o histórico e o log.' -ForegroundColor Yellow
}

if (-not $Executar) {
  Write-Host ''
  Write-Host 'Simulação concluída. Para executar de verdade, rode de novo com -Executar.' -ForegroundColor Green
  return
}

# ------------------------------------------------------------
# 2) Confirmação
# ------------------------------------------------------------

Write-Host ''
$resposta = Read-Host 'Digite LIMPAR para continuar (qualquer outra coisa cancela)'

if ($resposta -cne 'LIMPAR') {
  Write-Host 'Cancelado. Nada foi alterado.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 3) Backup
# ------------------------------------------------------------

if (-not $PastaBackup) {
  $PastaBackup = Join-Path (Get-Location) ("backup-orcamento-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

New-Item -ItemType Directory -Path $PastaBackup -Force | Out-Null

$todasLinhas = @($linhasPorPlanilha.Values | ForEach-Object { $_ })
$todosEventos = @($eventosPorPlanilha.Values | ForEach-Object { $_ })

# Backup das planilhas com todas as colunas.
$planilhasCompletas = @($planilhas | ForEach-Object {
  Invoke-Dv -Metodo 'GET' -Caminho "dgt_orcamentoplanilhas($($_.dgt_orcamentoplanilhaid))"
})

$planilhasCompletas | ConvertTo-Json -Depth 10 | Out-File (Join-Path $PastaBackup 'planilhas.json') -Encoding utf8
$todasLinhas        | ConvertTo-Json -Depth 10 | Out-File (Join-Path $PastaBackup 'linhas.json')    -Encoding utf8
$todosEventos       | ConvertTo-Json -Depth 10 | Out-File (Join-Path $PastaBackup 'historico.json') -Encoding utf8

Write-Host "Backup salvo em: $PastaBackup" -ForegroundColor Green

# ------------------------------------------------------------
# 4) Limpeza
# ------------------------------------------------------------

$falhas = @()
$feitas = 0

function Invoke-Seguro {
  param([string] $Descricao, [scriptblock] $Acao)
  try {
    & $Acao
    $script:feitas++
  }
  catch {
    $script:falhas += "$Descricao : $($_.Exception.Message)"
  }
}

# Histórico e log (nos dois modos)
$i = 0
foreach ($evento in $todosEventos) {
  $i++
  Write-Progress -Activity 'Excluindo histórico e log' -Status "$i de $($todosEventos.Count)" -PercentComplete (100 * $i / [Math]::Max(1, $todosEventos.Count))
  if ($evento.dgt_orcamentoalteracaoid) {
    Invoke-Seguro "Log $($evento.dgt_orcamentoalteracaoid)" {
      Invoke-Dv -Metodo 'DELETE' -Caminho "dgt_orcamentoalteracaos($($evento.dgt_orcamentoalteracaoid))" | Out-Null
    }
  }
  else {
    Invoke-Seguro "Evento $($evento.dgt_orcamentoeventoid)" {
      Invoke-Dv -Metodo 'DELETE' -Caminho "dgt_orcamentoeventos($($evento.dgt_orcamentoeventoid))" | Out-Null
    }
  }
}
Write-Progress -Activity 'Excluindo histórico e log' -Completed

if ($Modo -eq 'Excluir') {

  # Linhas primeiro, depois as planilhas.
  $i = 0
  foreach ($linha in $todasLinhas) {
    $i++
    Write-Progress -Activity 'Excluindo linhas' -Status "$i de $($todasLinhas.Count)" -PercentComplete (100 * $i / [Math]::Max(1, $todasLinhas.Count))
    Invoke-Seguro "Linha $($linha.dgt_orcamentolinhaid)" {
      Invoke-Dv -Metodo 'DELETE' -Caminho "dgt_orcamentolinhas($($linha.dgt_orcamentolinhaid))" | Out-Null
    }
  }
  Write-Progress -Activity 'Excluindo linhas' -Completed

  foreach ($planilha in $planilhas) {
    Invoke-Seguro "Planilha $($planilha.dgt_name)" {
      Invoke-Dv -Metodo 'DELETE' -Caminho "dgt_orcamentoplanilhas($($planilha.dgt_orcamentoplanilhaid))" | Out-Null
    }
  }
}
else {

  # Linhas removidas pelo gestor continuam desativadas.
  $zerada = @{
    dgt_descricao = ''
    dgt_jan = 0; dgt_fev = 0; dgt_mar = 0; dgt_abr = 0; dgt_mai = 0; dgt_jun = 0
    dgt_jul = 0; dgt_ago = 0; dgt_set = 0; dgt_out = 0; dgt_nov = 0; dgt_dez = 0
  }

  $i = 0
  foreach ($linha in $todasLinhas) {
    $i++
    Write-Progress -Activity 'Zerando linhas' -Status "$i de $($todasLinhas.Count)" -PercentComplete (100 * $i / [Math]::Max(1, $todasLinhas.Count))
    Invoke-Seguro "Linha $($linha.dgt_orcamentolinhaid)" {
      Invoke-Dv -Metodo 'PATCH' -Caminho "dgt_orcamentolinhas($($linha.dgt_orcamentolinhaid))" -Corpo $zerada | Out-Null
    }
  }
  Write-Progress -Activity 'Zerando linhas' -Completed

  $planilhaZerada = @{
    dgt_status    = 'Em preenchimento'
    dgt_dataenvio = $null
  }

  # Colunas da devolução (só existem se o script de criação já foi
  # executado na versão com "Devolver para ajuste").
  foreach ($coluna in @('dgt_motivodevolucao', 'dgt_datadevolucao', 'dgt_devolvidopor', 'dgt_prazoajuste', 'dgt_fluxoestado', 'dgt_etapaatual', 'dgt_prazoetapa')) {
    if (Test-Coluna 'dgt_orcamentoplanilha' $coluna) {
      $planilhaZerada[$coluna] = $null
    }
  }

  foreach ($planilha in $planilhas) {
    Invoke-Seguro "Planilha $($planilha.dgt_name)" {
      Invoke-Dv -Metodo 'PATCH' -Caminho "dgt_orcamentoplanilhas($($planilha.dgt_orcamentoplanilhaid))" -Corpo $planilhaZerada | Out-Null
    }
  }
}

# ------------------------------------------------------------
# 5) Resultado
# ------------------------------------------------------------

Write-Host ''
Write-Host "Concluído: $feitas operação(ões) realizada(s)." -ForegroundColor Green

if ($falhas.Count -gt 0) {
  Write-Host "$($falhas.Count) falha(s):" -ForegroundColor Red
  $falhas | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  $falhas | Out-File (Join-Path $PastaBackup 'falhas.txt') -Encoding utf8
  Write-Host "Lista completa em $(Join-Path $PastaBackup 'falhas.txt'). Pode rodar o script de novo: ele só pega o que sobrou." -ForegroundColor Yellow
}

Write-Host "Backup: $PastaBackup"
