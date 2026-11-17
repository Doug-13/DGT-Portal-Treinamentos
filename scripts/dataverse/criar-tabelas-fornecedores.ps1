<#
.SYNOPSIS
  Cria no Dataverse as tabelas do módulo Fornecedores (fase 1, uso
  interno) e a Custom API dgt_ConsultarFornecedor:
    dgt_fornecedor              Cadastro mestre (CNPJ em coluna PROTEGIDA)
    dgt_tipodocumentofornecedor Documentos exigidos, por categoria, com
                                visibilidade Interno/Externo
    dgt_fornecedordocumento     Versões de cada documento (Vigente /
                                Substituído) com emissão e validade
    dgt_fornecedorconsulta      Histórico das consultas CNPJá, CEIS e CNEP
    dgt_fornecedorhistorico     Histórico de alterações do cadastro
    dgt_fornecedorhomologacao   Ciclos de homologação (cards do kanban)
    dgt_fornecedorcolaborador   Colaboradores do prestador (CPF PROTEGIDO)
    dgt_colaboradordocumento    Documentos do colaborador (ASO, NR aplicável)

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/fornecedores/modeloFornecedores.ts

  LGPD — CNPJ: o restante do portal não grava CNPJ. Aqui o CNPJ da
  EMPRESA fornecedora é o identificador do cadastro e das consultas
  (CNPJá, CEIS, CNEP). Por isso:
    - ele fica SÓ em dgt_fornecedor.dgt_cnpj, com segurança de campo;
    - o perfil "DGT - Fornecedores - CNPJ" permite Ler e Criar, mas
      NÃO Atualizar (o CNPJ não muda depois do cadastro);
    - quem não está no perfil vê a coluna vazia;
    - textos livres continuam bloqueando CPF/CNPJ (validação na tela).
  O script só roda com -ConfirmoAprovacaoCnpj, para registrar que essa
  exceção foi aprovada (TI / encarregado de dados) antes da criação.

  Nada é apagado pela tela: fornecedor é desativado, documento antigo
  fica como Substituído, consultas e histórico só recebem linhas novas.

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-fornecedores.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_EXCLUSIVO -ConfirmoAprovacaoCnpj
#>

param(
  [Parameter(Mandatory = $true)] [string] $UrlAmbiente,
  [Parameter(Mandatory = $true)] [string] $Solucao,
  [string] $Token,
  [switch] $ConfirmoAprovacaoCnpj
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmoAprovacaoCnpj) {
  Write-Host 'Este script cria uma coluna de CNPJ (dgt_fornecedor.dgt_cnpj).' -ForegroundColor Yellow
  Write-Host 'Rode de novo com -ConfirmoAprovacaoCnpj depois que a exceção à regra de LGPD do portal for aprovada.' -ForegroundColor Yellow
  exit 1
}

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

function Test-Existe {
  param([string] $Caminho)
  try {
    Invoke-Dv -Metodo 'GET' -Caminho $Caminho | Out-Null
    return $true
  }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 404) { return $false }
    throw
  }
}

# ------------------------------------------------------------
# Idioma base do ambiente (os rótulos precisam dele)
# ------------------------------------------------------------

$org = Invoke-Dv -Metodo 'GET' -Caminho 'organizations?$select=languagecode'
$Idioma = [int]$org.value[0].languagecode
Write-Host "Ambiente: $UrlAmbiente  |  Solução: $Solucao  |  Idioma base: $Idioma" -ForegroundColor Cyan

function Rotulo {
  param([string] $Texto)
  @{
    '@odata.type'   = 'Microsoft.Dynamics.CRM.Label'
    LocalizedLabels = @(
      @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'
        Label         = $Texto
        LanguageCode  = $Idioma
      }
    )
  }
}

# ------------------------------------------------------------
# Criadores
# ------------------------------------------------------------

