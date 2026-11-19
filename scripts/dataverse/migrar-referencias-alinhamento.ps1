<#
.SYNOPSIS
  Alinhamento das tabelas — fase 3: preenche os lookups novos a partir do
  texto que já está gravado (fabricante e área).

.DESCRIPTION
  Por padrão é só uma SIMULAÇÃO: lê os registros, mostra o que seria
  vinculado e grava um relatório CSV. Nada é alterado sem -Aplicar.

    dgt_declaracaofabricante.dgt_fabricante  → dgt_FabricanteCadastro
    dgt_certificacaofabricante.dgt_emissor   → dgt_FabricanteCadastro (só "Certificação de fabricante")
    dgt_certificacaofabricante.dgt_area      → dgt_AreaCadastro
    dgt_terceiro.dgt_area                    → dgt_AreaCadastro
    dgt_bom_ro.dgt_bom_fabricante            → dgt_bom_FabricanteCadastro

  Regras:
    - Correspondência pelo nome (e pela sigla, na área), sem maiúsculas,
      acentos e espaços repetidos — a mesma do portal.
    - Só preenche lookup VAZIO ou diferente do esperado. Nunca limpa um
      vínculo, nunca altera o texto e nunca muda registro inativo para ativo.
    - -CadastrarFabricantesFaltantes cria em dgt_fabricante os nomes que
      não têm cadastro. Nomes parecidos com um fabricante já cadastrado
      (ex.: "Dahua" × "DASHUA") NÃO são criados: corrija o cadastro antes.
    - Nomes provisórios (um só caractere repetido, como "xxxxxx" ou "----")
      e os nomes de -IgnorarFabricantes nunca são cadastrados nem vinculados.

  Pré-requisito: scripts/dataverse/criar-colunas-alinhamento.ps1
  Plano: docs/alinhamento-tabelas.md

.PARAMETER UrlAmbiente
  URL do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Aplicar
  Grava de verdade. Sem ele, só simula.

.PARAMETER CadastrarFabricantesFaltantes
  Cria em dgt_fabricante os fabricantes que aparecem no texto e não têm cadastro.

.PARAMETER IgnorarFabricantes
  Nomes de fabricante que não devem ser cadastrados nem vinculados (ex.: textos de teste).

.PARAMETER OutputFolder
  Pasta do relatório. Padrão: pasta atual.

.EXAMPLE
  .\migrar-referencias-alinhamento.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com

.EXAMPLE
  .\migrar-referencias-alinhamento.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -CadastrarFabricantesFaltantes -Aplicar
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [switch] $Aplicar,
  [switch] $CadastrarFabricantesFaltantes,
  [string[]] $IgnorarFabricantes = @(),
  [string] $OutputFolder = (Get-Location).Path,
  [switch] $LoginPorCodigo
)

$ErrorActionPreference = 'Stop'

$UrlAmbiente = $UrlAmbiente.Trim().Trim('"', "'").Trim().TrimEnd('/')
if ($UrlAmbiente -notmatch '^https://[a-z0-9-]+\.crm\d*\.dynamics\.com$') {
  throw "URL do ambiente inválida: '$UrlAmbiente'. Use o formato https://suaorg.crm2.dynamics.com"
}
$Api = "$UrlAmbiente/api/data/v9.2"

# ------------------------------------------------------------
# Autenticação (interativa; o token nunca é exibido)
# ------------------------------------------------------------

if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
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
  'Authorization'    = "Bearer $(Get-Token)"
  'Accept'           = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version'    = '4.0'
  'Prefer'           = 'odata.maxpagesize=5000'
}

function Invoke-Dv {
  param([string] $Metodo, [string] $Url, $Corpo, [hashtable] $Extra = @{})
  $h = $Cabecalhos.Clone()
  foreach ($k in $Extra.Keys) { $h[$k] = $Extra[$k] }
  $p = @{ Method = $Metodo; Uri = $Url; Headers = $h; ContentType = 'application/json; charset=utf-8' }
  if ($null -ne $Corpo) { $p.Body = [System.Text.Encoding]::UTF8.GetBytes(($Corpo | ConvertTo-Json -Depth 10)) }
  try { Invoke-RestMethod @p }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    throw "Dataverse (HTTP $status): $($_.ErrorDetails.Message)"
  }
}

function Get-Todos([string] $url) {
  $lista = New-Object System.Collections.Generic.List[object]
  while ($url) {
    $r = Invoke-Dv -Metodo 'GET' -Url $url
    foreach ($v in @($r.value)) { $lista.Add($v) }
    $url = $r.'@odata.nextLink'
  }
  return ,$lista.ToArray()
}

