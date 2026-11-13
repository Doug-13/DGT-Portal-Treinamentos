<#
.SYNOPSIS
  DIAGNÓSTICO da IA do portal (só LEITURA: não altera nada).

  Para cada Custom API de IA mostra se existe, se o tipo de plugin
  está no assembly e como está o passo registrado (estágio, modo e
  situação), e diz o que corrigir.

.EXAMPLE
  .\scripts\dataverse\diagnosticar-ia.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
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

# Mensagem real devolvida pelo Dataverse (em vez de só "erro 400").
function Get-ErroDv {
  param($Registro)
  $texto = $null
  if ($Registro.ErrorDetails -and $Registro.ErrorDetails.Message) {
    $texto = $Registro.ErrorDetails.Message
    try {
      $json = $texto | ConvertFrom-Json
      if ($json.error.message) { $texto = $json.error.message }
    }
    catch { }
  }
  if (-not $texto) { $texto = $Registro.Exception.Message }
  return $texto
}


$apis = @(
  @{ Api = 'dgt_PerguntarDashboardIa'; Tipo = 'DGT.Treinamentos.Plugins.PerguntarDashboardIaPlugin'; Chave = $true },
  @{ Api = 'dgt_GerenciarIa';          Tipo = 'DGT.Treinamentos.Plugins.GerenciarIaPlugin';          Chave = $false },
  @{ Api = 'dgt_AnalisarLicitacaoIa';  Tipo = 'DGT.Treinamentos.Plugins.AnalisarLicitacaoIaPlugin';  Chave = $true }
)

$NOMES_ESTAGIO = @{ 10 = 'PreValidation'; 20 = 'PreOperation'; 30 = 'Operação principal'; 40 = 'PostOperation' }
$problemas = 0

