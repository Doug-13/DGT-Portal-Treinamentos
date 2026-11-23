<#
.SYNOPSIS
    Diagnóstico (somente leitura) para o alinhamento das tabelas do Dataverse.

.DESCRIPTION
    Fase 0 do plano em docs/alinhamento-tabelas.md. NÃO altera nada no Dataverse:
    só faz consultas (GET) e grava um relatório CSV local.

    Verificações:
      1. Tabelas candidatas à remoção: linhas, dependências e fluxos do Power Automate que as citam.
      2. Tabelas do PMO (dgt_projeto*): quantidade, última alteração e contas que gravam.
      3. Certificados externos: tipos cadastrados (para separar das certificações de fabricante).
      4. Pessoa externa: nomes coincidentes entre dgt_terceiro e dgt_fornecedorcolaborador
         (só a contagem; o CPF nunca é lido).
      5. Referências em texto: valores de área e de fabricante que já existem (ou não) nos cadastros.
      6. Consistência de dgt_documentoprocesso com o fluxo definido pelo processo de negócio.
      7. Catálogo de servidores em dgt_kititem (substituto das tabelas dgt_servidor*).
      8. Fabricantes cadastrados em dgt_fabricante.
      9. Dashboards que usam a fonte projetos.atividades e dados vivos do painel em dgt_implregistro.

    A autenticação é interativa (Connect-AzAccount): nenhuma credencial fica no script,
    e o token de acesso nunca é exibido nem gravado.

    LGPD: o relatório pode conter nomes de contas que gravaram registros (verificação 2) e,
    só com -ExportarNomesCoincidentes, nomes de pessoas (verificação 4). Trate o arquivo como
    dado pessoal e apague-o após o uso.

.PARAMETER EnvironmentUrl
    URL do ambiente. Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER OutputFolder
    Pasta do relatório. Padrão: pasta atual.

.PARAMETER ExportarNomesCoincidentes
    Grava em um CSV separado os nomes coincidentes da verificação 4.

.PARAMETER Tenant
    Tenant do Microsoft 365 (ID ou domínio), se a conta tiver acesso a mais de um.

.PARAMETER LoginPorCodigo
    Faz o login por código (Connect-AzAccount -UseDeviceAuthentication).

.EXAMPLE
    .\diagnosticar-alinhamento-tabelas.ps1 -EnvironmentUrl https://suaorg.crm2.dynamics.com

.EXAMPLE
    .\diagnosticar-alinhamento-tabelas.ps1 -EnvironmentUrl https://suaorg.crm2.dynamics.com -LoginPorCodigo
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentUrl,

    [string]$OutputFolder = (Get-Location).Path,

    [switch]$ExportarNomesCoincidentes,

    # Tenant do Microsoft 365 (ID ou domínio). Use se você tiver acesso a mais de um tenant.
    [string]$Tenant,

    # Login por código no navegador (útil quando a janela de login não abre).
    [switch]$LoginPorCodigo
)

$ErrorActionPreference = "Stop"

# Aceita a URL digitada com ou sem aspas (no prompt do PowerShell as aspas
# fazem parte do texto) e com ou sem a barra final.
$EnvironmentUrl = $EnvironmentUrl.Trim().Trim('"', "'").Trim().TrimEnd("/")
if ($EnvironmentUrl -notmatch '^https://[a-z0-9-]+\.crm\d*\.dynamics\.com$') {
    throw "URL do ambiente inválida: '$EnvironmentUrl'. Use o formato https://suaorg.crm2.dynamics.com (sem /api/data)."
}
$apiBase = "$EnvironmentUrl/api/data/v9.2"

# ---------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    Write-Host "Instalando o módulo Az.Accounts (somente para o usuário atual)..." -ForegroundColor Yellow
    Install-Module Az.Accounts -Scope CurrentUser -Force -AllowClobber
}
Import-Module Az.Accounts

