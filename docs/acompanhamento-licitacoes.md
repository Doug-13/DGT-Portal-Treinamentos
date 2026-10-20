# Licitações — acompanhamento de editais

Linha do tempo das alterações de cada edital acompanhado: situação, datas,
valor estimado, objeto, documentos publicados/retirados e situação dos itens.

## Como funciona

| Fase | Quando atualiza | O que fica gravado |
|---|---|---|
| **1** (sempre) | quando o edital aparece numa busca ou é aberto no Pré-visualizar | a "foto" do edital e as alterações — **sem CNPJ** |
| **2** (com a chave no plugin) | todo dia, pelo fluxo do Power Automate (e no botão "Verificar agora") | + o identificador do PNCP **criptografado** |

- **☆ Acompanhar** no cartão do edital; o parecer **Participar** acompanha sozinho.
- Aba **Acompanhamento**: lista dos editais (com novidades não lidas) e a linha do tempo,
  com o valor anterior riscado e o novo destacado.

## Proteção do identificador (fase 2)

O identificador do PNCP contém o CNPJ do órgão. Ele:

1. vai do navegador ao plugin por HTTPS (Custom API `dgt_AcompanharLicitacao`);
2. é criptografado no servidor com **AES-256 + HMAC-SHA256** (IV aleatório, verificação de integridade);
3. fica na coluna `dgt_identificadorcripto`, com **segurança de campo** (não aparece para usuários,
   relatórios, exportações nem Power BI);
4. só é descriptografado **em memória**, dentro do plugin, para consultar o PNCP;
5. **nunca** volta ao navegador e **nunca** é escrito no rastreamento do plugin;
6. é **apagado** quando o edital deixa de ser acompanhado.

A chave fica **somente** na Configuração segura dos passos do plugin.

## Ativar a fase 2

### 1. Gerar a chave (sem exibi-la na tela)

```powershell
$b = New-Object byte[] 64
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b) | Set-Clipboard
```

A chave vai para a área de transferência. Guarde uma cópia num **cofre de senhas** da DGT:
sem ela, os identificadores gravados não podem ser lidos (seria preciso acompanhar de novo).

### 2. Plugin Registration Tool

1. Compilar `server/DGT.Treinamentos.Plugins` e dar **Update** no assembly.
2. No plugin **AcompanhamentoLicitacaoPlugin**, registrar **dois passos**:

| Message | Stage | Mode | Secure Configuration |
|---|---|---|---|
| `dgt_AcompanharLicitacao` | PostOperation | Synchronous | a chave (Ctrl+V) |
| `dgt_AtualizarAcompanhamentos` | PostOperation | Synchronous | **a mesma** chave |

Primary Entity vazio e **"Delete AsyncOperation…" desmarcado**.

### 3. Fluxo diário (Power Automate)

1. **Recorrência**: diariamente, 07:00 (fuso de Brasília).
2. **Microsoft Dataverse → Executar uma ação não associada**: `dgt_AtualizarAcompanhamentos`,
   `PayloadJson` = `{}`.
3. **Listar linhas** em *Alterações de licitações* com o filtro
   `dgt_origem eq 'automatica' and createdon ge @{formatDateTime(utcNow(),'yyyy-MM-dd')}`.
4. **Condição**: se houver linhas → **Criar tabela HTML** (Descrição, Valor anterior, Valor novo)
   → **Enviar e-mail** / **Publicar mensagem no Teams** para a equipe de licitações.

A conta da conexão do fluxo precisa de Ler/Gravar em *Acompanhamentos* e Criar em *Alterações*.

Cada execução verifica até onde cabe no limite de tempo do Dataverse (~95 s); o que sobrar entra
primeiro na rodada seguinte. Para muitos editais, rode o fluxo 2–3 vezes ao dia.

## Tarefa no ClickUp ao "Participar"

Ao registrar o parecer **Participar**, o portal acompanha o edital e cria **uma** tarefa
no ClickUp (nunca duplica), na coluna **ANÁLISE** da lista **Licitações**:

- **Nome:** `Edital de {Município} — Nº {número}`
- **Prazo:** encerramento das propostas · **Início:** dia do parecer
- **Prioridade:** até 3 dias = urgente; até 7 = alta; demais = normal
- **Etiquetas:** `licitação`, modalidade (ex.: `pregão eletrônico`) e UF (ex.: `rs`)
- **Descrição:** destaque do prazo; tabela-resumo (órgão, unidade compradora, município/UF,
  esfera, modalidade, modo de disputa, SRP, número, processo, valor, datas, situação, amparo
  legal, aderência); objeto e informação complementar; **onde participar** (plataforma da
  disputa); **itens** (até 15, com quantidade e valor); **documentos publicados**; parecer da
  DGT; análise da IA (sugestão e compatibilidade); link para o portal
- **Checklist "Etapas da participação":** ler edital/TR, habilitação, visita técnica/amostras,
  custos e proposta, cadastro na plataforma, enviar proposta até o prazo, acompanhar a sessão
- **Campos personalizados** (opcional): preenchidos se mapeados na configuração

Sem CNPJ e sem o link do PNCP (que contém o CNPJ): o link da tarefa leva ao portal.

### Ativar

1. `scripts/dataverse/criar-integracao-clickup-licitacoes.ps1` (colunas + Custom API).
2. Compilar o plugin e dar **Update** no assembly.
3. Registrar o passo do **CriarTarefaClickUpPlugin**:

| Campo | Valor |
|---|---|
| Message | `dgt_CriarTarefaClickUp` |
| Stage / Mode | PostOperation · Synchronous (Delete AsyncOperation desmarcado) |
| Secure Configuration | o token pessoal do ClickUp (`pk_...`) |
| Unsecure Configuration | ver o exemplo abaixo |

```json
{
  "listId": "<id da lista Licitações>",
  "status": "análise",
  "tags": ["licitação"],
  "campos": {
    "orgao": "<id do campo Órgão>",
    "valorEstimado": "<id do campo Valor (moeda)>",
    "encerramento": "<id do campo Encerramento (data)>",
    "compatibilidade": "<id do campo Compatibilidade (número)>"
  }
}
```

`campos` é opcional. Chaves aceitas: `orgao`, `municipio`, `uf`, `modalidade`, `numero`,
`valorEstimado` (moeda/número), `abertura` e `encerramento` (data), `compatibilidade` e
`aderencia` (número), `plataforma`, `linkPortal` (texto/URL). O id de cada campo aparece em
ClickUp → lista → **Campos personalizados** → "…" do campo → **Copiar ID**.

Editais acompanhados antes da integração: botão **+ Criar tarefa no ClickUp** na aba
Acompanhamento.

## Texto para o "de acordo" da governança

> Para acompanhar editais de licitação no PNCP, o portal precisa guardar o número de controle
> do edital, que inclui o CNPJ do órgão público contratante (dado público, de pessoa jurídica,
> não abrangido pela LGPD). Esse número é gravado apenas para os editais que a DGT escolhe
> acompanhar, criptografado com AES-256 e verificação de integridade, numa coluna com
> segurança de campo, e só é lido em memória pelo servidor para consultar o PNCP. Ele não é
> exibido em telas, relatórios ou exportações e é apagado quando o acompanhamento termina.
> A chave de criptografia fica restrita aos administradores do sistema.