foreach ($item in $apis) {

  Write-Host "`n=== $($item.Api) ===" -ForegroundColor Cyan

  # Custom API
  $consultaApi = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid,executeprivilegename,_plugintypeid_value&`$filter=uniquename eq '$($item.Api)'"
  if ($consultaApi.value.Count -eq 0) {
    Write-Host '  ✗ Custom API não existe. Rode o script de criação correspondente.' -ForegroundColor Red
    $problemas++
    continue
  }
  Write-Host "  ✓ Custom API existe (privilégio: $($consultaApi.value[0].executeprivilegename))"

  # Tipo de plugin no assembly
  $consultaTipo = Invoke-Dv -Metodo 'GET' -Caminho "plugintypes?`$select=plugintypeid,typename&`$filter=typename eq '$($item.Tipo)'"
  if ($consultaTipo.value.Count -eq 0) {
    Write-Host "  ✗ O tipo $($item.Tipo) NÃO está no Dataverse." -ForegroundColor Red
    Write-Host '    → Compile o projeto server\DGT.Treinamentos.Plugins e dê Update no assembly (Plugin Registration Tool).' -ForegroundColor Yellow
    $problemas++
  }
  else {
    Write-Host "  ✓ Tipo de plugin presente: $($item.Tipo)"
  }

  # Passos na mensagem da API
  $mensagem = Invoke-Dv -Metodo 'GET' -Caminho "sdkmessages?`$select=sdkmessageid&`$filter=name eq '$($item.Api)'"
  if ($mensagem.value.Count -eq 0) {
    Write-Host '  ✗ Mensagem da API não encontrada (a Custom API pode ter sido criada há pouco: aguarde alguns minutos).' -ForegroundColor Red
    $problemas++
    continue
  }
  $idMensagem = $mensagem.value[0].sdkmessageid

  $passos = Invoke-Dv -Metodo 'GET' -Caminho ("sdkmessageprocessingsteps?`$select=name,stage,mode,statecode,_eventhandler_value" +
    "&`$filter=_sdkmessageid_value eq $idMensagem")

  if ($passos.value.Count -eq 0) {
    Write-Host '  ✗ NENHUM passo registrado: a API responde vazio ("A IA não retornou resposta").' -ForegroundColor Red
    Write-Host "    → Plugin Registration Tool: botão direito em $($item.Tipo.Split('.')[-1]) › Register New Step:" -ForegroundColor Yellow
    Write-Host "      Message $($item.Api) · Primary Entity (vazio) · Stage PostOperation · Execution Mode Synchronous" -ForegroundColor Yellow
    if ($item.Chave) { Write-Host '      Secure Configuration: a chave (ou vazio, se a chave já foi salva em Administrar IA).' -ForegroundColor Yellow }
    $problemas++
    continue
  }

  foreach ($passo in $passos.value) {
    $nomeEstagio = $NOMES_ESTAGIO[[int]$passo.stage]
    $modo = if ([int]$passo.mode -eq 0) { 'Synchronous' } else { 'Asynchronous' }
    $ativo = [int]$passo.statecode -eq 0
    $tipoDoPasso = $null
    if ($passo._eventhandler_value) {
      $tipoLido = Invoke-Dv -Metodo 'GET' -Caminho "plugintypes($($passo._eventhandler_value))?`$select=typename"
      $tipoDoPasso = $tipoLido.typename
    }

    Write-Host "  · Passo: $($passo.name)"
    Write-Host "      Plugin: $tipoDoPasso · Estágio: $nomeEstagio · Modo: $modo · $(if ($ativo) { 'Ativado' } else { 'DESATIVADO' })"

    if ($tipoDoPasso -ne $item.Tipo) {
      Write-Host "      ✗ Passo ligado ao plugin errado (esperado $($item.Tipo))." -ForegroundColor Red; $problemas++
    }
    if ([int]$passo.stage -ne 40) {
      Write-Host '      ✗ O estágio deve ser PostOperation.' -ForegroundColor Red; $problemas++
    }
    if ([int]$passo.mode -ne 0) {
      Write-Host '      ✗ O modo deve ser Synchronous (assíncrono não devolve a resposta para a tela).' -ForegroundColor Red; $problemas++
    }
    if (-not $ativo) {
      Write-Host '      ✗ Passo desativado: no Plugin Registration Tool, botão direito › Enable.' -ForegroundColor Red; $problemas++
    }
  }
}

# Chave salva no portal (só o final; a chave nunca é lida)
Write-Host "`n=== Chave da IA ===" -ForegroundColor Cyan
try {
  $conjunto = (Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_iaconfiguracao')?`$select=EntitySetName").EntitySetName
  $config = Invoke-Dv -Metodo 'GET' -Caminho "$($conjunto)?`$select=dgt_chavefinal,dgt_chaveatualizadaem&`$filter=dgt_name eq 'Claude'"
  if ($config.value.Count -gt 0 -and $config.value[0].dgt_chavefinal) {
    Write-Host "  ✓ Chave salva no portal: $($config.value[0].dgt_chavefinal) (atualizada em $($config.value[0].dgt_chaveatualizadaem))"
  }
  else {
    Write-Host '  ! Nenhuma chave salva no portal: os plugins usam a Configuração segura de cada passo.' -ForegroundColor Yellow
    Write-Host '    → Salve a chave em: menu do usuário › Administrar IA › Chave.' -ForegroundColor Yellow
  }
}
catch {
  Write-Host '  ! Tabela de configuração da IA não encontrada (rode criar-ia-administracao.ps1).' -ForegroundColor Yellow
}

if ($problemas -eq 0) {
  Write-Host "`nNenhum problema de registro encontrado." -ForegroundColor Green
  Write-Host 'Se a IA ainda falhar, veja o Rastreamento de plugins (Configurações › Personalização › Log de Rastreamento de Plug-in).'
}
else {
  Write-Host "`n$problemas problema(s) encontrado(s). Corrija os itens em vermelho e teste de novo." -ForegroundColor Red
}