function Connect-Portal {
    Write-Host "Abrindo login da Microsoft..." -ForegroundColor Cyan
    if ($Tenant) { Connect-AzAccount -Tenant $Tenant -UseDeviceAuthentication:$LoginPorCodigo | Out-Null }
    else { Connect-AzAccount -UseDeviceAuthentication:$LoginPorCodigo | Out-Null }
}

if (-not (Get-AzContext)) { Connect-Portal }

function Get-DataverseToken {
    try {
        $tokenObj = Get-AzAccessToken -ResourceUrl $EnvironmentUrl -ErrorAction Stop
    }
    catch {
        # Sessão do Az expirada ou cache de token inválido: limpa e faz login de novo.
        Write-Host "A sessão salva do Az não serviu ($($_.Exception.Message.Split([Environment]::NewLine)[0])). Refazendo o login..." -ForegroundColor Yellow
        Disconnect-AzAccount -ErrorAction SilentlyContinue | Out-Null
        Clear-AzContext -Force -ErrorAction SilentlyContinue | Out-Null
        Connect-Portal
        $tokenObj = Get-AzAccessToken -ResourceUrl $EnvironmentUrl -ErrorAction Stop
    }
    if ($tokenObj.Token -is [System.Security.SecureString]) {
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenObj.Token)
        try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    return $tokenObj.Token
}

$headers = @{
    "Authorization"    = "Bearer $(Get-DataverseToken)"
    "Accept"           = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
    "Prefer"           = 'odata.include-annotations="*",odata.maxpagesize=5000'
}

# GET com paginação. Em erro, mostra só o status e a mensagem do serviço (sem cabeçalhos).
function Invoke-Dataverse([string]$url) {
    $resultado = @()
    while ($url) {
        try {
            $resp = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
        }
        catch {
            $status = $_.Exception.Response.StatusCode.value__
            throw "Falha na consulta ao Dataverse (HTTP $status): $($_.ErrorDetails.Message)"
        }
        if ($null -ne $resp.value) { $resultado += $resp.value } else { $resultado += $resp }
        $url = $resp.'@odata.nextLink'
    }
    # A vírgula impede o PowerShell de transformar a lista vazia em $null.
    return ,$resultado
}

$relatorio = New-Object System.Collections.Generic.List[object]
function Add-Linha([string]$verificacao, [string]$item, [string]$resultado, [string]$detalhe) {
    $relatorio.Add([PSCustomObject]@{
        Verificacao = $verificacao
        Item        = $item
        Resultado   = $resultado
        Detalhe     = $detalhe
    })
    $cor = if ($resultado -like "ATEN*") { "Yellow" } elseif ($resultado -like "OK*") { "Green" } else { "Gray" }
    Write-Host ("  [{0}] {1}: {2} {3}" -f $verificacao, $item, $resultado, $detalhe) -ForegroundColor $cor
}

$cacheMeta = @{}
function Get-Meta([string]$logicalName) {
    if (-not $cacheMeta.ContainsKey($logicalName)) {
        try {
            $m = Invoke-Dataverse "$apiBase/EntityDefinitions(LogicalName='$logicalName')?`$select=EntitySetName,MetadataId,PrimaryIdAttribute"
            $cacheMeta[$logicalName] = $m | Select-Object -First 1
        }
        catch { $cacheMeta[$logicalName] = $null }
    }
    return $cacheMeta[$logicalName]
}

function Get-Registros([string]$logicalName, [string]$query) {
    # $null = a tabela não existe; lista vazia = a tabela existe e não tem linhas no filtro.
    $meta = Get-Meta $logicalName
    if ($null -eq $meta) { return $null }
    $lista = Invoke-Dataverse "$apiBase/$($meta.EntitySetName)?$query"
    return ,$lista
}

function Get-Fmt($registro, [string]$campo) {
    $v = $registro."$campo@OData.Community.Display.V1.FormattedValue"
    if ($v) { return [string]$v }
    return [string]$registro.$campo
}

