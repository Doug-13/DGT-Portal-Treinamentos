# Fornecedores — homologação e gestão (fase 1, uso interno)

Módulo para Suprimentos: cadastro mestre de fornecedores, documentos com
validade, consultas automáticas (Receita via CNPJá, CEIS e CNEP via Portal da
Transparência, certidões via Infosimples), Ficha de Cadastro SUP-CPL-01 recebida
pelo Microsoft Forms e homologação (item 9). Base: escopo "Plataforma de
Homologação e Gestão de Fornecedores" (minuta 1.0, 06/11/2026) e Ficha de
Cadastro de Fornecedor SUP-CPL-01 v1.0 (11/11/2026).

**Fluxo de homologação (Suprimentos + Jurídico):**

1. O fornecedor responde o **Forms** (itens 1 a 6 e 8 da ficha) → o Power Automate
   chama `receberFicha` → cadastro em **Em homologação** com protocolo
   `FORN-AAAA-NNNN`.
2. O fluxo responde ao fornecedor com o protocolo e a lista de documentos que ele
   precisa mandar por e-mail para **vaneska@dgt.com.br** (o Forms não aceita anexo
   de quem é externo). Ver seção 8.
3. A analista revisa (aba **Ficha**) e roda as consultas (aba **Consultas**:
   Receita, sanções e certidões).
4. Ficha consolidada assinada pelo fornecedor (Clicksign — próximo passo, ver seção 9).
5. Jurídico aprova; o resultado é gravado na aba **Homologação** → status
   **Homologado** (ou **Reprovado**).
6. Começa a coleta dos documentos dos colaboradores do prestador. O contrato só sai
   quando uma demanda fechar (Jurídico + Vaneska + comprador + prestador).

**Fora desta fase:** portal do fornecedor (acesso externo), kanban com aprovações
por alçada, IQF, integração com o CIGAM, documentos por colaborador terceirizado
(ASO, NRs — aguardam validação do encarregado de dados) e consulta automática do TCU.

Ordem de implantação: **1. aprovação do CNPJ → 2. tabelas → 3. permissões →
4. plugin → 5. tela → 6. fluxos (opcional)**.

---

## 1. Exceção de LGPD para o CNPJ

O portal não grava CNPJ (README, seção 8). Aqui o CNPJ da **empresa** fornecedora
é o identificador do cadastro e das consultas, então ele é a única exceção:

- fica **só** em `dgt_fornecedor.dgt_cnpj`, com **segurança de campo**;
- perfil `DGT - Fornecedores - CNPJ`: Ler = Sim, Criar = Sim, **Atualizar = Não**
  (o CNPJ não muda depois do cadastro; se estiver errado, desative e cadastre de novo);
- quem não está no perfil vê a coluna vazia;
- observações, contatos e textos dos documentos continuam bloqueando CPF/CNPJ.

Aprovar com TI / encarregado de dados **antes** de rodar o script (ele exige
`-ConfirmoAprovacaoCnpj`).

**Ficha SUP-CPL-01 — sócios (com CPF) e dados bancários.** Por decisão de
Suprimentos, a ficha coleta esses dados. Eles ficam **só** em duas colunas
protegidas, cada uma com seu perfil de segurança de campo:

| Coluna | Perfil | Para quem |
|---|---|---|
| `dgt_quadrosocietario` (JSON: nome, cargo, CPF, %, outras sociedades, grupo) | `DGT - Fornecedores - Quadro societário` | Suprimentos / Compliance |
| `dgt_dadosbancarios` (JSON: banco, agência, conta, Pix, titular, CNPJ do titular) | `DGT - Fornecedores - Dados bancários` | Suprimentos / Financeiro |

- Quem não está no perfil vê "protegido"; quem está vê CPF e conta **mascarados**
  até clicar em Mostrar.
- O histórico registra só que houve alteração, nunca os valores. O plugin não
  manda esses dados para o rastreamento.
- Alteração bancária volta para "confirmação telefônica pendente" (ficha, item 5).
- Registrar a base legal e o prazo de retenção com o encarregado de dados.

## 2. Tabelas

```powershell
.\scripts\dataverse\criar-tabelas-fornecedores.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_DA_SOLUCAO -ConfirmoAprovacaoCnpj
```

