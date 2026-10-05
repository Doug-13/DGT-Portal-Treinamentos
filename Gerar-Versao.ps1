<#
.SYNOPSIS
    Gera uma VERSÃO do Portal DGT: aumenta o número da versão, compila,
    empacota o .sppkg e copia para a pasta Downloads.

.DESCRIPTION
    Builds do dia a dia (npm run build / npx heft build) NÃO mudam a
    versão. Só este script gera uma versão nova:

      1. Guarda uma cópia dos arquivos de versão (para desfazer se falhar).
      2. Aumenta a versão (patch, minor ou major) e move as anotações de
         "## [Não publicado]" do CHANGELOG.md para a nova versão.
      3. npx heft build --production
      4. npx heft package-solution --production
      5. Copia o pacote para Downloads com o número da versão no nome.
      6. Opcional: commit e tag no Git.

    Se a compilação ou o empacotamento falhar, a versão volta ao número
    anterior automaticamente (nada é "gasto").

.PARAMETER Tipo
    patch (padrão): 1.0.4 → 1.0.5 · minor: 1.0.4 → 1.1.0 · major: 1.0.4 → 2.0.0

.PARAMETER Git
    Faz commit dos arquivos de versão e cria a tag vX.Y.Z (sem push).

.EXAMPLE
    .\Gerar-Versao.ps1

.EXAMPLE
    .\Gerar-Versao.ps1 -Tipo minor -Git
#>

[CmdletBinding()]
param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Tipo = 'patch',

    [string]$Projeto = 'C:\DGT\DGT-Portal-Treinamentos\portal-treinamentos',

    [string]$Destino = "$env:USERPROFILE\Downloads",

    [switch]$Git
)

# 'Continue': ferramentas como heft/npx escrevem avisos no stderr, e no
# Windows PowerShell 5.1 isso viraria erro. Os erros reais são tratados
# pelo código de saída ($LASTEXITCODE) de cada etapa.
$ErrorActionPreference = 'Continue'

Set-Location $Projeto

# Arquivos alterados pelo script de versão
$Arquivos = @(
    'package.json',
    'config\package-solution.json',
    'CHANGELOG.md',
    'src\webparts\portalTreinamentosWebPart\constants\versao.ts'
)

foreach ($a in @('scripts\versao.js', 'package.json', 'config\package-solution.json')) {
    if (-not (Test-Path $a)) {
        throw "Arquivo não encontrado: $a. Execute este script na raiz do projeto."
    }
}

$versaoAnterior = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version

# ------------------------------------------------------------
# 1. Cópia de segurança dos arquivos de versão
# ------------------------------------------------------------

$Backup = Join-Path $env:TEMP ("dgt-versao-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Backup | Out-Null

foreach ($a in $Arquivos) {
    if (Test-Path $a) {
        $alvo = Join-Path $Backup $a
        New-Item -ItemType Directory -Path (Split-Path $alvo) -Force | Out-Null
        Copy-Item $a $alvo -Force
    }
}

function Restaurar-Versao {
    foreach ($a in $Arquivos) {
        $copia = Join-Path $Backup $a
        if (Test-Path $copia) { Copy-Item $copia $a -Force }
    }
    Write-Host "Versão restaurada para $versaoAnterior." -ForegroundColor Yellow
}

try {

    # ------------------------------------------------------------
    # 2. Nova versão
    # ------------------------------------------------------------

    Write-Host ''
    Write-Host "== Gerando versão ($Tipo)" -ForegroundColor White

    node scripts/versao.js $Tipo
    if ($LASTEXITCODE -ne 0) { throw 'Erro ao gerar o número da versão.' }

    $versao = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version

    # ------------------------------------------------------------
    # 3. Compilar
    # ------------------------------------------------------------

    Write-Host "== Compilando a versão $versao (produção)" -ForegroundColor White

    npx heft build --production
    if ($LASTEXITCODE -ne 0) { throw 'Erro na compilação. Processo interrompido.' }

    # ------------------------------------------------------------
    # 4. Empacotar
    # ------------------------------------------------------------

    Write-Host '== Gerando o pacote SharePoint' -ForegroundColor White

    npx heft package-solution --production
    if ($LASTEXITCODE -ne 0) { throw 'Erro ao gerar o pacote.' }

} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Restaurar-Versao
    Remove-Item $Backup -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

Remove-Item $Backup -Recurse -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 5. Copiar para Downloads
# ------------------------------------------------------------

$Origem = '.\sharepoint\solution\DGT-Portal-Treinamentos.sppkg'

if (-not (Test-Path $Origem)) {
    throw "Pacote não encontrado em $Origem."
}

$Arquivo = Join-Path $Destino "DGT-Portal-Treinamentos_v$versao.sppkg"
Copy-Item $Origem $Arquivo -Force -ErrorAction Stop

# ------------------------------------------------------------
# 6. Git (opcional)
# ------------------------------------------------------------

if ($Git) {
    Write-Host '== Git' -ForegroundColor White

    git add -- $Arquivos
    git commit -m "Versão $versao" | Out-Null

    if ($LASTEXITCODE -eq 0) {
        git tag "v$versao"
        Write-Host "   Commit e tag v$versao criados. Envie com: git push; git push --tags" -ForegroundColor Gray
    } else {
        Write-Host '   Nada para registrar no Git (ou commit recusado).' -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------
# Resumo
# ------------------------------------------------------------

Write-Host ''
Write-Host "Versão $versaoAnterior → $versao gerada." -ForegroundColor Green
Write-Host "Pacote: $Arquivo" -ForegroundColor Green
Write-Host ''
Write-Host 'Próximo passo: Catálogo de Aplicativos > Carregar > Substituir > Implantar.' -ForegroundColor Cyan
Write-Host ''