function New-Tabela {
  param([string] $Schema, [string] $Nome, [string] $Plural, [string] $Descricao)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = tabela $logico já existe"
    return
  }

  Write-Host "  + criando tabela $logico..." -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'EntityDefinitions' -Corpo @{
    '@odata.type'          = 'Microsoft.Dynamics.CRM.EntityMetadata'
    SchemaName             = $Schema
    DisplayName            = Rotulo $Nome
    DisplayCollectionName  = Rotulo $Plural
    Description            = Rotulo $Descricao
    OwnershipType          = 'UserOwned'
    IsActivity             = $false
    HasActivities          = $false
    HasNotes               = $false
    Attributes             = @(
      @{
        '@odata.type'  = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        SchemaName     = 'dgt_Name'
        IsPrimaryName  = $true
        RequiredLevel  = @{ Value = 'None' }
        MaxLength      = 200
        FormatName     = @{ Value = 'Text' }
        DisplayName    = Rotulo 'Nome'
      }
    )
  } | Out-Null
}

function New-Coluna {
  param([string] $Tabela, [string] $Schema, [hashtable] $Corpo)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }

  Write-Host "  + $Tabela.$logico" -ForegroundColor Green

  $Corpo.SchemaName = $Schema
  $Corpo.RequiredLevel = @{ Value = 'None' }

  Invoke-Dv -Metodo 'POST' -Caminho "EntityDefinitions(LogicalName='$Tabela')/Attributes" -Corpo $Corpo | Out-Null
}

function New-Texto {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
  }
}

function New-TextoLongo {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    Format        = 'TextArea'
  }
}

function New-Inteiro {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Format        = 'None'
    MinValue      = -2147483648
    MaxValue      = 2147483647
  }
}

function New-SimNao {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [bool] $Padrao = $false)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata'
    DisplayName   = Rotulo $Nome
    DefaultValue  = $Padrao
    OptionSet     = @{
      '@odata.type'  = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
      OptionSetType  = 'Boolean'
      TrueOption     = @{ Value = 1; Label = Rotulo 'Sim' }
      FalseOption    = @{ Value = 0; Label = Rotulo 'Não' }
    }
  }
}

function New-DataHora {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateAndTime'
    DateTimeBehavior = @{ Value = 'UserLocal' }
  }
}

function New-Decimal {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata'
    DisplayName   = Rotulo $Nome
    Precision     = 2
    MinValue      = 0
    MaxValue      = 100000000000
  }
}

# Data/hora "independente de fuso": grava o horário de Brasília
# exatamente como o PNCP informa (sem conversão).
function New-DataHoraSemFuso {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateAndTime'
    DateTimeBehavior = @{ Value = 'TimeZoneIndependent' }
  }
}

# Lookup (relacionamento 1:N) para outra tabela
function New-Lookup {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Referenciada, [string] $Relacionamento)

  $logico = $Schema.ToLower()

  if (Test-Existe "EntityDefinitions(LogicalName='$Tabela')/Attributes(LogicalName='$logico')?`$select=LogicalName") {
    Write-Host "  = $Tabela.$logico já existe"
    return
  }

  Write-Host "  + $Tabela.$logico (lookup → $Referenciada)" -ForegroundColor Green

  Invoke-Dv -Metodo 'POST' -Caminho 'RelationshipDefinitions' -Corpo @{
    '@odata.type'        = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
    SchemaName           = $Relacionamento
    ReferencedEntity     = $Referenciada
    ReferencingEntity    = $Tabela
    CascadeConfiguration = @{
      Assign   = 'NoCascade'
      Delete   = 'RemoveLink'
      Merge    = 'NoCascade'
      Reparent = 'NoCascade'
      Share    = 'NoCascade'
      Unshare  = 'NoCascade'
    }
    Lookup               = @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
      SchemaName    = $Schema
      DisplayName   = Rotulo $Nome
      RequiredLevel = @{ Value = 'None' }
    }
  } | Out-Null
}

# Data sem hora (não muda com o fuso do usuário)
function New-SomenteData {
  param([string] $Tabela, [string] $Schema, [string] $Nome)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'
    DisplayName      = Rotulo $Nome
    Format           = 'DateOnly'
    DateTimeBehavior = @{ Value = 'DateOnly' }
  }
}

# Texto curto com SEGURANÇA DE CAMPO (coluna protegida)
function New-TextoSeguro {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    FormatName    = @{ Value = 'Text' }
    IsSecured     = $true
  }
}

# Texto longo com SEGURANÇA DE CAMPO (quadro societário, dados bancários)
function New-TextoLongoSeguro {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [int] $Tamanho)
  New-Coluna $Tabela $Schema @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
    DisplayName   = Rotulo $Nome
    MaxLength     = $Tamanho
    Format        = 'TextArea'
    IsSecured     = $true
  }
}