| Tabela | Para que serve |
|---|---|
| `dgt_fornecedor` | Cadastro mestre (`dgt_name` = razão social), status, categoria, contatos, dados da Receita, última consulta e resultado das sanções |
| `dgt_tipodocumentofornecedor` | Documentos exigidos por categoria, obrigatoriedade, validade padrão e visibilidade (Interno / Externo) |
| `dgt_fornecedordocumento` | Cada versão de documento (Vigente / Substituído), emissão, validade e link do arquivo |
| `dgt_fornecedorconsulta` | Uma linha por consulta externa (CNPJ, CEIS, CNEP), com resultado e resumo |
| `dgt_fornecedorhistorico` | Alterações do cadastro: ação, descrição, usuário |

Nada é apagado pela tela. O script também cria o perfil de segurança de campo e a
Custom API `dgt_ConsultarFornecedor` (exige `prvWritedgt_fornecedor`).

## 3. Permissões

- Função de segurança de Suprimentos: Criar / Ler / Gravar (Organização) nas 5
  tabelas, **sem Excluir**.
- Pessoas (ou equipe) de Suprimentos no perfil de campo `DGT - Fornecedores - CNPJ`.
- Usuários e acessos: liberar o módulo **Fornecedores**; quem aprova homologação
  recebe "Administrador do módulo" (status Homologado, Suspenso, Bloqueado e
  Descredenciado e a aba Tipos de documento).
- SharePoint: edição na biblioteca **Documentos de Fornecedores** (ver item 5).

## 4. Plugin `ConsultarFornecedorPlugin`

1. `dotnet build -c Release` e atualizar o assembly.
2. Registrar o **passo** (como o do ClickUp):
   - Message `dgt_ConsultarFornecedor` · Primary Entity none · PostOperation · Síncrono
   - **Configuração segura** (só aqui ficam as chaves):
     `{ "cnpja": "<chave do CNPJá>", "transparencia": "<chave da API de dados>", "infosimples": "<token da Infosimples>" }`
   - Configuração não segura (opcional):
     `{ "cnpjaParametros": "maxAge=30", "diasEntreConsultas": 14, "limiteLote": 20, "infosimplesTimeout": 90, "diasRenovacaoCertidoes": 15, "rotasEstaduais": {}, "rotasMunicipais": {} }`

### Onde colocar o token da Infosimples

Plugin Registration Tool → assembly `DGT.Treinamentos.Plugins` →
`ConsultarFornecedorPlugin` → passo **dgt_ConsultarFornecedor** → *Update* →
campo **Secure Configuration**. Acrescente a chave `infosimples` ao JSON que já
tem as outras (o JSON é um só):

```json
{ "cnpja": "…", "transparencia": "…", "infosimples": "COLE_AQUI_O_TOKEN" }
```

O token **não** vai no código, no portal, no Power Automate nem em e-mail/chat.
A Configuração segura só é lida pelo plugin; o token vai no corpo da requisição
(nunca na URL) e não aparece no rastreamento. Para trocar o token, edite o mesmo
campo. Sem o token, as certidões aparecem como "Não configurada" e o resto funciona.

### Certidões (Infosimples)

| Código | Certidão | Rota da Infosimples |
|---|---|---|
| `cnd_federal` | CND Federal (Receita/PGFN) | `receita-federal/pgfn` (com `preferencia_emissao=2via`) |
| `fgts` | CRF do FGTS (Caixa) | `caixa/regularidade` |
| `cndt` | CNDT (TST) | `tst/cndt` |
| `cnd_estadual` | CND Estadual | configurável por UF (`rotasEstaduais`) |
| `cnd_municipal` | CND Municipal | configurável por município (`rotasMunicipais`) |

- Certidão **regular** (negativa ou positiva com efeito de negativa) entra sozinha
  em **Documentos**, no tipo ligado à certidão (Tipos de documento › *Consulta
  automática*), com emissão, validade e o link do comprovante; a versão anterior
  vira Substituída. **Irregular** vai para a aba Consultas e para o histórico.
  "Verificar" = a fonte não deixou claro: abra o comprovante.
- Em **Tipos de documento**, clique em **Criar sugestões**: liga as certidões aos
  tipos que já existem (mesmo nome) e cria os que faltam da ficha (item 7).
