<#
.SYNOPSIS
  Cria no Dataverse as tabelas da aba "Fabricantes e terceiros" de
  RH e Pessoas (planilha CONTROLE DE CERTIFICAÇÕES):
    dgt_terceiro                Pessoas SEM acesso ao portal (terceiros)
    dgt_fabricante              Fabricantes e o contato comercial/técnico
    dgt_certificacaofabricante  Certificações de fabricante e registros
                                profissionais (CREA/CFT) de colaboradores
                                ou terceiros
    dgt_declaracaofabricante    Declarações/cartas emitidas pelos fabricantes

.DESCRIPTION
  Pode ser executado mais de uma vez: o que já existe é mantido e só o
  que falta é criado. Tudo é criado dentro da solução informada.

  Os nomes DEVEM ser iguais aos de
  src/webparts/portalTreinamentosWebPart/services/RhFabricantesService.ts

  LGPD: não há colunas de CPF, CNPJ, senha nem dados bancários, e a tela
  bloqueia esses dados nos campos digitados. Nada é apagado pela tela:
  "Remover" apenas define dgt_ativo = Não.

.EXAMPLE
  .\scripts\dataverse\criar-tabelas-fabricantes-terceiros.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_EXCLUSIVO
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

# ------------------------------------------------------------
# 1) Tabelas
# ------------------------------------------------------------

Write-Host "`n1) Tabelas" -ForegroundColor Cyan

New-Tabela 'dgt_Terceiro' 'Terceiro' 'Terceiros' 'Pessoa sem acesso ao portal (prestador, parceiro) com certificações controladas pelo RH.'
New-Tabela 'dgt_Fabricante' 'Fabricante' 'Fabricantes' 'Fabricante com quem a DGT mantém certificações e declarações, e o contato no fabricante.'
New-Tabela 'dgt_CertificacaoFabricante' 'Certificação de fabricante' 'Certificações de fabricante' 'Certificação de fabricante ou registro profissional (CREA/CFT) de um colaborador ou terceiro.'
New-Tabela 'dgt_DeclaracaoFabricante' 'Declaração de fabricante' 'Declarações de fabricante' 'Declaração ou carta emitida por um fabricante (parceria, revenda, credenciamento...).'

# ------------------------------------------------------------
# 2) Colunas
# ------------------------------------------------------------

Write-Host "`n2) Colunas de dgt_terceiro" -ForegroundColor Cyan
$T = 'dgt_terceiro'
New-Texto       $T 'dgt_Empresa'          'Empresa' 200
New-Texto       $T 'dgt_Area'             'Área de atuação' 100
New-Texto       $T 'dgt_Funcao'           'Função / cargo' 200
New-Texto       $T 'dgt_Email'            'E-mail' 200
New-Texto       $T 'dgt_Telefone'         'Telefone' 50
New-TextoLongo  $T 'dgt_Observacoes'      'Observações' 4000
New-Texto       $T 'dgt_ResponsavelNome'  'Cadastrado por' 200
New-SimNao      $T 'dgt_Ativo'            'Ativo' $true

Write-Host "`n3) Colunas de dgt_fabricante" -ForegroundColor Cyan
$T = 'dgt_fabricante'
New-Texto       $T 'dgt_ContatoNome'      'Contato no fabricante' 200
New-Texto       $T 'dgt_ContatoTelefone'  'Telefone do contato' 100
New-Texto       $T 'dgt_ContatoEmail'     'E-mail do contato' 300
New-Texto       $T 'dgt_Site'             'Site / portal de parceiros' 300
New-TextoLongo  $T 'dgt_Observacoes'      'Observações' 4000
New-SimNao      $T 'dgt_Ativo'            'Ativo' $true

Write-Host "`n4) Colunas de dgt_certificacaofabricante" -ForegroundColor Cyan
$T = 'dgt_certificacaofabricante'
New-Lookup      $T 'dgt_Usuario'          'Colaborador' 'dgt_usuario' 'dgt_usuario_dgt_certificacaofabricante'
New-Lookup      $T 'dgt_Terceiro'         'Terceiro' 'dgt_terceiro' 'dgt_terceiro_dgt_certificacaofabricante'
New-Texto       $T 'dgt_PessoaNome'       'Pessoa (nome)' 200
New-Texto       $T 'dgt_Categoria'        'Categoria' 100
New-Texto       $T 'dgt_Emissor'          'Fabricante / órgão' 200
New-Texto       $T 'dgt_Criticidade'      'Criticidade' 20
New-Texto       $T 'dgt_Area'             'Área' 100
New-Texto       $T 'dgt_StatusManual'     'Status informado' 50
New-SomenteData $T 'dgt_DataEmissao'      'Emissão'
New-SomenteData $T 'dgt_DataVencimento'   'Vencimento'
New-Texto       $T 'dgt_NumeroRegistro'   'Nº do certificado / registro' 100
New-TextoLongo  $T 'dgt_Observacoes'      'Observações' 4000
New-TextoLongo  $T 'dgt_ArquivoUrl'       'Endereço do documento' 2000
New-Texto       $T 'dgt_ArquivoNome'      'Nome do arquivo' 255
New-Texto       $T 'dgt_ResponsavelNome'  'Registrado por' 200
New-SimNao      $T 'dgt_Ativo'            'Ativo' $true

Write-Host "`n5) Colunas de dgt_declaracaofabricante" -ForegroundColor Cyan
$T = 'dgt_declaracaofabricante'
New-Texto       $T 'dgt_Fabricante'       'Fabricante' 200
New-Texto       $T 'dgt_Tipo'             'Tipo de declaração' 100
New-SomenteData $T 'dgt_DataEmissao'      'Emissão'
New-SomenteData $T 'dgt_DataVencimento'   'Vencimento'
New-TextoLongo  $T 'dgt_Observacoes'      'Observações' 4000
New-TextoLongo  $T 'dgt_ArquivoUrl'       'Endereço do documento' 2000
New-Texto       $T 'dgt_ArquivoNome'      'Nome do arquivo' 255
New-Texto       $T 'dgt_ResponsavelNome'  'Registrado por' 200
New-SimNao      $T 'dgt_Ativo'            'Ativo' $true

# ------------------------------------------------------------
# 6) Publicação
# ------------------------------------------------------------

Write-Host "`n6) Publicando..." -ForegroundColor Cyan

Invoke-Dv -Metodo 'POST' -Caminho 'PublishXml' -Corpo @{
  ParameterXml = '<importexportxml><entities><entity>dgt_terceiro</entity><entity>dgt_fabricante</entity><entity>dgt_certificacaofabricante</entity><entity>dgt_declaracaofabricante</entity></entities></importexportxml>'
} | Out-Null

Write-Host "`nConcluído." -ForegroundColor Green
Write-Host 'Próximos passos:' -ForegroundColor Green
Write-Host '  1. Perfis de segurança (somente quem usa RH e Pessoas):'
Write-Host '       dgt_terceiro, dgt_fabricante, dgt_certificacaofabricante, dgt_declaracaofabricante'
Write-Host '       -> Criar, Ler, Gravar (Organização). NÃO conceda Excluir (a tela só desativa).'
Write-Host '  2. SharePoint: permissão de EDIÇÃO na biblioteca Certificados para o RH'
Write-Host '     (documentos em Certificados/Fabricantes/... e Certificados/Declaracoes/...).'