function Normalizar([string]$texto) {
    if ([string]::IsNullOrWhiteSpace($texto)) { return "" }
    $d = $texto.Trim().ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($ch)
        }
    }
    return ($sb.ToString() -replace '\s+', ' ')
}

# Fluxos do Power Automate (nuvem) visíveis para quem executa o script.
Write-Host "Carregando fluxos do Power Automate visíveis para o seu usuário..." -ForegroundColor Cyan
$fluxos = @()
try {
    $fluxos = Invoke-Dataverse "$apiBase/workflows?`$select=name,clientdata,statecode&`$filter=category eq 5"
}
catch {
    Write-Host "  Não foi possível ler os fluxos: $($_.Exception.Message)" -ForegroundColor Yellow
}

function Get-FluxosQueCitam([string]$logicalName) {
    $meta = Get-Meta $logicalName
    $termos = @($logicalName)
    if ($meta) { $termos += $meta.EntitySetName }
    $nomes = @()
    foreach ($f in $fluxos) {
        if (-not $f.clientdata) { continue }
        foreach ($t in $termos) {
            if ($f.clientdata -match "(?i)\b$([regex]::Escape($t))\b") { $nomes += $f.name; break }
        }
    }
    return ($nomes | Sort-Object -Unique)
}

function Get-Dependencias([string]$logicalName) {
    $meta = Get-Meta $logicalName
    if ($null -eq $meta) { return "tabela não encontrada" }
    try {
        $deps = Invoke-Dataverse "$apiBase/RetrieveDependenciesForDelete(ObjectId=@p1,ComponentType=@p2)?@p1=$($meta.MetadataId)&@p2=1"
        $deps = @($deps | Where-Object { $_.dependentcomponenttype -ne $null })
        if ($deps.Count -eq 0) { return "nenhuma" }
        $porTipo = $deps | Group-Object { Get-Fmt $_ 'dependentcomponenttype' } | ForEach-Object { "$($_.Name) x$($_.Count)" }
        return ($porTipo -join "; ")
    }
    catch { return "não foi possível consultar ($($_.Exception.Message))" }
}

function Resumo-Tabela([string]$verificacao, [string]$logicalName, [switch]$ComDependencias) {
    $meta = Get-Meta $logicalName
    if ($null -eq $meta) { Add-Linha $verificacao $logicalName "NÃO EXISTE" ""; return }
    $regs = Get-Registros $logicalName "`$select=$($meta.PrimaryIdAttribute),modifiedon&`$orderby=modifiedon desc"
    if ($null -eq $regs) { $regs = @() }
    $ultima = if ($regs.Count -gt 0) { $regs[0].modifiedon } else { "-" }
    $fl = @(Get-FluxosQueCitam $logicalName)
    $det = "linhas=$($regs.Count); última alteração=$ultima; fluxos=" + $(if ($fl.Count) { $fl -join " | " } else { "nenhum" })
    if ($ComDependencias) { $det += "; dependências=" + (Get-Dependencias $logicalName) }
    $res = if ($regs.Count -eq 0 -and $fl.Count -eq 0) { "OK - vazia e sem fluxos" } else { "ATENÇÃO - em uso" }
    Add-Linha $verificacao $logicalName $res $det
}

# ---------------------------------------------------------------
# 1. Candidatas à remoção ou sem uso no portal
# ---------------------------------------------------------------
Write-Host "`n1) Tabelas candidatas à remoção / sem uso no portal" -ForegroundColor Cyan
foreach ($t in @('dgt_servidorcatalogo', 'dgt_servidoralerta')) { Resumo-Tabela "1-Remocao" $t -ComDependencias }
foreach ($t in @('dgt_setor', 'dgt_documentosetor', 'dgt_grupotrilha', 'dgt_funcaotrilha')) { Resumo-Tabela "1-SemUso" $t }