- Estadual e municipal: as rotas variam por UF/prefeitura. Pegue o caminho no
  catálogo contratado da Infosimples (o trecho depois de `/api/v2/consultas/`) e
  configure, por exemplo:
  `"rotasEstaduais": { "SC": "<rota da SEFAZ/SC>?inscricao_estadual={ie}" }` e
  `"rotasMunicipais": { "SC/Florianópolis": "<rota da prefeitura>" }`.
  `{cnpj}`, `{ie}` e `{im}` são trocados pelos dados do cadastro. Sem rota:
  "Sem cobertura" (emissão manual e registro em Documentos).
- **Tempo:** cada certidão pode levar até ~1 min na fonte e o Dataverse encerra o
  plugin em 2 min. Por isso a tela pede **uma certidão por chamada**; o que não
  couber no tempo volta como "pulada".
- **Comprovante:** o link gravado é o da Infosimples. Confirme no painel da
  Infosimples por quanto tempo o comprovante fica disponível; se for curto, baixe
  e registre o PDF no SharePoint (Renovar → arquivo).
- **Custo:** cada certidão emitida é cobrada pela Infosimples. O lote só pede as
  que faltam ou vencem em até `diasRenovacaoCertidoes` dias.

Ações (`PayloadJson`):

| Ação | Payload | O que faz |
|---|---|---|
| `previa` | `{ "acao": "previa", "cnpj": "..." }` | Confere duplicidade e devolve os dados da Receita. Não grava. |
| `consultar` | `{ "acao": "consultar", "fornecedorId": "...", "consultas": ["cnpj","sancoes"] }` | Consulta e grava em `dgt_fornecedorconsulta` e no fornecedor |
| `lote` | `{ "acao": "lote", "consultas": ["sancoes"], "limite": 20 }` | Fornecedores ativos sem consulta há mais de `diasEntreConsultas` dias |
| `consultar` (certidão) | `{ "acao": "consultar", "fornecedorId": "...", "consultas": ["cnd_federal"] }` | Emite a certidão e registra o documento se regular (`"certidoes"` = as cinco) |
| `lote` (certidões) | `{ "acao": "lote", "consultas": ["certidoes"], "limite": 20 }` | Renova as que faltam ou vencem logo; para quando o tempo acaba (`haMais`) |
| `receberFicha` | `{ "acao": "receberFicha", "ficha": { … } }` | Resposta do Forms (seção 8). Devolve `id`, `protocolo`, `novo`, `documentosPendentes` |

Do CNPJá só entram dados da **empresa** (sem sócios, telefones e e-mails).
A ação `sancoes` consulta **CEIS, CNEP, CEPIM e acordos de leniência** (mesma
chave). O resultado de sanções é "Com registro" apenas com sanção **vigente** no
CEIS/CNEP ou com a entidade no CEPIM (estar no CEPIM já é o impedimento);
sanções encerradas aparecem no resumo. **Leniência é informativa**: o acordo
aparece na aba Consultas, mas não muda o resultado de sanções.

**Testar primeiro** com um fornecedor de teste: o Portal da Transparência pode
bloquear chamadas automatizadas (verificação de segurança do site). O plugin
responde com mensagem clara nesse caso, mas o teste confirma se o servidor do
Dataverse passa.

## 5. Documentos (SharePoint)

`CONFIG_DOCUMENTOS_FORNECEDORES` em `services/fornecedores/FornecedoresService.ts`:
site **Suprimentos**, pasta `Documentos > General > 03. CONTRATOS > Contratos >
Contratos Fornecedores` (caminho server-relative em `pasta`). A pasta precisa
existir: o portal não cria biblioteca nem pasta fora dela, só a subpasta de cada
fornecedor dentro dela.

O envio usa a **permissão de quem anexa**: Suprimentos/compradores precisam de
**Editar** nessa pasta; quem só consulta, de **Ler**. Sem permissão, a tela
avisa e aceita o **link** do arquivo. As certidões automáticas (Infosimples) não
passam pelo SharePoint: guardam o link do comprovante.

Pasta por fornecedor: `Razão social (8 primeiros caracteres do id)` — sem CNPJ
no nome da pasta.

## 6. Fluxos do Power Automate (opcionais, montados por você)

