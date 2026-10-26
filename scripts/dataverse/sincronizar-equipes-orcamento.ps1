<#
.SYNOPSIS
  Cria e mantém as EQUIPES do Planejamento orçamentário — uma por área —
  para que cada área tenha UMA planilha compartilhada pelos seus gestores.

.DESCRIPTION
  Por que existe:
    A planilha da área precisa ser vista e editada por TODOS os gestores
    da área e por mais ninguém (além dos administradores). No Dataverse
    isso é feito com uma EQUIPE PROPRIETÁRIA (owner team) por área: a
    planilha, as linhas, o log e o histórico pertencem à equipe, e os
    gestores da área são membros dela.

  O que o script faz (para cada área ativa em dgt_area):
    1. Garante o perfil de segurança "DGT Orçamento - Equipe da área"
       (só acesso às tabelas do orçamento, no nível Usuário) — é o
       perfil que a equipe usa para poder ser dona dos registros.
    2. Garante a equipe "Orçamento · <área>" e associa o perfil a ela.
    3. Grava o id da equipe em dgt_orcamentoconfigarea (o portal lê
       daí para criar a planilha já com a equipe como proprietária).
    4. Sincroniza os MEMBROS: entram os usuários com papel Gestor ou
       Administrador da área (dgt_usuarioarea ativo); saem os que não
       têm mais esse papel. O vínculo é feito pelo e-mail
       (dgt_usuario.dgt_email = e-mail ou UPN do usuário do ambiente).
    5. Passa para a equipe as planilhas da área que ainda estão com um
       usuário como dono (e as linhas, o log e o histórico delas).

  Rode de novo sempre que mudar gestores de uma área (ou agende num
  fluxo/tarefa diária). Pode rodar quantas vezes quiser: só muda o que
  estiver diferente.

  SEGURANÇA
    Sem -Executar o script só SIMULA e mostra o que faria.

  PERMISSÃO
    Quem executa precisa administrar equipes e perfis de segurança no
    ambiente (ex.: Administrador do sistema).

.PARAMETER UrlAmbiente
  Ex.: https://suaorg.crm2.dynamics.com

.PARAMETER Solucao
  Opcional. Nome exclusivo da solução onde incluir o perfil de
  segurança criado (ex.: DGTPortaldeConhecimentoeTreinamentos).

.PARAMETER Executar
  Sem esta opção, apenas simula.

.PARAMETER PrefixoEquipe
  Prefixo do nome das equipes. Padrão: "Orçamento · "

.PARAMETER NomePerfilEquipe
  Nome do perfil de segurança das equipes.
  Padrão: "DGT Orçamento - Equipe da área"

.PARAMETER Token
  Opcional. Token já obtido; senão usa Az.Accounts (Connect-AzAccount).

.EXAMPLE
  .\sincronizar-equipes-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com