# ---------------------------------------------------------------
# 2. PMO
# ---------------------------------------------------------------
Write-Host "`n2) Tabelas do PMO" -ForegroundColor Cyan
foreach ($t in @('dgt_projeto', 'dgt_projetoatividade', 'dgt_projetomedicao', 'dgt_projetoprogresso')) {
    Resumo-Tabela "2-PMO" $t
    $meta = Get-Meta $t
    if ($meta) {
        $regs = Get-Registros $t "`$select=_createdby_value,_modifiedby_value&`$orderby=modifiedon desc&`$top=200"
        if ($null -eq $regs) { $regs = @() }
        $contas = @($regs | ForEach-Object { Get-Fmt $_ '_modifiedby_value'; Get-Fmt $_ '_createdby_value' } | Where-Object { $_ } | Sort-Object -Unique)
        if ($contas.Count) { Add-Linha "2-PMO" $t "INFO - contas que gravam" ($contas -join " | ") }
    }
}

# ---------------------------------------------------------------
# 3. Certificados externos por tipo
# ---------------------------------------------------------------
Write-Host "`n3) Certificados externos por tipo" -ForegroundColor Cyan
$cert = Get-Registros 'dgt_certificadoexterno' "`$select=dgt_tipo&`$filter=dgt_ativo eq true"
if ($null -eq $cert) { Add-Linha "3-Certificados" "dgt_certificadoexterno" "NÃO EXISTE" "" }
elseif ($cert.Count -eq 0) { Add-Linha "3-Certificados" "dgt_certificadoexterno" "OK - nenhum registro ativo" "" }
else {
    foreach ($g in (@($cert) | Group-Object { if ($_.dgt_tipo) { $_.dgt_tipo } else { "(vazio)" } } | Sort-Object Count -Descending)) {
        $res = if ((Normalizar $g.Name) -match 'fabricante|crea|cft|registro profissional|certifica') { "ATENÇÃO - possível sobreposição" } else { "OK" }
        Add-Linha "3-Certificados" $g.Name $res "registros ativos=$($g.Count)"
    }
}

