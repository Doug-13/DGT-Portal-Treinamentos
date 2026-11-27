<#
.SYNOPSIS
  Limpa os DADOS do módulo Fornecedores (cadastros de teste), para deixar
  o ambiente pronto para produção.

.DESCRIPTION
  Exclui os registros destas tabelas, das filhas para o fornecedor:
    dgt_colaboradordocumento    Documentos de colaborador
    dgt_fornecedorcolaborador   Colaboradores de fornecedor
    dgt_fornecedordocumento     Documentos de fornecedor
    dgt_fornecedorconsulta      Consultas (CNPJá, CEIS, CNEP)
    dgt_fornecedorhistorico     Histórico do cadastro
    dgt_fornecedorcontrato      Contratos
    dgt_fornecedorhomologacao   Ciclos de homologação (com o estado do
                                fluxo SUP-HOM, que fica no próprio ciclo)
    dgt_fornecedor              Fornecedores

  NÃO mexe em:
    • estrutura (tabelas, colunas, perfis de campo, Custom API, plugin);
    • TIPOS DE DOCUMENTO (configuração) — só com -IncluirTiposDocumento;
    • processo/fluxo SUP-HOM, áreas, usuários e dados de outros módulos;
    • arquivos no SharePoint (apague à mão as subpastas em
      Suprimentos › 03. CONTRATOS › Contratos › Contratos Fornecedores);
    • fila de e-mails dgt_implemail — só com -IncluirEmails, e apenas as
      linhas com remetente "fornecedores".

  SEGURANÇA
    • Sem -Executar o script só SIMULA: mostra quantos registros seriam
      excluídos e não altera nada. Rode primeiro assim.
    • Com -Executar ele pede para digitar LIMPAR antes de começar.
    • NÃO salva backup: os registros têm colunas protegidas (CNPJ, CPF,
      dados bancários) e um JSON local as deixaria expostas. Se precisar
      guardar algo, exporte pelo Power Apps antes.
    • O script nunca escreve na tela valores das colunas protegidas —
      só contagens e nomes de fornecedor/razão social.

  PERMISSÃO
    Quem executa precisa de Excluir nessas tabelas (ex.: Administrador do
    sistema do ambiente). Os perfis do portal não têm Excluir.

  PROTOCOLO
    O número automático (FORN-AAAA-0001) NÃO volta para 1 sozinho. Para
    reiniciar, use -ReiniciarProtocolo (SetAutoNumberSeed com 1).

.EXAMPLE
  # 1) Simular
  .\limpar-fornecedores.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com

.EXAMPLE
  # 2) Excluir de verdade, reiniciar o protocolo e limpar os e-mails do módulo
  .\limpar-fornecedores.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Executar -ReiniciarProtocolo -IncluirEmails
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [switch] $Executar,
  [switch] $IncluirTiposDocumento,
  [switch] $IncluirEmails,
  [switch] $ReiniciarProtocolo,
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

# Nome do conjunto (EntitySetName) da tabela, ou $null se não existir.
function Get-Conjunto {
  param([string] $Tabela)
  try {
    return (Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='$Tabela')?`$select=EntitySetName").EntitySetName
  }
  catch {
    return $null
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
# 1) O que será excluído (filhas primeiro)
# ------------------------------------------------------------

$tabelas = @(
  'dgt_colaboradordocumento',
  'dgt_fornecedorcolaborador',
  'dgt_fornecedordocumento',
  'dgt_fornecedorconsulta',
  'dgt_fornecedorhistorico',
  'dgt_fornecedorcontrato',
  'dgt_fornecedorhomologacao',
  'dgt_fornecedor'
)
if ($IncluirTiposDocumento) { $tabelas += 'dgt_tipodocumentofornecedor' }

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
if (-not $Executar) { Write-Host 'SIMULAÇÃO — nada será alterado.' -ForegroundColor Cyan }

$plano = @()

foreach ($tabela in $tabelas) {
  $conjunto = Get-Conjunto $tabela
  if (-not $conjunto) {
    Write-Host "  - $tabela não existe neste ambiente (ignorada)" -ForegroundColor DarkGray
    continue
  }
  $chave = "${tabela}id"
  # Só a chave: nenhuma coluna protegida é lida.
  $ids = @(Get-Todos "$conjunto`?`$select=$chave" | ForEach-Object { $_.$chave })
  $plano += [pscustomobject]@{ Tabela = $tabela; Conjunto = $conjunto; Ids = $ids }
}

if ($IncluirEmails) {
  $conjuntoEmail = Get-Conjunto 'dgt_implemail'
  if ($conjuntoEmail -and (Test-Coluna 'dgt_implemail' 'dgt_remetente')) {
    $ids = @(Get-Todos "$conjuntoEmail`?`$select=dgt_implemailid&`$filter=dgt_remetente eq 'fornecedores'" | ForEach-Object { $_.dgt_implemailid })
    $plano += [pscustomobject]@{ Tabela = 'dgt_implemail (remetente fornecedores)'; Conjunto = $conjuntoEmail; Ids = $ids }
  }
  else {
    Write-Host '  - dgt_implemail sem a coluna dgt_remetente: e-mails não serão filtrados nem excluídos' -ForegroundColor DarkGray
  }
}