.EXAMPLE
  .\sincronizar-equipes-orcamento.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos -Executar
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [string] $Solucao,
  [switch] $Executar,
  [string] $PrefixoEquipe = 'Orçamento · ',
  [string] $NomePerfilEquipe = 'DGT Orçamento - Equipe da área',
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
  param([string] $Metodo, [string] $Caminho, $Corpo, [hashtable] $Extras)

  $uri = if ($Caminho -like 'http*') { $Caminho } else { "$Api/$Caminho" }

  $cab = $Cabecalhos.Clone()
  if ($Extras) { foreach ($k in $Extras.Keys) { $cab[$k] = $Extras[$k] } }

  $parametros = @{
    Method      = $Metodo
    Uri         = $uri
    Headers     = $cab
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

# POST que devolve o id criado (cabeçalho OData-EntityId).
function New-Registro {
  param([string] $Conjunto, [hashtable] $Corpo, [hashtable] $Extras)
  $cab = $Cabecalhos.Clone()
  if ($Extras) { foreach ($k in $Extras.Keys) { $cab[$k] = $Extras[$k] } }
  $json = $Corpo | ConvertTo-Json -Depth 30
  $resposta = Invoke-WebRequest -Method 'POST' -Uri "$Api/$Conjunto" -Headers $cab -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -UseBasicParsing
  $entidade = [string]($resposta.Headers['OData-EntityId'] | Select-Object -First 1)
  if ($entidade -match '\(([0-9a-fA-F-]{36})\)') { return $Matches[1].ToLower() }
  throw "Não foi possível ler o id criado em $Conjunto."
}

$sim = -not $Executar
$acoes = 0
$avisos = @()

function Write-Acao {
  param([string] $Texto)
  $script:acoes++
  if ($sim) { Write-Host "    [simulação] $Texto" -ForegroundColor DarkYellow }
  else { Write-Host "    + $Texto" -ForegroundColor Green }
}

Write-Host ''
Write-Host "Ambiente: $UrlAmbiente" -ForegroundColor Cyan
Write-Host "Modo:     $(if ($sim) { 'SIMULAÇÃO — nada será alterado' } else { 'EXECUÇÃO' })" -ForegroundColor Cyan

# ------------------------------------------------------------
# 0) Pré-requisitos
# ------------------------------------------------------------

$quem = Invoke-Dv -Metodo 'GET' -Caminho 'WhoAmI'
$meuId = $quem.UserId

$raiz = (Get-Todos 'businessunits?$select=businessunitid,name&$filter=_parentbusinessunitid_value eq null' | Select-Object -First 1)
$raizId = $raiz.businessunitid

try {
  Invoke-Dv -Metodo 'GET' -Caminho "EntityDefinitions(LogicalName='dgt_orcamentoconfigarea')/Attributes(LogicalName='dgt_equipeid')?`$select=LogicalName" | Out-Null
}
catch {
  Write-Host 'A coluna dgt_orcamentoconfigarea.dgt_equipeid não existe. Rode antes o criar-tabelas-orcamento.ps1 (versão atual).' -ForegroundColor Red
  return
}

# ------------------------------------------------------------
# 1) Perfil de segurança das equipes
# ------------------------------------------------------------

Write-Host "`n1) Perfil de segurança '$NomePerfilEquipe'" -ForegroundColor Cyan

$nomeFiltro = $NomePerfilEquipe.Replace("'", "''")
$perfil = (Get-Todos "roles?`$select=roleid,name&`$filter=name eq '$nomeFiltro' and _businessunitid_value eq $raizId" | Select-Object -First 1)
$perfilId = if ($perfil) { $perfil.roleid } else { $null }

function Get-PrivilegioId {
  param([string] $Nome)
  $r = Get-Todos "privileges?`$select=privilegeid&`$filter=name eq '$Nome'" | Select-Object -First 1
  if (-not $r) { throw "Privilégio $Nome não encontrado (a tabela existe e foi publicada?)." }
  return $r.privilegeid
}

if (-not $perfilId) {
  Write-Acao "criar o perfil '$NomePerfilEquipe' na unidade '$($raiz.name)'"
  if (-not $sim) {
    $extras = @{}
    if ($Solucao) { $extras['MSCRM.SolutionUniqueName'] = $Solucao }
    $perfilId = New-Registro 'roles' @{
      name                      = $NomePerfilEquipe
      'businessunitid@odata.bind' = "/businessunits($raizId)"
    } $extras
  }
}
else {
  Write-Host "  = perfil já existe"
}

# Privilégios do perfil (nível Usuário = registros da própria equipe).
$privilegios = @()
foreach ($t in @('dgt_orcamentoplanilha', 'dgt_orcamentolinha')) {
  foreach ($a in @('Create', 'Read', 'Write', 'Append', 'AppendTo')) { $privilegios += "prv$a$t" }
}
foreach ($t in @('dgt_orcamentoevento', 'dgt_orcamentoalteracao')) {
  foreach ($a in @('Create', 'Read', 'Append')) { $privilegios += "prv$a$t" }
}

if ($perfilId) {
  Write-Acao "garantir $($privilegios.Count) privilégios (nível Usuário) no perfil"
  if (-not $sim) {
    $lista = @($privilegios | ForEach-Object {
      @{ PrivilegeId = (Get-PrivilegioId $_); Depth = 'Basic'; BusinessUnitId = $raizId }
    })
    Invoke-Dv -Metodo 'POST' -Caminho "roles($perfilId)/Microsoft.Dynamics.CRM.AddPrivilegesRole" -Corpo @{ Privileges = $lista } | Out-Null
  }
}

# ------------------------------------------------------------
# 2) Dados de apoio
# ------------------------------------------------------------

$areas = @(Get-Todos 'dgt_areas?$select=dgt_areaid,dgt_name,dgt_sigla&$filter=dgt_ativo eq true&$orderby=dgt_name asc')

# Gestor (100000001) e Administrador da área (100000002), ativos.
$vinculos = @(Get-Todos 'dgt_usuarioareas?$select=_dgt_usuario_value,_dgt_area_value,dgt_perfilarea&$filter=dgt_ativo eq true and (dgt_perfilarea eq 100000001 or dgt_perfilarea eq 100000002)')

$usuariosPortal = @{}
Get-Todos 'dgt_usuarios?$select=dgt_usuarioid,dgt_name,dgt_email' | ForEach-Object {
  $usuariosPortal[$_.dgt_usuarioid.ToLower()] = $_
}

# Usuários do ambiente por e-mail e por UPN.
$usuariosAmbiente = @{}
Get-Todos 'systemusers?$select=systemuserid,fullname,internalemailaddress,domainname&$filter=isdisabled eq false' | ForEach-Object {
  if ($_.internalemailaddress) { $usuariosAmbiente[$_.internalemailaddress.ToLower()] = $_ }
  if ($_.domainname) { $usuariosAmbiente[$_.domainname.ToLower()] = $_ }
}

$configs = @{}
Get-Todos 'dgt_orcamentoconfigareas?$select=dgt_orcamentoconfigareaid,_dgt_area_value,dgt_equipeid&$filter=dgt_ativo eq true' | ForEach-Object {
  if ($_._dgt_area_value) { $configs[$_._dgt_area_value.ToLower()] = $_ }
}

$resumo = @()

# ------------------------------------------------------------
# 3) Uma equipe por área
# ------------------------------------------------------------

foreach ($area in $areas) {

  $areaId = $area.dgt_areaid.ToLower()
  # "CPU · COMERCIAL PÚBLICO" (sigla na frente, se o nome ainda não tiver).
  $jaTemSigla = $area.dgt_sigla -and (($area.dgt_name -eq $area.dgt_sigla) -or ($area.dgt_name -match ('^' + [regex]::Escape($area.dgt_sigla) + '\s*[·\-–:]')))
  $nomeArea = if ($area.dgt_sigla -and -not $jaTemSigla) { "$($area.dgt_sigla) · $($area.dgt_name)" } else { $area.dgt_name }
  $nomeEquipe = ("$PrefixoEquipe$nomeArea")
  if ($nomeEquipe.Length -gt 160) { $nomeEquipe = $nomeEquipe.Substring(0, 160) }

  Write-Host "`n2) Área: $nomeArea" -ForegroundColor Cyan

  # --- Equipe -------------------------------------------------
  $config = $configs[$areaId]
  $equipeId = $null

  if ($config -and $config.dgt_equipeid) {
    try {
      $equipeId = (Invoke-Dv -Metodo 'GET' -Caminho "teams($($config.dgt_equipeid))?`$select=teamid").teamid
    }
    catch { $equipeId = $null }
  }

  if (-not $equipeId) {
    $nomeFiltroEquipe = $nomeEquipe.Replace("'", "''")
    $existente = (Get-Todos "teams?`$select=teamid&`$filter=name eq '$nomeFiltroEquipe' and teamtype eq 0" | Select-Object -First 1)
    if ($existente) { $equipeId = $existente.teamid }
  }

  if (-not $equipeId) {
    Write-Acao "criar a equipe '$nomeEquipe'"
    if (-not $sim) {
      $equipeId = New-Registro 'teams' @{
        name                        = $nomeEquipe
        teamtype                    = 0
        description                 = "Gestores da área $nomeArea no Planejamento orçamentário. Mantida por sincronizar-equipes-orcamento.ps1."
        'businessunitid@odata.bind' = "/businessunits($raizId)"
        'administratorid@odata.bind' = "/systemusers($meuId)"
      }
    }
  }
  else {
    Write-Host "  = equipe '$nomeEquipe'"
  }

  # --- Perfil na equipe ---------------------------------------
  if ($equipeId -and $perfilId) {
    $perfisEquipe = @(Get-Todos "teams($equipeId)/teamroles_association?`$select=roleid" | ForEach-Object { $_.roleid.ToLower() })
    if ($perfisEquipe -notcontains $perfilId.ToLower()) {
      Write-Acao "associar o perfil '$NomePerfilEquipe' à equipe"
      if (-not $sim) {
        Invoke-Dv -Metodo 'POST' -Caminho "teams($equipeId)/teamroles_association/`$ref" -Corpo @{ '@odata.id' = "$Api/roles($perfilId)" } | Out-Null
      }
    }
  }
  elseif (-not $equipeId) {
    Write-Acao "associar o perfil '$NomePerfilEquipe' à nova equipe"
  }

  # --- Configuração da área (id da equipe) ---------------------
  if (-not $config) {
    Write-Acao "registrar a equipe em dgt_orcamentoconfigarea (contas: todos os grupos)"
    if (-not $sim) {
      New-Registro 'dgt_orcamentoconfigareas' @{
        dgt_name               = "Contas — $nomeArea"
        dgt_areanome           = $nomeArea
        dgt_grupos             = '[]'
        dgt_ativo              = $true
        dgt_equipeid           = $equipeId
        'dgt_Area@odata.bind'  = "/dgt_areas($areaId)"
      } | Out-Null
    }
  }
  elseif ($equipeId -and $config.dgt_equipeid -ne $equipeId) {
    Write-Acao "gravar o id da equipe em dgt_orcamentoconfigarea"
    if (-not $sim) {
      Invoke-Dv -Metodo 'PATCH' -Caminho "dgt_orcamentoconfigareas($($config.dgt_orcamentoconfigareaid))" -Corpo @{ dgt_equipeid = $equipeId } | Out-Null
    }
  }

  # --- Membros -------------------------------------------------
  $desejados = @{}
  $semUsuario = @()

  $vinculos | Where-Object { $_._dgt_area_value -and $_._dgt_area_value.ToLower() -eq $areaId } | ForEach-Object {
    $pessoa = $usuariosPortal[$_._dgt_usuario_value.ToLower()]
    if (-not $pessoa) { return }
    $email = if ($pessoa.dgt_email) { $pessoa.dgt_email.Trim().ToLower() } else { '' }
    $sistema = if ($email) { $usuariosAmbiente[$email] } else { $null }
    if ($sistema) { $desejados[$sistema.systemuserid.ToLower()] = $pessoa.dgt_name }
    else { $semUsuario += "$($pessoa.dgt_name) <$email>" }
  }

  $atuais = @{}
  if ($equipeId) {
    Get-Todos "teams($equipeId)/teammembership_association?`$select=systemuserid,fullname" | ForEach-Object {
      $atuais[$_.systemuserid.ToLower()] = $_.fullname
    }
  }

  $entrar = @($desejados.Keys | Where-Object { -not $atuais.ContainsKey($_) })
  $sair = @($atuais.Keys | Where-Object { -not $desejados.ContainsKey($_) })

  foreach ($id in $entrar) { Write-Acao "incluir $($desejados[$id]) na equipe" }
  foreach ($id in $sair) { Write-Acao "retirar $($atuais[$id]) da equipe (não é mais gestor da área)" }

  if (-not $sim -and $equipeId) {
    if ($entrar.Count -gt 0) {
      Invoke-Dv -Metodo 'POST' -Caminho "teams($equipeId)/Microsoft.Dynamics.CRM.AddMembersTeam" -Corpo @{
        Members = @($entrar | ForEach-Object { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.systemuser'; systemuserid = $_ } })
      } | Out-Null
    }
    if ($sair.Count -gt 0) {
      Invoke-Dv -Metodo 'POST' -Caminho "teams($equipeId)/Microsoft.Dynamics.CRM.RemoveMembersTeam" -Corpo @{
        Members = @($sair | ForEach-Object { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.systemuser'; systemuserid = $_ } })
      } | Out-Null
    }
  }

  foreach ($item in $semUsuario) {
    $script:avisos += "$nomeArea : gestor sem usuário no ambiente com este e-mail — $item"
  }

  # --- Planilhas da área ainda com um usuário como dono ---------
  $planilhas = @(Get-Todos "dgt_orcamentoplanilhas?`$select=dgt_orcamentoplanilhaid,dgt_name,dgt_ano,_owningteam_value&`$filter=_dgt_area_value eq $areaId")
  $porAno = $planilhas | Group-Object dgt_ano
  foreach ($grupo in $porAno) {
    if ($grupo.Count -gt 1) {
      $script:avisos += "$nomeArea : $($grupo.Count) planilhas em $($grupo.Name) (duplicadas). O portal usa a mais antiga; avalie desativar a outra."
    }
  }

  $transferir = @($planilhas | Where-Object { -not $_._owningteam_value -or ($equipeId -and $_._owningteam_value.ToLower() -ne $equipeId.ToLower()) })

  foreach ($planilha in $transferir) {
    $planilhaId = $planilha.dgt_orcamentoplanilhaid
    $filhos = @()
    $filhos += @(Get-Todos "dgt_orcamentolinhas?`$select=dgt_orcamentolinhaid&`$filter=_dgt_planilha_value eq $planilhaId" | ForEach-Object { "dgt_orcamentolinhas($($_.dgt_orcamentolinhaid))" })
    try { $filhos += @(Get-Todos "dgt_orcamentoeventos?`$select=dgt_orcamentoeventoid&`$filter=_dgt_planilha_value eq $planilhaId" | ForEach-Object { "dgt_orcamentoeventos($($_.dgt_orcamentoeventoid))" }) } catch { }
    try { $filhos += @(Get-Todos "dgt_orcamentoalteracaos?`$select=dgt_orcamentoalteracaoid&`$filter=_dgt_planilha_value eq $planilhaId" | ForEach-Object { "dgt_orcamentoalteracaos($($_.dgt_orcamentoalteracaoid))" }) } catch { }

    Write-Acao "passar para a equipe a planilha '$($planilha.dgt_name)' e $($filhos.Count) registro(s) dela"

    if (-not $sim -and $equipeId) {
      $dono = @{ 'ownerid@odata.bind' = "/teams($equipeId)" }
      Invoke-Dv -Metodo 'PATCH' -Caminho "dgt_orcamentoplanilhas($planilhaId)" -Corpo $dono | Out-Null
      $n = 0
      foreach ($caminho in $filhos) {
        $n++
        Write-Progress -Activity "Transferindo '$($planilha.dgt_name)'" -Status "$n de $($filhos.Count)" -PercentComplete (100 * $n / [Math]::Max(1, $filhos.Count))
        try { Invoke-Dv -Metodo 'PATCH' -Caminho $caminho -Corpo $dono | Out-Null }
        catch { $script:avisos += "$nomeArea : falha ao transferir $caminho — $($_.Exception.Message)" }
      }
      Write-Progress -Activity "Transferindo '$($planilha.dgt_name)'" -Completed
    }
  }

  $resumo += [PSCustomObject]@{
    Area        = $nomeArea
    Equipe      = if ($equipeId) { 'ok' } else { 'criar' }
    Gestores    = $desejados.Count
    Entram      = $entrar.Count
    Saem        = $sair.Count
    SemUsuario  = $semUsuario.Count
    Transferir  = $transferir.Count
  }
}

# ------------------------------------------------------------
# 4) Resultado
# ------------------------------------------------------------

Write-Host "`nResumo" -ForegroundColor Cyan
$resumo | Format-Table -AutoSize | Out-String -Width 200 | Write-Host

if ($avisos.Count -gt 0) {
  Write-Host 'Atenção:' -ForegroundColor Yellow
  $avisos | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

if ($sim) {
  Write-Host "Simulação concluída: $acoes ação(ões) seriam feitas. Para aplicar, rode de novo com -Executar." -ForegroundColor Green
}
else {
  Write-Host "Concluído: $acoes ação(ões) realizada(s)." -ForegroundColor Green
}