# ---------------------------------------------------------------
# 4. Pessoa externa (somente nomes; CPF nunca é lido)
# ---------------------------------------------------------------
Write-Host "`n4) Pessoa externa: dgt_terceiro x dgt_fornecedorcolaborador" -ForegroundColor Cyan
$terc = Get-Registros 'dgt_terceiro' "`$select=dgt_name&`$filter=dgt_ativo eq true"
$colab = Get-Registros 'dgt_fornecedorcolaborador' "`$select=dgt_name&`$filter=dgt_ativo eq true"
if ($null -eq $terc) { Add-Linha "4-PessoaExterna" "dgt_terceiro" "NÃO EXISTE" "" }
if ($null -eq $colab) { Add-Linha "4-PessoaExterna" "dgt_fornecedorcolaborador" "NÃO EXISTE" "" }
if ($null -ne $terc -and $null -ne $colab) {
    $nomesTerc = @{}
    foreach ($r in @($terc)) { $n = Normalizar $r.dgt_name; if ($n) { $nomesTerc[$n] = $r.dgt_name } }
    $coincidentes = @()
    foreach ($r in @($colab)) {
        $n = Normalizar $r.dgt_name
        if ($n -and $nomesTerc.ContainsKey($n)) { $coincidentes += [PSCustomObject]@{ Terceiro = $nomesTerc[$n]; ColaboradorFornecedor = $r.dgt_name } }
    }
    $res = if ($coincidentes.Count) { "ATENÇÃO - pessoas nas duas tabelas" } else { "OK - nenhuma coincidência" }
    Add-Linha "4-PessoaExterna" "nomes coincidentes" $res "terceiros=$(@($terc).Count); colaboradores=$(@($colab).Count); coincidências=$($coincidentes.Count)"
    if ($ExportarNomesCoincidentes -and $coincidentes.Count) {
        $arq = Join-Path $OutputFolder "Alinhamento_PessoasCoincidentes_DADOS-PESSOAIS.csv"
        $coincidentes | Export-Csv -Path $arq -Delimiter ";" -NoTypeInformation -Encoding UTF8
        Write-Host "  Nomes gravados em $arq (dado pessoal: apague após o uso)." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------
# 5. Referências em texto x cadastros
# ---------------------------------------------------------------
Write-Host "`n5) Referências em texto x cadastros" -ForegroundColor Cyan
$areas = Get-Registros 'dgt_area' "`$select=dgt_name,dgt_sigla"
if ($null -eq $areas) { $areas = @() }
$chavesArea = @{}
foreach ($a in $areas) { foreach ($v in @($a.dgt_name, $a.dgt_sigla)) { $n = Normalizar $v; if ($n) { $chavesArea[$n] = $true } } }
$fabs = Get-Registros 'dgt_fabricante' "`$select=dgt_name,dgt_ativo"
if ($null -eq $fabs) { $fabs = @() }
$chavesFab = @{}
foreach ($f in $fabs) { $n = Normalizar $f.dgt_name; if ($n) { $chavesFab[$n] = $true } }

$alvos = @(
    @{ Tabela = 'dgt_terceiro';               Coluna = 'dgt_area';           Chaves = $chavesArea; Cadastro = 'dgt_area' },
    @{ Tabela = 'dgt_certificacaofabricante'; Coluna = 'dgt_area';           Chaves = $chavesArea; Cadastro = 'dgt_area' },
    @{ Tabela = 'dgt_declaracaofabricante';   Coluna = 'dgt_fabricante';     Chaves = $chavesFab;  Cadastro = 'dgt_fabricante' },
    @{ Tabela = 'dgt_bom_ro';                 Coluna = 'dgt_bom_fabricante'; Chaves = $chavesFab;  Cadastro = 'dgt_fabricante' }
)
foreach ($alvo in $alvos) {
    $regs = Get-Registros $alvo.Tabela "`$select=$($alvo.Coluna)"
    if ($null -eq $regs) { Add-Linha "5-Texto" $alvo.Tabela "NÃO EXISTE" ""; continue }
    foreach ($g in (@($regs) | Where-Object { $_.($alvo.Coluna) } | Group-Object { $_.($alvo.Coluna).Trim() })) {
        $achou = $alvo.Chaves.ContainsKey((Normalizar $g.Name))
        $res = if ($achou) { "OK - existe em $($alvo.Cadastro)" } else { "ATENÇÃO - sem correspondente em $($alvo.Cadastro)" }
        Add-Linha "5-Texto" "$($alvo.Tabela).$($alvo.Coluna) = '$($g.Name)'" $res "registros=$($g.Count)"
    }
}

# ---------------------------------------------------------------
# 6. dgt_documentoprocesso x processo de negócio
#    Regra (ProcessoNegocioService): exceção do tipo do documento,
#    senão fluxo padrão do processo. Tipo = 2ª parte do código.
# ---------------------------------------------------------------
Write-Host "`n6) Consistência de dgt_documentoprocesso" -ForegroundColor Cyan
$pn = Get-Registros 'dgt_processonegocio' "`$select=dgt_processonegocioid,_dgt_fluxopadrao_value&`$filter=dgt_ativo eq true"
$exc = Get-Registros 'dgt_processonegociofluxo' "`$select=_dgt_processonegocio_value,dgt_tipodocumento,_dgt_fluxo_value&`$filter=dgt_ativo eq true"
$docs = Get-Registros 'dgt_documento' "`$select=dgt_documentoid,dgt_codigo,_dgt_processonegocio_value&`$filter=dgt_ativo eq true"
$vinc = Get-Registros 'dgt_documentoprocesso' "`$select=_dgt_documento_value,_dgt_processo_value,dgt_principal&`$filter=dgt_ativo eq true"

if ($null -ne $docs -and $null -ne $vinc -and $null -ne $pn) {
    $padrao = @{}; foreach ($p in @($pn)) { $padrao[[string]$p.dgt_processonegocioid] = [string]$p._dgt_fluxopadrao_value }
    $excecoes = @{}
    foreach ($e in @($exc)) {
        if ($e.dgt_tipodocumento -and $e._dgt_fluxo_value) {
            $excecoes["$($e._dgt_processonegocio_value)|$($e.dgt_tipodocumento.Trim().ToUpperInvariant())"] = [string]$e._dgt_fluxo_value
        }
    }
    $vinculos = @{}
    foreach ($v in @($vinc)) {
        $d = [string]$v._dgt_documento_value
        if (-not $vinculos.ContainsKey($d) -or $v.dgt_principal) { $vinculos[$d] = [string]$v._dgt_processo_value }
    }
    $semProcesso = 0; $ok = 0; $divergentes = @()
    foreach ($doc in @($docs)) {
        $procId = [string]$doc._dgt_processonegocio_value
        if (-not $procId) { $semProcesso++; continue }
        $partes = ([string]$doc.dgt_codigo).Trim().ToUpperInvariant().Split('-')
        $tipo = if ($partes.Count -ge 3) { $partes[1] } else { "" }
        $esperado = $excecoes["$procId|$tipo"]
        if (-not $esperado) { $esperado = $padrao[$procId] }
        $atual = $vinculos[[string]$doc.dgt_documentoid]
        if ($esperado -and $atual -and $esperado -eq $atual) { $ok++ } else { $divergentes += $doc.dgt_codigo }
    }
    Add-Linha "6-DocumentoProcesso" "documentos coerentes" "OK" "$ok"
    Add-Linha "6-DocumentoProcesso" "documentos sem processo de negócio" "INFO" "$semProcesso (seguem só dgt_documentoprocesso)"
    $res = if ($divergentes.Count) { "ATENÇÃO - vínculo diferente do esperado" } else { "OK - nenhum" }
    Add-Linha "6-DocumentoProcesso" "documentos divergentes" $res (($divergentes | Select-Object -First 50) -join ", ")
}

# ---------------------------------------------------------------
# 7. Catálogo de servidores: tabelas antigas x dgt_kititem
# ---------------------------------------------------------------
Write-Host "`n7) Catálogo de servidores em dgt_kititem" -ForegroundColor Cyan
$itens = Get-Registros 'dgt_kititem' "`$select=dgt_tipo,dgt_situacao,modifiedon&`$filter=dgt_tipo eq 'servidor' or dgt_tipo eq 'servidorSoftware'"
if ($null -eq $itens) { Add-Linha "7-Servidores" "dgt_kititem" "NÃO EXISTE" "" }
else {
    foreach ($tipo in @('servidor', 'servidorSoftware')) {
        $g = @($itens | Where-Object { $_.dgt_tipo -eq $tipo })
        $ultima = if ($g.Count) { ($g | Sort-Object modifiedon -Descending | Select-Object -First 1).modifiedon } else { "-" }
        $res = if ($g.Count) { "OK - catálogo presente" } else { "ATENÇÃO - catálogo vazio" }
        Add-Linha "7-Servidores" "dgt_kititem (dgt_tipo = $tipo)" $res "linhas=$($g.Count); última alteração=$ultima"
    }
    $pend = @($itens | Where-Object { $_.dgt_tipo -eq 'servidor' -and (Get-Fmt $_ 'dgt_situacao') -match '(?i)pendente' })
    if ($pend.Count) { Add-Linha "7-Servidores" "linhas de servidor pendentes" "INFO" "$($pend.Count) (sem dados da planilha)" }
}

# ---------------------------------------------------------------
# 8. Cadastro de fabricantes
# ---------------------------------------------------------------
Write-Host "`n8) Cadastro de fabricantes" -ForegroundColor Cyan
if ($null -eq (Get-Meta 'dgt_fabricante')) { Add-Linha "8-Fabricantes" "dgt_fabricante" "NÃO EXISTE" "" }
else {
    # O portal só mostra fabricantes ATIVOS (dgt_ativo = Sim).
    $ativos = @($fabs | Where-Object { $_.dgt_ativo -eq $true } | ForEach-Object { $_.dgt_name } | Sort-Object)
    $inativos = @($fabs | Where-Object { $_.dgt_ativo -ne $true } | ForEach-Object { $_.dgt_name } | Sort-Object)
    Add-Linha "8-Fabricantes" "dgt_fabricante (ativos, visíveis no portal)" "INFO" "$($ativos.Count): $($ativos -join ', ')"
    Add-Linha "8-Fabricantes" "dgt_fabricante (inativos, ocultos no portal)" "INFO" "$($inativos.Count): $($inativos -join ', ')"
}

# ---------------------------------------------------------------
# 9. PMO: quem usa a fonte projetos.atividades e onde está o dado vivo
# ---------------------------------------------------------------
Write-Host "`n9) Fonte de dashboard projetos.atividades e dados do painel" -ForegroundColor Cyan
$dash = Get-Registros 'dgt_dashboard' "`$select=dgt_name,dgt_definicao,dgt_ativo"
if ($null -ne $dash) {
    $usam = @($dash | Where-Object { $_.dgt_definicao -and $_.dgt_definicao -match 'projetos\.atividades' })
    $res = if ($usam.Count) { "ATENÇÃO - dashboards usam a fonte" } else { "OK - nenhum dashboard usa a fonte" }
    Add-Linha "9-PMO" "dashboards com projetos.atividades" $res (($usam | ForEach-Object { "$($_.dgt_name)$(if (-not $_.dgt_ativo) { ' (inativo)' })" }) -join ' | ')
}
$impl = Get-Registros 'dgt_implregistro' "`$select=dgt_colecao,dgt_balde,modifiedon&`$filter=(dgt_excluido eq false or dgt_excluido eq null) and (dgt_colecao eq 'atividades' or dgt_colecao eq 'faturamentos' or dgt_colecao eq 'projetos')"
if ($null -ne $impl) {
    foreach ($g in (@($impl) | Group-Object dgt_colecao)) {
        $ultima = ($g.Group | Sort-Object modifiedon -Descending | Select-Object -First 1).modifiedon
        $baldes = @($g.Group | ForEach-Object { $_.dgt_balde } | Sort-Object -Unique).Count
        Add-Linha "9-PMO" "dgt_implregistro (coleção $($g.Name))" "INFO" "linhas=$($g.Count); projetos=$baldes; última alteração=$ultima"
    }
}

# ---------------------------------------------------------------
# Relatório
# ---------------------------------------------------------------
if (-not (Test-Path -LiteralPath $OutputFolder)) { New-Item -ItemType Directory -Path $OutputFolder | Out-Null }
$arquivo = Join-Path $OutputFolder ("Alinhamento_Diagnostico_{0}.csv" -f (Get-Date -Format "yyyyMMdd-HHmm"))
$relatorio | Export-Csv -Path $arquivo -Delimiter ";" -NoTypeInformation -Encoding UTF8
Write-Host "`nRelatório: $arquivo" -ForegroundColor Green
Write-Host "Observações:" -ForegroundColor Cyan
Write-Host "  - Só aparecem os fluxos do Power Automate que o seu usuário consegue ver. Peça a um administrador para rodar também."
Write-Host "  - Relatórios do Power BI não aparecem aqui: confira os conjuntos de dados manualmente."
Write-Host "  - O relatório pode conter nomes de contas: trate como dado pessoal e apague após o uso."