$conjuntos = @{}
function Get-Conjunto([string] $tabela) {
  if (-not $conjuntos.ContainsKey($tabela)) {
    $m = Invoke-Dv -Metodo 'GET' -Url "$Api/EntityDefinitions(LogicalName='$tabela')?`$select=EntitySetName"
    $conjuntos[$tabela] = $m.EntitySetName
  }
  return $conjuntos[$tabela]
}

function Test-Coluna([string] $tabela, [string] $coluna) {
  try { Invoke-Dv -Metodo 'GET' -Url "$Api/EntityDefinitions(LogicalName='$tabela')/Attributes(LogicalName='$coluna')?`$select=LogicalName" | Out-Null; return $true }
  catch { return $false }
}

function Normalizar([string] $texto) {
  if ([string]::IsNullOrWhiteSpace($texto)) { return '' }
  $d = $texto.Trim().ToUpperInvariant().Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $d.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
  }
  return ($sb.ToString() -replace '\s+', ' ')
}

# Distância de edição (para avisar grafias parecidas, ex.: DASHUA × DAHUA)
function Get-Distancia([string] $a, [string] $b) {
  $m = $a.Length; $n = $b.Length
  $d = New-Object 'int[,]' ($m + 1), ($n + 1)
  for ($i = 0; $i -le $m; $i++) { $d[$i, 0] = $i }
  for ($j = 0; $j -le $n; $j++) { $d[0, $j] = $j }
  for ($i = 1; $i -le $m; $i++) {
    for ($j = 1; $j -le $n; $j++) {
      $custo = if ($a[$i - 1] -eq $b[$j - 1]) { 0 } else { 1 }
      $d[$i, $j] = [Math]::Min([Math]::Min($d[($i - 1), $j] + 1, $d[$i, ($j - 1)] + 1), $d[($i - 1), ($j - 1)] + $custo)
    }
  }
  return $d[$m, $n]
}

# Nome provisório: um só caractere repetido ("xxxxxx", "----", "000") ou
# listado em -IgnorarFabricantes.
$ignorados = @{}
foreach ($n in $IgnorarFabricantes) { $k = Normalizar $n; if ($k) { $ignorados[$k] = $true } }
function Test-Ignorado([string] $chave) {
  if (-not $chave) { return $false }
  if ($ignorados.ContainsKey($chave)) { return $true }
  $semEspaco = $chave -replace '\s', ''
  return ($semEspaco.Length -ge 2 -and ($semEspaco.ToCharArray() | Sort-Object -Unique).Count -eq 1)
}

$modo = if ($Aplicar) { 'APLICAR (grava no Dataverse)' } else { 'SIMULAÇÃO (nada é gravado)' }
Write-Host "Ambiente: $UrlAmbiente  |  Modo: $modo" -ForegroundColor Cyan

# ------------------------------------------------------------
# Cadastros
# ------------------------------------------------------------

function Get-Fabricantes {
  $regs = Get-Todos "$Api/$(Get-Conjunto 'dgt_fabricante')?`$select=dgt_fabricanteid,dgt_name&`$filter=dgt_ativo eq true"
  $mapa = @{}
  foreach ($r in $regs) { $k = Normalizar $r.dgt_name; if ($k -and -not $mapa.ContainsKey($k)) { $mapa[$k] = @{ Id = $r.dgt_fabricanteid; Nome = $r.dgt_name } } }
  return $mapa
}

$fabricantes = Get-Fabricantes
$areasRegs = Get-Todos "$Api/$(Get-Conjunto 'dgt_area')?`$select=dgt_areaid,dgt_name,dgt_sigla&`$filter=dgt_ativo eq true"
$areas = @{}
foreach ($a in $areasRegs) {
  foreach ($v in @($a.dgt_name, $a.dgt_sigla)) { $k = Normalizar $v; if ($k -and -not $areas.ContainsKey($k)) { $areas[$k] = @{ Id = $a.dgt_areaid; Nome = $a.dgt_name } } }
}
Write-Host "Cadastros: $($fabricantes.Count) fabricante(s), $($areasRegs.Count) área(s)."

# ------------------------------------------------------------
# Alvos
# ------------------------------------------------------------