# Numeração automática do Dataverse (ex.: FORN-2026-0012)
function New-Protocolo {
  param([string] $Tabela, [string] $Schema, [string] $Nome, [string] $Formato)
  New-Coluna $Tabela $Schema @{
    '@odata.type'    = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
    DisplayName      = Rotulo $Nome
    MaxLength        = 30
    FormatName       = @{ Value = 'Text' }
    AutoNumberFormat = $Formato
  }
}

# Perfil de segurança de campo com permissões em colunas protegidas
function Set-PerfilCampo {
  param([string] $NomePerfil, [string] $Descricao, [string[]] $Colunas, [int] $Atualizar = 4, [string] $Tabela = 'dgt_fornecedor')

  $perfil = Invoke-Dv -Metodo 'GET' -Caminho "fieldsecurityprofiles?`$select=fieldsecurityprofileid&`$filter=name eq '$NomePerfil'"
  if ($perfil.value.Count -gt 0) {
    $idPerfil = $perfil.value[0].fieldsecurityprofileid
    Write-Host "  = perfil '$NomePerfil' já existe"
  }
  else {
    Write-Host "  + criando perfil '$NomePerfil'..." -ForegroundColor Green
    Invoke-Dv -Metodo 'POST' -Caminho 'fieldsecurityprofiles' -Corpo @{ name = $NomePerfil; description = $Descricao } | Out-Null
    $perfil = Invoke-Dv -Metodo 'GET' -Caminho "fieldsecurityprofiles?`$select=fieldsecurityprofileid&`$filter=name eq '$NomePerfil'"
    $idPerfil = $perfil.value[0].fieldsecurityprofileid
  }

  foreach ($coluna in $Colunas) {
    $permissao = Invoke-Dv -Metodo 'GET' -Caminho "fieldpermissions?`$select=fieldpermissionid&`$filter=_fieldsecurityprofileid_value eq $idPerfil and entityname eq '$Tabela' and attributelogicalname eq '$coluna'"
    if ($permissao.value.Count -gt 0) {
      Write-Host "  = permissão de $coluna já existe"
      continue
    }
    Write-Host "  + permissão em $coluna" -ForegroundColor Green
    Invoke-Dv -Metodo 'POST' -Caminho 'fieldpermissions' -Corpo @{
      entityname                          = $Tabela
      attributelogicalname                = $coluna
      canread                             = 4
      cancreate                           = 4
      canupdate                           = $Atualizar
      'fieldsecurityprofileid@odata.bind' = "/fieldsecurityprofiles($idPerfil)"
    } | Out-Null
  }
}

# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_Fornecedor' 'Fornecedor' 'Fornecedores' 'Cadastro mestre de fornecedores (homologação e gestão — Suprimentos).'
New-Tabela 'dgt_TipoDocumentoFornecedor' 'Tipo de documento de fornecedor' 'Tipos de documento de fornecedor' 'Documento exigido do fornecedor, por categoria, com validade e visibilidade.'
New-Tabela 'dgt_FornecedorDocumento' 'Documento de fornecedor' 'Documentos de fornecedor' 'Versão de um documento do fornecedor (Vigente ou Substituído).'
New-Tabela 'dgt_FornecedorConsulta' 'Consulta de fornecedor' 'Consultas de fornecedor' 'Resultado de uma consulta externa (CNPJá, CEIS, CNEP).'
New-Tabela 'dgt_FornecedorHistorico' 'Histórico de fornecedor' 'Históricos de fornecedor' 'Alterações do cadastro do fornecedor: quem, quando e o quê.'
New-Tabela 'dgt_FornecedorHomologacao' 'Ciclo de homologação' 'Ciclos de homologação' 'Um ciclo de homologação do fornecedor (card do kanban). Concluído = somente leitura.'
New-Tabela 'dgt_FornecedorColaborador' 'Colaborador de fornecedor' 'Colaboradores de fornecedor' 'Colaborador do prestador que atua para a DGT (CPF em coluna protegida, sem contatos).'
New-Tabela 'dgt_ColaboradorDocumento' 'Documento de colaborador' 'Documentos de colaborador' 'ASO e NR aplicável do colaborador do prestador (Vigente ou Substituído).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_fornecedor (dgt_name = razão social)" -ForegroundColor Cyan
$T = 'dgt_fornecedor'
New-TextoSeguro $T 'dgt_Cnpj'                 'CNPJ' 14
New-Texto       $T 'dgt_NomeFantasia'         'Nome fantasia' 200
New-Texto       $T 'dgt_Categoria'            'Categoria' 100
New-Texto       $T 'dgt_Criticidade'          'Criticidade (A/B/C)' 5
New-Texto       $T 'dgt_Status'               'Status' 50
New-Texto       $T 'dgt_Uf'                   'UF' 2
New-Texto       $T 'dgt_Cidade'               'Cidade' 120
New-Texto       $T 'dgt_Endereco'             'Endereço' 400
New-Texto       $T 'dgt_InscricaoEstadual'    'Inscrição estadual' 30
New-Texto       $T 'dgt_InscricaoMunicipal'   'Inscrição municipal' 30
New-Texto       $T 'dgt_RegimeTributario'     'Regime tributário' 60
New-Texto       $T 'dgt_SituacaoCadastral'    'Situação cadastral (Receita)' 60
New-SomenteData $T 'dgt_DataSituacao'         'Data da situação cadastral'
New-SomenteData $T 'dgt_DataAbertura'         'Data de abertura'
New-Texto       $T 'dgt_NaturezaJuridica'     'Natureza jurídica' 200
New-Texto       $T 'dgt_Porte'                'Porte' 100
New-Texto       $T 'dgt_CnaePrincipal'        'Atividade principal (CNAE)' 300
New-Texto       $T 'dgt_ContatoComercial'     'Contato comercial' 500
New-Texto       $T 'dgt_ContatoFiscal'        'Contato fiscal / contábil' 500
New-Texto       $T 'dgt_ContatoFinanceiro'    'Contato financeiro / faturamento' 500
New-TextoLongo  $T 'dgt_Observacoes'          'Observações' 4000
New-DataHora    $T 'dgt_UltimaConsultaCnpj'   'Última consulta CNPJ'
New-DataHora    $T 'dgt_UltimaConsultaSancoes' 'Última consulta de sanções'
New-Texto       $T 'dgt_ResultadoSancoes'     'Resultado das sanções (CEIS/CNEP)' 50
New-Texto       $T 'dgt_ResponsavelNome'      'Cadastrado por' 200
New-SimNao      $T 'dgt_Ativo'                'Ativo' $true

Write-Host "`n2b) Ficha de Cadastro SUP-CPL-01 (formulário do fornecedor) e homologação" -ForegroundColor Cyan
New-Protocolo   $T 'dgt_Protocolo'            'Protocolo' 'FORN-{DATETIMEUTC:yyyy}-{SEQNUM:4}'
New-Texto       $T 'dgt_Origem'               'Origem (Portal/Formulário)' 30
New-Texto       $T 'dgt_TipoSolicitacao'      'Tipo de solicitação' 60
New-DataHora    $T 'dgt_FichaRecebidaEm'      'Ficha recebida em'
New-Texto       $T 'dgt_Cep'                  'CEP' 9
New-Texto       $T 'dgt_Telefone'             'Telefone geral' 40
New-Texto       $T 'dgt_Site'                 'Site' 200
New-Texto       $T 'dgt_EmailPedidos'         'E-mail para pedidos / NF' 200
New-Texto       $T 'dgt_PorteDeclarado'       'Porte declarado' 30
New-Texto       $T 'dgt_CategoriaFornecimento' 'Categoria de fornecimento (ficha)' 300
New-TextoLongo  $T 'dgt_DescricaoFornecimento' 'Produtos / serviços fornecidos' 4000
New-Texto       $T 'dgt_ContatoIntegridade'   'Contato integridade / compliance' 500
New-TextoLongoSeguro $T 'dgt_QuadroSocietario' 'Quadro societário (protegido)' 8000
New-Texto       $T 'dgt_FaixaFaturamento'     'Faixa de faturamento (Simples)' 100
New-Texto       $T 'dgt_AnexoSimples'         'Anexo do Simples' 200
New-Texto       $T 'dgt_PrevisaoMudancaRegime' 'Previsão de mudança de regime' 50
New-TextoLongoSeguro $T 'dgt_DadosBancarios'  'Dados bancários (protegido)' 2000
New-SimNao      $T 'dgt_BancarioConferido'    'Dados bancários conferidos' $false
New-TextoLongo  $T 'dgt_Questionario'         'Questionário de integridade (JSON)' 2000
New-TextoLongo  $T 'dgt_Certificacoes'        'Certificações' 2000
New-TextoLongo  $T 'dgt_DetalhamentoPositivas' 'Detalhamento das respostas positivas' 4000
New-TextoLongo  $T 'dgt_Declaracoes'          'Declarações (JSON)' 1000
New-Texto       $T 'dgt_ClassificacaoRisco'   'Classificação de risco' 20
New-Texto       $T 'dgt_ResultadoHomologacao' 'Resultado da homologação' 50
New-TextoLongo  $T 'dgt_Ressalvas'            'Ressalvas / mitigação / parecer' 4000
New-SomenteData $T 'dgt_ValidadeCadastro'     'Validade do cadastro / próxima revisão'
New-TextoLongo  $T 'dgt_Verificacoes'         'Verificações da homologação (JSON)' 4000
New-Texto       $T 'dgt_ResponsavelSuprimentos' 'Responsável Suprimentos / data' 200
New-Texto       $T 'dgt_ResponsavelCompliance' 'Compliance / Jurídico / data' 200
New-DataHora    $T 'dgt_UltimaConsultaCertidoes' 'Última consulta de certidões'
New-Texto       $T 'dgt_ResultadoCertidoes'   'Resultado das certidões' 50
New-SomenteData $T 'dgt_VencimentoCertidoes'  'Próximo vencimento de certidão'
New-Texto       $T 'dgt_AssinaturaStatus'     'Assinatura da ficha (Clicksign)' 50
New-Texto       $T 'dgt_AssinaturaId'         'Envelope Clicksign' 100

