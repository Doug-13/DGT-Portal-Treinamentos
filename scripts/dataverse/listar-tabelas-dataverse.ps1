<#
.SYNOPSIS
    Lista todas as tabelas do Dataverse (e, opcionalmente, as colunas) e exporta para CSV.

.DESCRIPTION
    Usa a Web API de metadados do Dataverse (EntityDefinitions).
    A autenticação é interativa (Connect-AzAccount): nenhuma credencial fica no script,
    e o token de acesso nunca é exibido nem gravado em log.

.PARAMETER EnvironmentUrl
    URL do ambiente. Ex.: https://suaorg.crm2.dynamics.com
    (Power Platform admin center › Ambientes › DGT – Automação Processos › URL do ambiente)

.PARAMETER OutputFolder
    Pasta onde os CSVs serão gravados. Padrão: pasta atual.

.PARAMETER SomentePersonalizadas
    Lista só as tabelas personalizadas (ex.: dgt_*).

.PARAMETER Prefixo
    Filtra pelo prefixo do nome lógico. Ex.: dgt_

.PARAMETER IncluirColunas
    Também exporta as colunas de cada tabela (mesmo formato do Dataverse_Tabelas_Colunas.csv).

.EXAMPLE
    .\listar-tabelas-dataverse.ps1 -EnvironmentUrl "https://suaorg.crm2.dynamics.com"

.EXAMPLE
    .\listar-tabelas-dataverse.ps1 -EnvironmentUrl "https://suaorg.crm2.dynamics.com" -Prefixo "dgt_" -IncluirColunas
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentUrl,

    [string]$OutputFolder = (Get-Location).Path,

    [switch]$SomentePersonalizadas,

    [string]$Prefixo = "",

    [switch]$IncluirColunas
)

$ErrorActionPreference = "Stop"
$EnvironmentUrl = $EnvironmentUrl.TrimEnd("/")
$apiBase = "$EnvironmentUrl/api/data/v9.2"

# ---------------------------------------------------------------
# 1. Módulo e autenticação
# ---------------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name Az.Accounts)) {
    Write-Host "Instalando o módulo Az.Accounts (somente para o usuário atual)..." -ForegroundColor Yellow
    Install-Module Az.Accounts -Scope CurrentUser -Force -AllowClobber
}
Import-Module Az.Accounts

if (-not (Get-AzContext)) {
    Write-Host "Abrindo login da Microsoft..." -ForegroundColor Cyan
    Connect-AzAccount | Out-Null
}

function Get-DataverseToken {
    $tokenObj = Get-AzAccessToken -ResourceUrl $EnvironmentUrl
    # Az recente devolve SecureString; versões antigas devolvem texto
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
    "Prefer"           = 'odata.include-annotations="*"'
}

function Invoke-Dataverse([string]$url) {
    $resultado = @()
    while ($url) {
        try {
            $resp = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
        }
        catch {
            # Mostra só o status e a mensagem do serviço (sem cabeçalhos/token)
            $status = $_.Exception.Response.StatusCode.value__
            throw "Falha na consulta ao Dataverse (HTTP $status): $($_.ErrorDetails.Message)"
        }
        $resultado += $resp.value
        $url = $resp.'@odata.nextLink'
    }
    return $resultado
}

function Get-Label($labelObj) {
    if ($null -ne $labelObj -and $null -ne $labelObj.UserLocalizedLabel) {
        return $labelObj.UserLocalizedLabel.Label
    }
    return ""
}

# ---------------------------------------------------------------
# 2. Tabelas
# ---------------------------------------------------------------
Write-Host "Buscando tabelas em $EnvironmentUrl ..." -ForegroundColor Cyan

$select = "LogicalName,SchemaName,DisplayName,EntitySetName,IsCustomEntity,IsActivity," +
          "PrimaryIdAttribute,PrimaryNameAttribute,OwnershipType,Description,MetadataId"
$tabelasRaw = Invoke-Dataverse "$apiBase/EntityDefinitions?`$select=$select"

