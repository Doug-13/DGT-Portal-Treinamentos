<#
.SYNOPSIS
  APAGA todos os documentos do Portal DGT no Dataverse, EXCETO os
  códigos informados em -Manter (padrão: CPU-POP-002).

.DESCRIPTION
  Operação IRREVERSÍVEL no Dataverse — por isso o script:

    1. Por padrão só SIMULA: lista o que seria mantido e apagado.
       Para apagar, use -Executar.
    2. Confere se TODOS os códigos de -Manter existem; se algum não
       for encontrado, PARA sem apagar nada (evita apagar tudo por um
       código digitado errado).
    3. Antes de apagar, salva um BACKUP (JSON) de cada tabela em
       Downloads\backup-limpeza-documentos-<data-hora>.
    4. Pede para digitar APAGAR antes de começar.
    5. Apaga primeiro os registros "filhos" e depois os documentos.

  O QUE É APAGADO (somente dos documentos que NÃO estão em -Manter)
    dgt_documento ............ o documento
    dgt_documentorevisao ..... revisões
    dgt_tarefafluxo .......... pendências do fluxo das revisões
    dgt_historicofluxo ....... tramitação do fluxo das revisões
    dgt_revisaoimpacto ....... impactos das revisões
    dgt_documentoprocesso .... vínculo documento × fluxo
    dgt_documentosetor ....... vínculo documento × setor
    dgt_treinamentodocumento . vínculo treinamento × documento
    dgt_auditorianegocio ..... histórico do documento

  NÃO É APAGADO
    • Os documentos de -Manter e tudo o que é deles.
    • Documentos de controle de TREINAMENTO (tipo TRN) — sem eles os
      treinamentos ficam "fora do fluxo". Para apagar também, use
      -IncluirTreinamentos.
    • Fluxos (dgt_processo, dgt_fluxo, metadados), processos de
      negócio, treinamentos, usuários e áreas.
    • Arquivos no SharePoint (passo manual no final).

.EXAMPLE
  .\limpar-documentos-exceto.ps1
  (simulação: mantém CPU-POP-002 e mostra o que seria apagado)

.EXAMPLE
  .\limpar-documentos-exceto.ps1 -Executar

.EXAMPLE
  .\limpar-documentos-exceto.ps1 -Manter 'CPU-POP-002','PRO-POP-001' -Executar
#>