**Reconsulta quinzenal de sanções** — Agendado (diário, 06h):
1. Dataverse › *Executar uma ação não associada* `dgt_ConsultarFornecedor`,
   `PayloadJson` = `{"acao":"lote","consultas":["sancoes"],"limite":20}`.
2. *Fazer até* `haMais` = false (máx. 10 voltas), repetindo o passo 1.
3. Se `comRegistro` > 0: e-mail para Suprimentos com o link do módulo.

Como o plugin só pega quem está há mais de 14 dias sem consulta, rodar todo dia
espalha a carga e cada fornecedor é consultado a cada ~2 semanas.

**Renovação de certidões** — Agendado (diário, 05h):
1. *Executar uma ação não associada* `dgt_ConsultarFornecedor`,
   `PayloadJson` = `{"acao":"lote","consultas":["certidoes"],"limite":20}`.
2. *Fazer até* `haMais` = false (máx. 15 voltas). Cada volta dura até ~2 min.
3. Se `irregulares` > 0: e-mail para Suprimentos.

**Alertas de vencimento (30/15/5 dias)** — Agendado (diário):
1. Dataverse › *Listar linhas* `dgt_fornecedordocumentos`, filtro:
   `dgt_situacao eq 'Vigente' and (dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),30),'yyyy-MM-dd')} or dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),15),'yyyy-MM-dd')} or dgt_datavencimento eq @{formatDateTime(addDays(utcNow(),5),'yyyy-MM-dd')})`,
   expandir `dgt_Fornecedor($select=dgt_name)`.
2. Se houver linhas: e-mail/Teams para Suprimentos com fornecedor, documento e validade.

## 7. Regras da tela

- Pendência = obrigatório faltando, vencido ou vencendo em até 30 dias. A
  suspensão automática (RF-24) ainda não existe: depende de Suprimentos definir
  quais documentos suspendem.
- Documento novo do mesmo tipo marca o anterior como **Substituído**.
- CNPJ alfanumérico (Receita, a partir de 07/2026) já é aceito.
- Tipos sugeridos (botão "Criar sugestões") vêm da Ficha SUP-CPL-01, item 7.
  As certidões já vêm ligadas à consulta automática.
- Status **Reprovado** (novo) e os demais restritos só o administrador do módulo
  define. Na aba Homologação, "Aprovado" e "Aprovado com ressalvas" levam o
  cadastro de "Em homologação" para **Homologado**; "Reprovado" leva para
  **Reprovado**. Aprovar exige classificação de risco e validade do cadastro;
  "com ressalvas" e "Reprovado" exigem o texto das ressalvas/parecer.
- Checklist do item 9: o sistema **sugere** (Receita, certidões, sanções, 6.5,
  questionário, titular da conta = CNPJ); quem marca OK é a pessoa responsável.
- Questionário: "Sim" é destacado nas perguntas de risco e "Não" em 6.8
  (programa de integridade) e 6.9 (LGPD). Nada reprova automaticamente.

## 8. Ficha pelo Microsoft Forms + documentos por e-mail (opção A)

O Forms coleta os dados; os **anexos** não (Forms não aceita upload de quem é
externo). Os documentos chegam por e-mail com o protocolo.

### Fluxo 1 — Ficha recebida

*Quando uma nova resposta é enviada* → *Obter detalhes da resposta* →
*Compor* o JSON abaixo → Dataverse › *Executar uma ação não associada*
`dgt_ConsultarFornecedor`, `PayloadJson` =
`{"acao":"receberFicha","ficha": @{outputs('Compor')}}` → *Analisar JSON* do
`ResultadoJson` → *Enviar um e-mail (V2)* ao contato do fornecedor:

- Assunto: `[@{protocolo}] Documentos para cadastro na DGT — @{razaoSocial}`
- Corpo: a lista `documentosPendentes` e o pedido para **responder este e-mail**
  com os anexos para **vaneska@dgt.com.br**, mantendo o protocolo no assunto.
- Se `dadosBancariosAlterados` = true: avise Suprimentos/Financeiro (confirmação
  por telefone).