Write-Host "`n3) Colunas de dgt_tipodocumentofornecedor" -ForegroundColor Cyan
$T = 'dgt_tipodocumentofornecedor'
New-TextoLongo  $T 'dgt_Descricao'            'Descrição' 2000
New-Texto       $T 'dgt_Categorias'           'Categorias (separadas por ;  vazio = todas)' 500
New-SimNao      $T 'dgt_Obrigatorio'          'Obrigatório' $false
New-SimNao      $T 'dgt_ExigeValidade'        'Exige validade' $true
New-Inteiro     $T 'dgt_ValidadeDias'         'Validade padrão (dias)'
New-Texto       $T 'dgt_Visibilidade'         'Visibilidade (Interno/Externo)' 20
New-Inteiro     $T 'dgt_Ordem'                'Ordem'
New-SimNao      $T 'dgt_Ativo'                'Ativo' $true
New-Texto       $T 'dgt_CodigoConsulta'       'Consulta automática (código da certidão)' 30

Write-Host "`n4) Colunas de dgt_fornecedordocumento" -ForegroundColor Cyan
$T = 'dgt_fornecedordocumento'
New-Lookup      $T 'dgt_Fornecedor'           'Fornecedor' 'dgt_fornecedor' 'dgt_fornecedor_dgt_fornecedordocumento'
New-Lookup      $T 'dgt_TipoDocumento'        'Tipo de documento' 'dgt_tipodocumentofornecedor' 'dgt_tipodocumentofornecedor_dgt_fornecedordocumento'
New-SomenteData $T 'dgt_DataEmissao'          'Emissão'
New-SomenteData $T 'dgt_DataVencimento'       'Validade'
New-TextoLongo  $T 'dgt_ArquivoUrl'           'Endereço do arquivo' 2000
New-Texto       $T 'dgt_ArquivoNome'          'Nome do arquivo' 255
New-TextoLongo  $T 'dgt_Observacoes'          'Observações' 4000
New-Texto       $T 'dgt_Situacao'             'Situação (Vigente/Substituído)' 20
New-Texto       $T 'dgt_ResponsavelNome'      'Registrado por' 200

Write-Host "`n5) Colunas de dgt_fornecedorconsulta" -ForegroundColor Cyan
$T = 'dgt_fornecedorconsulta'
New-Lookup      $T 'dgt_Fornecedor'           'Fornecedor' 'dgt_fornecedor' 'dgt_fornecedor_dgt_fornecedorconsulta'
New-Texto       $T 'dgt_Tipo'                 'Tipo (CNPJ/CEIS/CNEP)' 20
New-Texto       $T 'dgt_Resultado'            'Resultado' 100
New-TextoLongo  $T 'dgt_Resumo'               'Resumo' 4000
New-Texto       $T 'dgt_Fonte'                'Fonte' 100
New-Texto       $T 'dgt_ExecutadoPor'         'Executada por' 200