param(
  [string]   $UrlAmbiente = 'https://orga1bd9fe9.crm2.dynamics.com',
  [string[]] $Manter = @('CPU-POP-002'),
  [switch]   $Executar,
  [switch]   $IncluirTreinamentos,
  [string]   $PastaBackup = (Join-Path "$env:USERPROFILE\Downloads" ("backup-limpeza-documentos-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
  [string]   $Token
)

$ErrorActionPreference = 'Stop'
$UrlAmbiente = $UrlAmbiente.TrimEnd('/')
$Api = "$UrlAmbiente/api/data/v9.2"
$FV = '@OData.Community.Display.V1.FormattedValue'

# ------------------------------------------------------------
# Autenticação (igual aos demais scripts)
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
  'Prefer'           = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=500'
}

function Invoke-Dv {
  param([string] $Metodo, [string] $Url)
  Invoke-RestMethod -Method $Metodo -Uri $Url -Headers $Cabecalhos
}

function Get-Tabela {
  param([string] $Nome)
  try {
    $def = Invoke-Dv 'GET' "$Api/EntityDefinitions(LogicalName='$Nome')?`$select=EntitySetName,PrimaryIdAttribute"
    return @{ Nome = $Nome; Conjunto = $def.EntitySetName; Chave = $def.PrimaryIdAttribute }
  }
  catch {
    return $null
  }
}

function Get-Registros {
  param($Tabela, [string] $Consulta)
  $url = "$Api/$($Tabela.Conjunto)"
  if ($Consulta) { $url += "?$Consulta" }
  $todos = @()
  while ($url) {
    $resposta = Invoke-Dv 'GET' $url
    $todos += $resposta.value
    $url = $resposta.'@odata.nextLink'
  }
  return ,$todos
}

function Get-Guid {
  param($Valor)
  return ([string]$Valor).Trim().Trim('{', '}').ToLower()
}

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
Write-Host ($(if ($Executar) { 'MODO: APAGAR' } else { 'MODO: SIMULAÇÃO (nada será apagado)' })) -ForegroundColor ($(if ($Executar) { 'Red' } else { 'Yellow' }))
Write-Host ''

# ------------------------------------------------------------
# 1) Documentos: o que fica e o que sai
# ------------------------------------------------------------

$tabDocumento = Get-Tabela 'dgt_documento'
if (-not $tabDocumento) { throw 'Tabela dgt_documento não encontrada neste ambiente.' }

$documentos = Get-Registros $tabDocumento '$select=dgt_documentoid,dgt_codigo,dgt_name,dgt_tipo'

$codigosManter = @($Manter | ForEach-Object { ([string]$_).Trim().ToUpper() } | Where-Object { $_ })

# Segurança: todos os códigos de -Manter precisam existir.
$naoEncontrados = @($codigosManter | Where-Object {
  $codigo = $_
  -not ($documentos | Where-Object { ([string]$_.dgt_codigo).Trim().ToUpper() -eq $codigo })
})

if ($naoEncontrados.Count -gt 0) {
  Write-Host "Código(s) de -Manter NÃO encontrado(s): $($naoEncontrados -join ', ')" -ForegroundColor Red
  Write-Host 'Nada foi apagado. Confira o código (ex.: CPU-POP-002) e rode de novo.' -ForegroundColor Red
  return
}

$manterDocs = @()
$apagarDocs = @()

foreach ($doc in $documentos) {
  $codigo = ([string]$doc.dgt_codigo).Trim().ToUpper()
  $tipo = ([string]$doc."dgt_tipo$FV").Trim().ToUpper()
  $ehTreinamento = $tipo -eq 'TRN' -or $tipo -like 'TRN *' -or $tipo -like 'TRN-*' -or $tipo -like '*TREINAMENTO*'

  if ($codigosManter -contains $codigo) {
    $manterDocs += $doc
  }
  elseif ($ehTreinamento -and -not $IncluirTreinamentos) {
    $manterDocs += $doc
  }
  else {
    $apagarDocs += $doc
  }
}

Write-Host "Documentos MANTIDOS ($($manterDocs.Count)):" -ForegroundColor Green
$manterDocs | Sort-Object dgt_codigo | ForEach-Object {
  Write-Host ("   {0,-20} {1}" -f $_.dgt_codigo, $_.dgt_name) -ForegroundColor Green
}
Write-Host ''
Write-Host "Documentos que serão APAGADOS ($($apagarDocs.Count)):" -ForegroundColor Yellow
$apagarDocs | Sort-Object dgt_codigo | ForEach-Object {
  Write-Host ("   {0,-20} {1}" -f $_.dgt_codigo, $_.dgt_name)
}
Write-Host ''

if ($apagarDocs.Count -eq 0) {
  Write-Host 'Nenhum documento para apagar.' -ForegroundColor Green
  return
}

$idsDocs = @{}
$apagarDocs | ForEach-Object { $idsDocs[(Get-Guid $_.dgt_documentoid)] = $true }

# ------------------------------------------------------------
# 2) Registros ligados aos documentos que saem
# ------------------------------------------------------------

# Revisões dos documentos que saem
$tabRevisao = Get-Tabela 'dgt_documentorevisao'
$revisoes = @()
if ($tabRevisao) {
  # Atribui antes de filtrar: Get-Registros devolve a lista como um
  # único objeto, e o pipeline direto filtraria a lista inteira.
  $todasRevisoes = Get-Registros $tabRevisao '$select=dgt_documentorevisaoid,_dgt_documento_value'
  $revisoes = @($todasRevisoes | Where-Object { $idsDocs.ContainsKey((Get-Guid $_._dgt_documento_value)) })
}
$idsRevisoes = @{}
$revisoes | ForEach-Object { $idsRevisoes[(Get-Guid $_.dgt_documentorevisaoid)] = $true }

# Lê uma tabela "filha" e fica só com os registros dos documentos/revisões que saem
function Get-Filhos {
  param([string] $NomeTabela, [string] $ColunaLookup, [hashtable] $Ids)
  $tabela = Get-Tabela $NomeTabela
  if (-not $tabela) { return @{ Info = $null; Registros = @() } }
  try {
    $todos = Get-Registros $tabela "`$select=$($tabela.Chave),$ColunaLookup"
  }
  catch {
    Write-Host "  Aviso: não foi possível ler $NomeTabela ($($_.Exception.Message))" -ForegroundColor DarkYellow
    return @{ Info = $tabela; Registros = @() }
  }
  $filtrados = @($todos | Where-Object { $Ids.ContainsKey((Get-Guid $_.$ColunaLookup)) })
  return @{ Info = $tabela; Registros = $filtrados }
}

$Plano = @(
  @{ Rotulo = 'Tramitação do fluxo das revisões'; Dados = (Get-Filhos 'dgt_historicofluxo' '_dgt_documentorevisao_value' $idsRevisoes) },
  @{ Rotulo = 'Pendências do fluxo das revisões';  Dados = (Get-Filhos 'dgt_tarefafluxo' '_dgt_documentorevisao_value' $idsRevisoes) },
  @{ Rotulo = 'Impactos das revisões';             Dados = (Get-Filhos 'dgt_revisaoimpacto' '_dgt_documentorevisao_value' $idsRevisoes) },
  @{ Rotulo = 'Vínculos documento × fluxo';        Dados = (Get-Filhos 'dgt_documentoprocesso' '_dgt_documento_value' $idsDocs) },
  @{ Rotulo = 'Vínculos documento × setor';        Dados = (Get-Filhos 'dgt_documentosetor' '_dgt_documento_value' $idsDocs) },
  @{ Rotulo = 'Vínculos treinamento × documento';  Dados = (Get-Filhos 'dgt_treinamentodocumento' '_dgt_documento_value' $idsDocs) }
)

# Histórico (auditoria) dos documentos que saem
$tabAuditoria = Get-Tabela 'dgt_auditorianegocio'
$auditoria = @()
if ($tabAuditoria) {
  try {
    $todaAuditoria = Get-Registros $tabAuditoria "`$select=$($tabAuditoria.Chave),dgt_registroid&`$filter=dgt_entidade eq 'dgt_documento'"
    $auditoria = @($todaAuditoria | Where-Object { $idsDocs.ContainsKey((Get-Guid $_.dgt_registroid)) })
  }
  catch {
    Write-Host "  Aviso: não foi possível ler dgt_auditorianegocio ($($_.Exception.Message))" -ForegroundColor DarkYellow
  }
}

$Plano += @(
  @{ Rotulo = 'Histórico dos documentos';  Dados = @{ Info = $tabAuditoria; Registros = $auditoria } },
  @{ Rotulo = 'Revisões dos documentos';   Dados = @{ Info = $tabRevisao; Registros = $revisoes } },
  @{ Rotulo = 'Documentos';                Dados = @{ Info = $tabDocumento; Registros = $apagarDocs } }
)

$total = 0
foreach ($item in $Plano) {
  $qtd = @($item.Dados.Registros).Count
  $total += $qtd
  Write-Host ("  {0,-40} {1,6} registro(s)" -f $item.Rotulo, $qtd)
}
Write-Host ''
Write-Host "Total a apagar: $total registro(s)." -ForegroundColor Cyan

if (-not $Executar) {
  Write-Host ''
  Write-Host 'Simulação concluída. Confira a lista acima e, para apagar de verdade, rode de novo com -Executar.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 3) Confirmação
# ------------------------------------------------------------

Write-Host ''
Write-Host 'ATENÇÃO: esta operação é IRREVERSÍVEL no Dataverse.' -ForegroundColor Red
$confirmacao = Read-Host 'Digite APAGAR para continuar'

if ($confirmacao -ne 'APAGAR') {
  Write-Host 'Cancelado. Nada foi apagado.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 4) Backup
# ------------------------------------------------------------

New-Item -ItemType Directory -Path $PastaBackup -Force | Out-Null

foreach ($item in $Plano) {
  if ($item.Dados.Info -and @($item.Dados.Registros).Count -gt 0) {
    $arquivo = Join-Path $PastaBackup "$($item.Dados.Info.Nome).json"
    $item.Dados.Registros | ConvertTo-Json -Depth 20 | Out-File -FilePath $arquivo -Encoding utf8
  }
}

# Lista completa dos documentos apagados (com o código, para conferência)
$apagarDocs | Select-Object dgt_documentoid, dgt_codigo, dgt_name |
  ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $PastaBackup 'documentos-apagados.json') -Encoding utf8

Write-Host "Backup salvo em: $PastaBackup" -ForegroundColor Green

# ------------------------------------------------------------
# 5) Exclusão (filhos → documentos)
# ------------------------------------------------------------

$apagados = 0
$falhas = @()

foreach ($item in $Plano) {

  $info = $item.Dados.Info
  $registros = @($item.Dados.Registros)

  if (-not $info -or $registros.Count -eq 0) { continue }

  $i = 0
  foreach ($registro in $registros) {
    $i++
    $id = $registro.($info.Chave)
    Write-Progress -Activity "Apagando: $($item.Rotulo)" -Status "$i de $($registros.Count)" -PercentComplete (100 * $i / $registros.Count)
    try {
      Invoke-Dv 'DELETE' "$Api/$($info.Conjunto)($id)" | Out-Null
      $apagados++
    }
    catch {
      $falhas += "$($info.Nome) $id — $($_.Exception.Message)"
    }
  }

  Write-Progress -Activity "Apagando: $($item.Rotulo)" -Completed
  Write-Host ("  ✓ {0,-40} {1,6} registro(s)" -f $item.Rotulo, $registros.Count) -ForegroundColor Green
}

Write-Host ''
Write-Host "Apagados: $apagados registro(s)." -ForegroundColor Green

if ($falhas.Count -gt 0) {
  $log = Join-Path $PastaBackup 'falhas.txt'
  $falhas | Out-File -FilePath $log -Encoding utf8
  Write-Host "Falharam: $($falhas.Count) registro(s). Detalhes em: $log" -ForegroundColor Yellow
  Write-Host 'Dica: rode o script de novo — registros que dependiam de outros costumam sair na segunda passada.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Passo manual: apague no SharePoint as pastas dos documentos apagados (a lista está em documentos-apagados.json no backup).' -ForegroundColor Cyan
Write-Host 'Depois, no portal, pressione Ctrl+F5.' -ForegroundColor Cyan