$alvos = @(
  @{ Tabela = 'dgt_declaracaofabricante';   Id = 'dgt_declaracaofabricanteid';   Texto = 'dgt_fabricante';     Lookup = 'dgt_fabricantecadastro';     Navegacao = 'dgt_FabricanteCadastro';     Cadastro = 'dgt_fabricante'; Filtro = $null },
  @{ Tabela = 'dgt_certificacaofabricante'; Id = 'dgt_certificacaofabricanteid'; Texto = 'dgt_emissor';        Lookup = 'dgt_fabricantecadastro';     Navegacao = 'dgt_FabricanteCadastro';     Cadastro = 'dgt_fabricante'; Filtro = 'fabricante' },
  @{ Tabela = 'dgt_bom_ro';                 Id = 'dgt_bom_roid';                 Texto = 'dgt_bom_fabricante'; Lookup = 'dgt_bom_fabricantecadastro'; Navegacao = 'dgt_bom_FabricanteCadastro'; Cadastro = 'dgt_fabricante'; Filtro = $null },
  @{ Tabela = 'dgt_certificacaofabricante'; Id = 'dgt_certificacaofabricanteid'; Texto = 'dgt_area';           Lookup = 'dgt_areacadastro';           Navegacao = 'dgt_AreaCadastro';           Cadastro = 'dgt_area';       Filtro = $null },
  @{ Tabela = 'dgt_terceiro';               Id = 'dgt_terceiroid';               Texto = 'dgt_area';           Lookup = 'dgt_areacadastro';           Navegacao = 'dgt_AreaCadastro';           Cadastro = 'dgt_area';       Filtro = $null }
)

foreach ($alvo in $alvos) {
  if (-not (Test-Coluna $alvo.Tabela $alvo.Lookup)) {
    throw "A coluna $($alvo.Tabela).$($alvo.Lookup) não existe. Rode antes scripts/dataverse/criar-colunas-alinhamento.ps1. Nada foi alterado."
  }
}

# ------------------------------------------------------------
# Fabricantes faltantes
# ------------------------------------------------------------

$faltantes = @{}   # chave normalizada → nome mais usado
# Diferencia maiúsculas: "Intelbras" e "intelbras" são grafias contadas à parte.
$contagem = New-Object 'System.Collections.Generic.Dictionary[string,int]' ([StringComparer]::Ordinal)
foreach ($alvo in ($alvos | Where-Object { $_.Cadastro -eq 'dgt_fabricante' })) {
  $sel = "$($alvo.Texto)" + $(if ($alvo.Filtro) { ',dgt_categoria' } else { '' })
  foreach ($r in (Get-Todos "$Api/$(Get-Conjunto $alvo.Tabela)?`$select=$sel")) {
    if ($alvo.Filtro -eq 'fabricante' -and $r.dgt_categoria -and $r.dgt_categoria -ne 'Certificação de fabricante') { continue }
    $nome = [string]$r.($alvo.Texto); $k = Normalizar $nome
    if (-not $k -or $fabricantes.ContainsKey($k) -or (Test-Ignorado $k)) { continue }
    $chaveNome = "$k|$($nome.Trim())"
    if ($contagem.ContainsKey($chaveNome)) { $contagem[$chaveNome]++ } else { $contagem[$chaveNome] = 1 }
  }
}
foreach ($cn in @($contagem.Keys)) {
  $k = $cn.Split('|')[0]; $nome = $cn.Substring($k.Length + 1)
  if (-not $faltantes.ContainsKey($k) -or $contagem["$k|$($faltantes[$k])"] -lt $contagem[$cn]) { $faltantes[$k] = $nome }
}

$relatorio = New-Object System.Collections.Generic.List[object]
function Add-Rel($tabela, $registro, $texto, $resultado, $detalhe) {
  $relatorio.Add([PSCustomObject]@{ Tabela = $tabela; Registro = $registro; Texto = $texto; Resultado = $resultado; Detalhe = $detalhe })
}

if ($faltantes.Count) {
  Write-Host "`nFabricantes sem cadastro: $(($faltantes.Values | Sort-Object) -join ', ')" -ForegroundColor Yellow
  foreach ($k in @($faltantes.Keys)) {
    $parecidos = @($fabricantes.Keys | Where-Object { (Get-Distancia $k $_) -le 2 })
    if ($parecidos.Count) {
      $nomes = ($parecidos | ForEach-Object { $fabricantes[$_].Nome }) -join ', '
      Write-Host "  ! '$($faltantes[$k])' parece '$nomes' (já cadastrado). Corrija o cadastro; este nome não será criado." -ForegroundColor Yellow
      Add-Rel 'dgt_fabricante' '' $faltantes[$k] 'NÃO CRIADO - grafia parecida' "Já cadastrado: $nomes"
      $faltantes.Remove($k)
    }
  }
  if ($CadastrarFabricantesFaltantes) {
    foreach ($k in @($faltantes.Keys)) {
      $nome = $faltantes[$k]
      if ($Aplicar) {
        $criado = Invoke-Dv -Metodo 'POST' -Url "$Api/$(Get-Conjunto 'dgt_fabricante')?`$select=dgt_fabricanteid" -Corpo @{ dgt_name = $nome; dgt_ativo = $true } -Extra @{ 'Prefer' = 'return=representation' }
        $fabricantes[$k] = @{ Id = $criado.dgt_fabricanteid; Nome = $nome }
        Write-Host "  + fabricante cadastrado: $nome" -ForegroundColor Green
        Add-Rel 'dgt_fabricante' $criado.dgt_fabricanteid $nome 'CRIADO' ''
      }
      else {
        $fabricantes[$k] = @{ Id = '(novo)'; Nome = $nome }
        Write-Host "  + seria cadastrado: $nome" -ForegroundColor Green
        Add-Rel 'dgt_fabricante' '' $nome 'SERIA CRIADO' ''
      }
    }
  }
  else {
    Write-Host '  Use -CadastrarFabricantesFaltantes para cadastrá-los (ou cadastre em RH e Pessoas > Fabricantes).' -ForegroundColor Yellow
  }
}