Write-Host ''
$plano | ForEach-Object { [pscustomobject]@{ Tabela = $_.Tabela; Registros = $_.Ids.Count } } |
  Format-Table -AutoSize | Out-String -Width 200 | Write-Host

$fornecedores = $plano | Where-Object { $_.Tabela -eq 'dgt_fornecedor' }
if ($fornecedores -and $fornecedores.Ids.Count -gt 0) {
  Write-Host 'Fornecedores que serão excluídos:' -ForegroundColor Cyan
  Get-Todos "$($fornecedores.Conjunto)?`$select=dgt_name,dgt_protocolo&`$orderby=dgt_name" |
    ForEach-Object { Write-Host "  • $($_.dgt_name) ($($_.dgt_protocolo))" }
}

$total = ($plano | ForEach-Object { $_.Ids.Count } | Measure-Object -Sum).Sum
Write-Host ''
Write-Host "Total: $total registro(s)." -ForegroundColor Yellow
if ($ReiniciarProtocolo) { Write-Host 'Protocolo: será reiniciado (próximo = FORN-AAAA-0001).' -ForegroundColor Yellow }

if (-not $Executar) {
  Write-Host ''
  Write-Host 'Simulação concluída. Para executar de verdade, rode de novo com -Executar.' -ForegroundColor Green
  return
}

# ------------------------------------------------------------
# 2) Confirmação
# ------------------------------------------------------------

Write-Host ''
$resposta = Read-Host 'Digite LIMPAR para excluir (qualquer outra coisa cancela)'
if ($resposta -cne 'LIMPAR') {
  Write-Host 'Cancelado. Nada foi alterado.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 3) Exclusão
# ------------------------------------------------------------

$falhas = @()
$feitas = 0

foreach ($item in $plano) {
  $i = 0
  foreach ($id in $item.Ids) {
    $i++
    Write-Progress -Activity "Excluindo $($item.Tabela)" -Status "$i de $($item.Ids.Count)" -PercentComplete (100 * $i / [Math]::Max(1, $item.Ids.Count))
    try {
      Invoke-Dv -Metodo 'DELETE' -Caminho "$($item.Conjunto)($id)" | Out-Null
      $feitas++
    }
    catch {
      $status = $null
      if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
      # 404 = já foi excluído em cascata pelo pai.
      if ($status -ne 404) { $falhas += "$($item.Tabela) $id : $($_.Exception.Message)" }
    }
  }
  Write-Progress -Activity "Excluindo $($item.Tabela)" -Completed
}

if ($ReiniciarProtocolo -and (Get-Conjunto 'dgt_fornecedor')) {
  try {
    Invoke-Dv -Metodo 'POST' -Caminho 'SetAutoNumberSeed' -Corpo @{ EntityName = 'dgt_fornecedor'; AttributeName = 'dgt_protocolo'; Value = 1 } | Out-Null
    Write-Host 'Protocolo reiniciado: o próximo fornecedor recebe o número 0001.' -ForegroundColor Green
  }
  catch {
    $falhas += "Reiniciar protocolo: $($_.Exception.Message)"
  }
}

# ------------------------------------------------------------
# 4) Resultado
# ------------------------------------------------------------

Write-Host ''
Write-Host "Concluído: $feitas registro(s) excluído(s)." -ForegroundColor Green

if ($falhas.Count -gt 0) {
  Write-Host "$($falhas.Count) falha(s):" -ForegroundColor Red
  $falhas | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host 'Pode rodar o script de novo: ele só pega o que sobrou.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Falta à mão: apagar as pastas dos fornecedores de teste no SharePoint (Suprimentos › 03. CONTRATOS › Contratos › Contratos Fornecedores).' -ForegroundColor Cyan
