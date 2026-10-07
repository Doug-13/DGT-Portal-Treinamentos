<#
.SYNOPSIS
  APAGA os documentos e os fluxos de processos de TESTE do Portal DGT
  no Dataverse (ambiente "DGT – Automação Processos").

.DESCRIPTION
  Uso previsto: limpar a base de testes antes de começar a usar o portal
  de verdade. Operação IRREVERSÍVEL no Dataverse — por isso o script:

    1. Por padrão só SIMULA: lista quantos registros apagaria em cada
       tabela e não apaga nada. Para apagar, use -Executar.
    2. Antes de apagar, salva um BACKUP (JSON) de cada tabela em
       Downloads\backup-limpeza-<data-hora>.
    3. Pede para digitar APAGAR antes de começar.
    4. Apaga primeiro os registros "filhos" e depois os "pais".

  O QUE É APAGADO (sempre)
    Documentos .......... dgt_documento, dgt_documentorevisao,
                          dgt_documentoprocesso (vínculo com processo),
                          dgt_documentosetor, dgt_treinamentodocumento
                          (vínculo treinamento × documento),
                          dgt_revisaoimpacto, histórico dos documentos
                          (dgt_auditorianegocio com entidade dgt_documento)
    Fluxo das revisões .. dgt_tarefafluxo, dgt_historicofluxo
    Fluxos de processos . dgt_fluxo (todas as versões: rascunho,
                          publicada e arquivada)

  OPCIONAL
    -IncluirProcessos       também apaga dgt_processo e
                            dgt_processometadado (o cadastro dos processos
                            e seus metadados)
    -IncluirRetreinamentos  também apaga as atribuições de treinamento
                            geradas por publicação de documentos
                            (dgt_usuariotreinamento com origem
                            "Revisão documental")

  NÃO É APAGADO
    Treinamentos, trilhas, módulos, avaliações, usuários, áreas, acessos
    e os arquivos no SharePoint (veja o passo manual no final).

.EXAMPLE
  .\limpar-documentos-e-fluxos.ps1
  (simulação: só mostra o que seria apagado)

.EXAMPLE
  .\limpar-documentos-e-fluxos.ps1 -Executar
  (apaga documentos, fluxos das revisões e fluxos dos processos)

.EXAMPLE
  .\limpar-documentos-e-fluxos.ps1 -Executar -IncluirProcessos -IncluirRetreinamentos
#>