# ------------------------------------------------------------
# Vínculos
# ------------------------------------------------------------

$totais = @{ Vinculado = 0; JaCorreto = 0; SemCorrespondente = 0; Vazio = 0; Ignorado = 0; Provisorio = 0; Erro = 0 }

foreach ($alvo in $alvos) {
  Write-Host "`n$($alvo.Tabela).$($alvo.Texto) → $($alvo.Navegacao)" -ForegroundColor Cyan
  $conjunto = Get-Conjunto $alvo.Tabela
  $conjuntoCadastro = Get-Conjunto $alvo.Cadastro
  $sel = "$($alvo.Id),$($alvo.Texto),_$($alvo.Lookup)_value" + $(if ($alvo.Filtro) { ',dgt_categoria' } else { '' })
  $mapa = if ($alvo.Cadastro -eq 'dgt_area') { $areas } else { $fabricantes }

  foreach ($r in (Get-Todos "$Api/$($conjunto)?`$select=$sel")) {
    $id = $r.($alvo.Id); $texto = [string]$r.($alvo.Texto)
    if ($alvo.Filtro -eq 'fabricante' -and $r.dgt_categoria -and $r.dgt_categoria -ne 'Certificação de fabricante') {
      $totais.Ignorado++; continue   # registro profissional: emissor é órgão, não fabricante
    }
    $k = Normalizar $texto
    if (-not $k) { $totais.Vazio++; continue }
    if ($alvo.Cadastro -eq 'dgt_fabricante' -and (Test-Ignorado $k)) {
      $totais.Provisorio++
      Add-Rel $alvo.Tabela $id $texto 'IGNORADO - nome provisório' 'Não cadastrado nem vinculado'
      continue
    }
    if (-not $mapa.ContainsKey($k)) {
      $totais.SemCorrespondente++
      Add-Rel $alvo.Tabela $id $texto 'SEM CORRESPONDENTE' "Não existe em $($alvo.Cadastro)"
      continue
    }
    $destino = $mapa[$k]
    $atual = [string]$r."_$($alvo.Lookup)_value"
    if ($atual -and $atual -eq [string]$destino.Id) { $totais.JaCorreto++; continue }

    if ($Aplicar -and $destino.Id -ne '(novo)') {
      try {
        Invoke-Dv -Metodo 'PATCH' -Url "$Api/$conjunto($id)" -Corpo @{ "$($alvo.Navegacao)@odata.bind" = "/$conjuntoCadastro($($destino.Id))" } -Extra @{ 'If-Match' = '*' } | Out-Null
        $totais.Vinculado++
        Add-Rel $alvo.Tabela $id $texto 'VINCULADO' $destino.Nome
      }
      catch {
        $totais.Erro++
        Add-Rel $alvo.Tabela $id $texto 'ERRO' $_.Exception.Message
      }
    }
    else {
      $totais.Vinculado++
      Add-Rel $alvo.Tabela $id $texto 'SERIA VINCULADO' $destino.Nome
    }
  }
}

# ------------------------------------------------------------
# Relatório
# ------------------------------------------------------------

if (-not (Test-Path -LiteralPath $OutputFolder)) { New-Item -ItemType Directory -Path $OutputFolder | Out-Null }
$sufixo = if ($Aplicar) { 'Aplicado' } else { 'Simulacao' }
$arquivo = Join-Path $OutputFolder ("Alinhamento_Migracao_{0}_{1}.csv" -f $sufixo, (Get-Date -Format 'yyyyMMdd-HHmm'))
$relatorio | Export-Csv -Path $arquivo -Delimiter ';' -NoTypeInformation -Encoding UTF8

$verbo = if ($Aplicar) { 'vinculados' } else { 'a vincular' }
Write-Host "`nResumo: $($totais.Vinculado) $verbo · $($totais.JaCorreto) já corretos · $($totais.SemCorrespondente) sem correspondente · $($totais.Vazio) sem texto · $($totais.Ignorado) registros profissionais ignorados · $($totais.Provisorio) com nome provisório · $($totais.Erro) erros" -ForegroundColor Green
Write-Host "Relatório: $arquivo" -ForegroundColor Green
if (-not $Aplicar) { Write-Host 'Nada foi gravado. Confira o relatório e rode de novo com -Aplicar.' -ForegroundColor Yellow }