```json
{
  "tipoSolicitacao": "Cadastro inicial",
  "cnpj": "", "razaoSocial": "", "nomeFantasia": "",
  "inscricaoEstadual": "", "inscricaoMunicipal": "",
  "endereco": "", "cidade": "", "uf": "", "cep": "",
  "telefone": "", "site": "", "emailPedidos": "", "porte": "",
  "categoriaFornecimento": "[\"Prestação de serviços\"]", "categoriaOutros": "",
  "descricaoFornecimento": "",
  "contatos": {
    "comercial":   { "nome": "", "cargo": "", "email": "", "telefone": "" },
    "fiscal":      { "nome": "", "cargo": "", "email": "", "telefone": "" },
    "financeiro":  { "nome": "", "cargo": "", "email": "", "telefone": "" },
    "integridade": { "nome": "", "cargo": "", "email": "", "telefone": "" }
  },
  "socios": [ { "nome": "", "cargo": "", "cpf": "", "participacao": "" } ],
  "participaOutrasSociedades": "Não", "outrasSociedades": "",
  "grupoEconomico": "Não", "grupoEconomicoDetalhe": "",
  "regimeTributario": "", "faixaFaturamento": "", "anexoSimples": "", "previsaoMudancaRegime": "",
  "banco": { "banco": "", "agencia": "", "conta": "", "tipoChavePix": "", "chavePix": "", "titular": "", "cnpjTitular": "" },
  "questionario": { "6.1": "Não", "6.2": "Não", "6.3": "Não", "6.4": "Não", "6.5": "Não", "6.6": "Não",
                    "6.7": "Não", "6.8": "Sim", "6.9": "Sim", "6.10": "Não", "6.11": "Não" },
  "certificacoes": "", "detalhamentoPositivas": "",
  "declaracoesAceitas": true, "representanteNome": "", "representanteCargo": "", "local": ""
}
```

- Cada valor vem da resposta do Forms (conteúdo dinâmico). Escolha múltipla pode
  ir como veio do Forms (texto `["a","b"]`) ou separada por `;`.
- Sócios: o Forms não tem grupo repetível. Crie blocos "Sócio 1" a "Sócio 4"
  (nome, cargo, CPF, %) e monte a lista no *Compor*; linhas sem nome são ignoradas.
- Respostas do questionário: "Sim", "Não" ou qualquer outro texto
  (vira "Não se aplica / Não sei").
- CNPJ já cadastrado: a ficha **atualiza** o cadastro (não duplica) e fica no
  histórico. Cadastro novo: completa com a Receita (CNPJá) e entra como
  "Em homologação".
- A conta do fluxo precisa de Criar/Ler/Gravar nas tabelas de fornecedor.

### Fluxo 2 — Documentos recebidos (caixa vaneska@dgt.com.br)

*Quando um novo e-mail chegar (V3)* na caixa, filtro de assunto `FORN-`,
"Incluir anexos" = Sim:

1. Protocolo: `substring(triggerOutputs()?['body/subject'], indexOf(triggerOutputs()?['body/subject'], 'FORN-'), 14)`.
2. Dataverse › *Listar linhas* `dgt_fornecedors`, filtro `dgt_protocolo eq '@{protocolo}'`.
   Sem linha: responder pedindo o protocolo correto e parar.
3. Para cada anexo: SharePoint › *Criar arquivo* na biblioteca
   **Documentos de Fornecedores**, pasta `Razão social (8 primeiros caracteres do id)`
   (mesmo padrão da tela).
4. Dataverse › *Adicionar linha* em `dgt_fornecedorhistoricos`: ação
   "Documentos recebidos por e-mail", descrição com os nomes dos arquivos.
5. A analista registra cada documento na aba Documentos (Registrar/Renovar →
   link do arquivo), conferindo emissão e validade.

A conexão do Outlook do fluxo 2 é a da caixa vaneska@dgt.com.br (ou de quem tiver
acesso a ela). A leitura dos anexos por IA para sugerir o tipo de documento fica
para uma próxima etapa.

## 9. Assinatura da ficha (Clicksign) — próximo passo

O portal já tem a integração Clicksign via Power Automate (`docs/assinatura-digital.md`,
tabela `dgt_assinatura`); o **token da Clicksign fica só no Power Automate**. A
ficha consolidada (PDF) usará essa mesma estrutura. As colunas
`dgt_assinaturastatus` e `dgt_assinaturaid` já foram criadas no fornecedor; a aba
Homologação mostra a etapa como "integração aguardando o token".