Write-Host "`n6) Colunas de dgt_fornecedorhistorico (dgt_name = ação)" -ForegroundColor Cyan
$T = 'dgt_fornecedorhistorico'
New-Lookup      $T 'dgt_Fornecedor'           'Fornecedor' 'dgt_fornecedor' 'dgt_fornecedor_dgt_fornecedorhistorico'
New-TextoLongo  $T 'dgt_Descricao'            'Descrição' 4000
New-Texto       $T 'dgt_UsuarioNome'          'Usuário' 200

Write-Host "`n6b) Colunas de dgt_fornecedorhomologacao (dgt_name = Ciclo N — motivo)" -ForegroundColor Cyan
$T = 'dgt_fornecedorhomologacao'
New-Lookup      $T 'dgt_Fornecedor'           'Fornecedor' 'dgt_fornecedor' 'dgt_fornecedor_dgt_fornecedorhomologacao'
New-Inteiro     $T 'dgt_Numero'               'Número do ciclo'
New-Texto       $T 'dgt_Motivo'               'Motivo (cadastro inicial, renovação...)' 60
New-Texto       $T 'dgt_Etapa'                'Etapa (coluna do kanban)' 50
New-DataHora    $T 'dgt_EtapaDesde'           'Na etapa desde'
New-DataHora    $T 'dgt_ConcluidoEm'          'Concluído em'
New-Texto       $T 'dgt_Protocolo'            'Protocolo da ficha' 30
New-Texto       $T 'dgt_ClassificacaoRisco'   'Classificação de risco' 20
New-Texto       $T 'dgt_ResultadoHomologacao' 'Resultado da homologação' 50
New-TextoLongo  $T 'dgt_Ressalvas'            'Ressalvas / mitigação / parecer' 4000
New-SomenteData $T 'dgt_ValidadeCadastro'     'Validade do cadastro / próxima revisão'
New-TextoLongo  $T 'dgt_Verificacoes'         'Verificações do item 9 (JSON)' 4000
New-Texto       $T 'dgt_ResponsavelSuprimentos' 'Responsável Suprimentos / data' 200
New-Texto       $T 'dgt_ResponsavelCompliance' 'Compliance / Jurídico / data' 200
New-SimNao      $T 'dgt_BancarioConferido'    'Dados bancários conferidos (na conclusão)' $false
New-Texto       $T 'dgt_ResponsavelNome'      'Aberto por' 200

Write-Host "`n6c) Colunas de dgt_fornecedorcolaborador (dgt_name = nome)" -ForegroundColor Cyan
$T = 'dgt_fornecedorcolaborador'
New-Lookup      $T 'dgt_Fornecedor'           'Fornecedor' 'dgt_fornecedor' 'dgt_fornecedor_dgt_fornecedorcolaborador'
New-Texto       $T 'dgt_Funcao'               'Função / cargo' 120
New-TextoSeguro $T 'dgt_Cpf'                  'CPF (protegido)' 11
New-TextoLongo  $T 'dgt_Observacoes'          'Observações' 2000
New-SimNao      $T 'dgt_Ativo'                'Ativo' $true
New-Texto       $T 'dgt_ResponsavelNome'      'Cadastrado por' 200

Write-Host "`n6d) Colunas de dgt_colaboradordocumento (dgt_name = tipo)" -ForegroundColor Cyan
$T = 'dgt_colaboradordocumento'
New-Lookup      $T 'dgt_Colaborador'          'Colaborador' 'dgt_fornecedorcolaborador' 'dgt_fornecedorcolaborador_dgt_colaboradordocumento'
New-Texto       $T 'dgt_Tipo'                 'Tipo (ASO / NR aplicável)' 30
New-Texto       $T 'dgt_Norma'                'Norma aplicável (ex.: NR-10)' 120
New-SomenteData $T 'dgt_DataEmissao'          'Emissão'
New-SomenteData $T 'dgt_DataVencimento'       'Validade'
New-TextoLongo  $T 'dgt_ArquivoUrl'           'Endereço do arquivo' 2000
New-Texto       $T 'dgt_ArquivoNome'          'Nome do arquivo' 255
New-TextoLongo  $T 'dgt_Observacoes'          'Observações' 2000
New-Texto       $T 'dgt_Situacao'             'Situação (Vigente/Substituído)' 20
New-Texto       $T 'dgt_ResponsavelNome'      'Registrado por' 200