param(
  [string] $UrlAmbiente = 'https://orga1bd9fe9.crm2.dynamics.com',
  [switch] $Executar,
  [switch] $IncluirProcessos,
  [switch] $IncluirRetreinamentos,
  [string] $PastaBackup = (Join-Path "$env:USERPROFILE\Downloads" ("backup-limpeza-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
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

# Metadados da tabela (entity set e chave primária)
function Get-Tabela {
  param([string] $Nome)
  try {
    $def = Invoke-Dv 'GET' "$Api/EntityDefinitions(LogicalName='$Nome')?`$select=EntitySetName,PrimaryIdAttribute"
    return @{ Nome = $Nome; Conjunto = $def.EntitySetName; Chave = $def.PrimaryIdAttribute }
  }
  catch {
    return $null   # tabela não existe neste ambiente
  }
}

# Lê todos os registros (todas as páginas)
function Get-Registros {
  param($Tabela, [string] $Filtro)
  $url = "$Api/$($Tabela.Conjunto)"
  if ($Filtro) { $url += "?`$filter=$Filtro" }
  $todos = @()
  while ($url) {
    $resposta = Invoke-Dv 'GET' $url
    $todos += $resposta.value
    $url = $resposta.'@odata.nextLink'
  }
  return ,$todos
}

# ------------------------------------------------------------
# O que será apagado (ordem: filhos → pais)
# ------------------------------------------------------------

$Plano = @(
  @{ Tabela = 'dgt_historicofluxo';       Rotulo = 'Histórico do fluxo das revisões' },
  @{ Tabela = 'dgt_tarefafluxo';          Rotulo = 'Tarefas (pendências) do fluxo' },
  @{ Tabela = 'dgt_revisaoimpacto';       Rotulo = 'Impactos das revisões' },
  @{ Tabela = 'dgt_documentoprocesso';    Rotulo = 'Vínculos documento × processo' },
  @{ Tabela = 'dgt_documentosetor';       Rotulo = 'Vínculos documento × setor' },
  @{ Tabela = 'dgt_treinamentodocumento'; Rotulo = 'Vínculos treinamento × documento' },
  @{ Tabela = 'dgt_auditorianegocio';     Rotulo = 'Histórico dos documentos'; Filtro = "dgt_entidade eq 'dgt_documento'" }
)

if ($IncluirRetreinamentos) {
  $Plano += @{ Tabela = 'dgt_usuariotreinamento'; Rotulo = 'Retreinamentos gerados por documentos'; SoOrigemRevisao = $true }
}

$Plano += @(
  @{ Tabela = 'dgt_documentorevisao'; Rotulo = 'Revisões dos documentos' },
  @{ Tabela = 'dgt_documento';        Rotulo = 'Documentos' },
  @{ Tabela = 'dgt_fluxo';            Rotulo = 'Fluxos dos processos (todas as versões)' }
)

if ($IncluirProcessos) {
  $Plano += @(
    @{ Tabela = 'dgt_processometadado'; Rotulo = 'Metadados dos processos' },
    @{ Tabela = 'dgt_processo';         Rotulo = 'Processos' }
  )
}

# ------------------------------------------------------------
# 1) Levantamento
# ------------------------------------------------------------

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
Write-Host ($(if ($Executar) { 'MODO: APAGAR' } else { 'MODO: SIMULAÇÃO (nada será apagado)' })) -ForegroundColor ($(if ($Executar) { 'Red' } else { 'Yellow' }))
Write-Host ''

$total = 0

foreach ($item in $Plano) {

  $tabela = Get-Tabela $item.Tabela

  if (-not $tabela) {
    Write-Host ("  {0,-45} tabela não existe — ignorada" -f $item.Rotulo) -ForegroundColor DarkGray
    $item.Registros = @()
    continue
  }

  $item.Info = $tabela
  $registros = Get-Registros $tabela $item.Filtro

  if ($item.SoOrigemRevisao) {
    $registros = @($registros | Where-Object {
      $_.'dgt_origem@OData.Community.Display.V1.FormattedValue' -match 'Revis'
    })
  }

  $item.Registros = $registros
  $total += $registros.Count

  Write-Host ("  {0,-45} {1,6} registro(s)" -f $item.Rotulo, $registros.Count)
}

Write-Host ''
Write-Host "Total: $total registro(s)." -ForegroundColor Cyan

if (-not $Executar) {
  Write-Host ''
  Write-Host 'Simulação concluída. Para apagar de verdade, rode de novo com -Executar.' -ForegroundColor Yellow
  return
}

if ($total -eq 0) {
  Write-Host 'Nada para apagar.' -ForegroundColor Green
  return
}

# ------------------------------------------------------------
# 2) Confirmação
# ------------------------------------------------------------

Write-Host ''
Write-Host 'ATENÇÃO: esta operação é IRREVERSÍVEL no Dataverse.' -ForegroundColor Red
$confirmacao = Read-Host 'Digite APAGAR para continuar'

if ($confirmacao -ne 'APAGAR') {
  Write-Host 'Cancelado. Nada foi apagado.' -ForegroundColor Yellow
  return
}

# ------------------------------------------------------------
# 3) Backup
# ------------------------------------------------------------

New-Item -ItemType Directory -Path $PastaBackup -Force | Out-Null

foreach ($item in $Plano) {
  if ($item.Registros -and $item.Registros.Count -gt 0) {
    $arquivo = Join-Path $PastaBackup "$($item.Tabela).json"
    $item.Registros | ConvertTo-Json -Depth 20 | Out-File -FilePath $arquivo -Encoding utf8
  }
}

Write-Host "Backup salvo em: $PastaBackup" -ForegroundColor Green

# ------------------------------------------------------------
# 4) Exclusão
# ------------------------------------------------------------

$apagados = 0
$falhas = @()

foreach ($item in $Plano) {

  if (-not $item.Registros -or $item.Registros.Count -eq 0) { continue }

  $info = $item.Info
  $i = 0

  foreach ($registro in $item.Registros) {

    $i++
    $id = $registro.($info.Chave)

    Write-Progress -Activity "Apagando: $($item.Rotulo)" -Status "$i de $($item.Registros.Count)" -PercentComplete (100 * $i / $item.Registros.Count)

    try {
      Invoke-Dv 'DELETE' "$Api/$($info.Conjunto)($id)" | Out-Null
      $apagados++
    }
    catch {
      $mensagem = $_.Exception.Message
      $falhas += "$($item.Tabela) $id — $mensagem"
    }
  }

  Write-Progress -Activity "Apagando: $($item.Rotulo)" -Completed
  Write-Host ("  ✓ {0,-45} {1,6} registro(s)" -f $item.Rotulo, $item.Registros.Count) -ForegroundColor Green
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
Write-Host 'Passo manual: apague os arquivos dos documentos na biblioteca do SharePoint (pastas das áreas).' -ForegroundColor Cyan
Write-Host 'Depois, no portal, pressione Ctrl+F5.' -ForegroundColor Cyan