$tabelas = $tabelasRaw | Where-Object {
    (-not $SomentePersonalizadas -or $_.IsCustomEntity) -and
    ([string]::IsNullOrEmpty($Prefixo) -or $_.LogicalName -like "$Prefixo*")
} | Sort-Object LogicalName | ForEach-Object {
    [PSCustomObject]@{
        TabelaLogicalName    = $_.LogicalName
        TabelaSchemaName     = $_.SchemaName
        TabelaDisplayName    = Get-Label $_.DisplayName
        EntitySetName        = $_.EntitySetName
        IsCustomEntity       = $_.IsCustomEntity
        IsActivity           = $_.IsActivity
        PrimaryIdAttribute   = $_.PrimaryIdAttribute
        PrimaryNameAttribute = $_.PrimaryNameAttribute
        OwnershipType        = $_.OwnershipType
        Descricao            = Get-Label $_.Description
        MetadataId           = $_.MetadataId
    }
}

if (-not (Test-Path $OutputFolder)) { New-Item -ItemType Directory -Path $OutputFolder | Out-Null }
$arqTabelas = Join-Path $OutputFolder "Dataverse_Tabelas.csv"
$tabelas | Export-Csv -Path $arqTabelas -Delimiter ";" -NoTypeInformation -Encoding UTF8

Write-Host "$($tabelas.Count) tabela(s) exportada(s) para: $arqTabelas" -ForegroundColor Green
$tabelas | Select-Object TabelaLogicalName, TabelaDisplayName, EntitySetName | Format-Table -AutoSize

# ---------------------------------------------------------------
# 3. Colunas (opcional)
# ---------------------------------------------------------------
if ($IncluirColunas) {
    $colSelect = "LogicalName,SchemaName,DisplayName,AttributeType,RequiredLevel,IsCustomAttribute," +
                 "IsPrimaryId,IsPrimaryName,IsValidForCreate,IsValidForUpdate,IsValidForRead," +
                 "IsSecured,Description,MetadataId"
    $colunas = New-Object System.Collections.Generic.List[object]
    $i = 0

    foreach ($t in $tabelas) {
        $i++
        Write-Progress -Activity "Lendo colunas" -Status $t.TabelaLogicalName -PercentComplete (($i / $tabelas.Count) * 100)

        $url = "$apiBase/EntityDefinitions(LogicalName='$($t.TabelaLogicalName)')/Attributes?`$select=$colSelect"
        try {
            $attrs = Invoke-Dataverse $url
        }
        catch {
            Write-Warning "Não foi possível ler as colunas de $($t.TabelaLogicalName): $($_.Exception.Message)"
            continue
        }

        foreach ($a in ($attrs | Where-Object { $_.AttributeOf -eq $null } | Sort-Object LogicalName)) {
            $colunas.Add([PSCustomObject]@{
                TabelaLogicalName = $t.TabelaLogicalName
                TabelaSchemaName  = $t.TabelaSchemaName
                TabelaDisplayName = $t.TabelaDisplayName
                ColunaLogicalName = $a.LogicalName
                ColunaSchemaName  = $a.SchemaName
                ColunaDisplayName = Get-Label $a.DisplayName
                Tipo              = $a.AttributeType
                Obrigatorio       = $a.RequiredLevel.Value
                IsCustomAttribute = $a.IsCustomAttribute
                IsPrimaryId       = $a.IsPrimaryId
                IsPrimaryName     = $a.IsPrimaryName
                IsValidForCreate  = $a.IsValidForCreate
                IsValidForUpdate  = $a.IsValidForUpdate
                IsValidForRead    = $a.IsValidForRead
                IsSecured         = $a.IsSecured
                Descricao         = Get-Label $a.Description
                MetadataId        = $a.MetadataId
            })
        }
    }
    Write-Progress -Activity "Lendo colunas" -Completed

    $arqColunas = Join-Path $OutputFolder "Dataverse_Tabelas_Colunas.csv"
    $colunas | Export-Csv -Path $arqColunas -Delimiter ";" -NoTypeInformation -Encoding UTF8
    Write-Host "$($colunas.Count) coluna(s) exportada(s) para: $arqColunas" -ForegroundColor Green
}