# ------------------------------------------------------------
# 7) Publicação
# ------------------------------------------------------------

Write-Host "`n7) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_fornecedor</entity><entity>dgt_tipodocumentofornecedor</entity><entity>dgt_fornecedordocumento</entity><entity>dgt_fornecedorconsulta</entity><entity>dgt_fornecedorhistorico</entity><entity>dgt_fornecedorhomologacao</entity><entity>dgt_fornecedorcolaborador</entity><entity>dgt_colaboradordocumento</entity></entities></importexportxml>'
} | Out-Null

# ------------------------------------------------------------
# 8) Perfil de segurança de campo do CNPJ
# ------------------------------------------------------------

Write-Host "`n8) Perfil de segurança de campo 'DGT - Fornecedores - CNPJ'" -ForegroundColor Cyan

$NomePerfil = 'DGT - Fornecedores - CNPJ'
$perfil = Invoke-Dv -Metodo 'GET' -Caminho "fieldsecurityprofiles?`$select=fieldsecurityprofileid&`$filter=name eq '$NomePerfil'"

if ($perfil.value.Count -gt 0) {
  $idPerfil = $perfil.value[0].fieldsecurityprofileid
  Write-Host "  = perfil já existe"
}
else {
  Write-Host "  + criando perfil..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'fieldsecurityprofiles' -Corpo @{
    name        = $NomePerfil
    description = 'Ler e informar (no cadastro) o CNPJ do fornecedor. Não permite alterar o CNPJ depois.'
  } | Out-Null
  $perfil = Invoke-Dv -Metodo 'GET' -Caminho "fieldsecurityprofiles?`$select=fieldsecurityprofileid&`$filter=name eq '$NomePerfil'"
  $idPerfil = $perfil.value[0].fieldsecurityprofileid
}

$permissao = Invoke-Dv -Metodo 'GET' -Caminho "fieldpermissions?`$select=fieldpermissionid&`$filter=_fieldsecurityprofileid_value eq $idPerfil and entityname eq 'dgt_fornecedor' and attributelogicalname eq 'dgt_cnpj'"

if ($permissao.value.Count -gt 0) {
  Write-Host "  = permissão da coluna dgt_cnpj já existe"
}
else {
  Write-Host "  + permissão: Ler = Sim, Criar = Sim, Atualizar = Não" -ForegroundColor Green
  # 4 = permitido, 0 = não permitido
  Invoke-Dv -Metodo 'POST' -Caminho 'fieldpermissions' -Corpo @{
    entityname                       = 'dgt_fornecedor'
    attributelogicalname             = 'dgt_cnpj'
    canread                          = 4
    cancreate                        = 4
    canupdate                        = 0
    'fieldsecurityprofileid@odata.bind' = "/fieldsecurityprofiles($idPerfil)"
  } | Out-Null
}

# ------------------------------------------------------------
# 8b) Perfis da ficha: quadro societário (com CPF) e dados bancários
# ------------------------------------------------------------

Write-Host "`n8b) Perfis de segurança de campo da ficha" -ForegroundColor Cyan

Set-PerfilCampo 'DGT - Fornecedores - Quadro societário' `
  'Ler e corrigir o quadro societário da ficha (nomes, CPF e participação). Somente Suprimentos / Compliance.' `
  @('dgt_quadrosocietario')

Set-PerfilCampo 'DGT - Fornecedores - Dados bancários' `
  'Ler e corrigir os dados bancários da ficha. Somente Suprimentos / Financeiro.' `
  @('dgt_dadosbancarios')

# Mesmo padrão do quadro societário, em perfil próprio: quem cuida dos
# colaboradores em campo (ex.: SESMT) não precisa ver os sócios.
Set-PerfilCampo 'DGT - Fornecedores - CPF de colaboradores' `
  'Ler, informar e corrigir o CPF dos colaboradores dos prestadores. Somente Suprimentos / SESMT.' `
  @('dgt_cpf') -Tabela 'dgt_fornecedorcolaborador'

# ------------------------------------------------------------
# 9) Custom API dgt_ConsultarFornecedor (o plugin entra pelo PASSO)
# ------------------------------------------------------------

Write-Host "`n9) Custom API dgt_ConsultarFornecedor" -ForegroundColor Cyan

$existe = Invoke-Dv -Metodo 'GET' -Caminho "customapis?`$select=customapiid&`$filter=uniquename eq 'dgt_ConsultarFornecedor'"

if ($existe.value.Count -gt 0) {
  Write-Host "  = já existe"
}
else {
  $privilegio = $null
  $candidatos = Invoke-Dv -Metodo 'GET' -Caminho "privileges?`$select=name&`$filter=startswith(name,'prvWritedgt_')"
  foreach ($item in $candidatos.value) {
    if ($item.name.ToLower() -eq 'prvwritedgt_fornecedor') { $privilegio = $item.name }
  }

  # Sem PluginTypeId: as chaves ficam na Configuração segura de um
  # PASSO (PostOperation, síncrono), como em dgt_CriarTarefaClickUp.
  $corpo = @{
    uniquename                      = 'dgt_ConsultarFornecedor'
    name                            = 'dgt_ConsultarFornecedor'
    displayname                     = 'Consultar fornecedor (CNPJá, CEIS, CNEP)'
    description                     = 'Consulta prévia do CNPJ, consulta CNPJá e sanções CEIS/CNEP de um fornecedor, ou lote para a reconsulta periódica (plugin ConsultarFornecedorPlugin).'
    bindingtype                     = 0
    isfunction                      = $false
    isprivate                       = $false
    allowedcustomprocessingsteptype = 2
    CustomAPIRequestParameters      = @(
      @{ uniquename = 'PayloadJson'; name = 'PayloadJson'; displayname = 'PayloadJson'; description = 'Entrada (JSON).'; type = 10; isoptional = $false }
    )
    CustomAPIResponseProperties     = @(
      @{ uniquename = 'ResultadoJson'; name = 'ResultadoJson'; displayname = 'ResultadoJson'; description = 'Resultado (JSON).'; type = 10 }
    )
  }

  if ($privilegio) {
    $corpo.executeprivilegename = $privilegio
    Write-Host "  · exige o privilégio $privilegio"
  }
  else {
    Write-Host "  ! privilégio prvWritedgt_fornecedor não encontrado; a API será criada sem essa restrição." -ForegroundColor Yellow
  }

  Write-Host "  + criando Custom API..." -ForegroundColor Green
  Invoke-Dv -Metodo 'POST' -Caminho 'customapis' -Corpo $corpo | Out-Null
}

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Funções de segurança (somente quem usa o módulo Fornecedores):'
Write-Host '       dgt_fornecedor, dgt_tipodocumentofornecedor, dgt_fornecedordocumento,'
Write-Host '       dgt_fornecedorconsulta, dgt_fornecedorhistorico, dgt_fornecedorhomologacao,'
Write-Host '       dgt_fornecedorcolaborador, dgt_colaboradordocumento'
Write-Host '       -> Criar, Ler, Gravar (Organização). NÃO conceda Excluir (a tela só desativa).'
Write-Host '       dgt_fornecedorconsulta e dgt_fornecedorhistorico: Ler basta para quem só consulta.'
Write-Host "  2. Perfis de segurança de campo: '$NomePerfil' (Suprimentos),"
Write-Host "     'DGT - Fornecedores - Quadro societário' (Suprimentos/Compliance) e"
Write-Host "     'DGT - Fornecedores - Dados bancários' (Suprimentos/Financeiro) e"
Write-Host "     'DGT - Fornecedores - CPF de colaboradores' (Suprimentos/SESMT)."
Write-Host '  3. Plugin: compile, atualize o assembly e registre o PASSO do ConsultarFornecedorPlugin'
Write-Host '     (Message dgt_ConsultarFornecedor · PostOperation · Síncrono) com a Configuração segura:'
Write-Host '       { "cnpja": "<chave>", "transparencia": "<chave>", "infosimples": "<token>" }'
Write-Host '  4. SharePoint: permissão de EDIÇÃO na biblioteca "Documentos de Fornecedores" para Suprimentos.'
