# Fornecedores — homologação e gestão (fase 1, uso interno)

Módulo para Suprimentos: cadastro mestre de fornecedores, documentos com
validade, consultas automáticas (Receita via CNPJá, CEIS e CNEP via Portal da
Transparência, certidões via Infosimples), Ficha de Cadastro SUP-CPL-01 recebida
pelo Microsoft Forms, homologação no motor de fluxos (processo **SUP-HOM**, item 9),
contratos e colaboradores do prestador (ASO e NR). Base: escopo "Plataforma de
Homologação e Gestão de Fornecedores" (minuta 1.0, 06/11/2026) e Ficha de
Cadastro de Fornecedor SUP-CPL-01 v1.0 (11/11/2026).

**Fluxo de homologação (Suprimentos + Jurídico):**

1. O fornecedor responde o **Forms** (itens 1 a 6 e 8 da ficha) → o Power Automate
   chama `receberFicha` → cadastro em **Em homologação** com protocolo
   `FORN-AAAA-NNNN` e um ciclo novo na etapa **Ficha recebida** (área Suprimentos).
2. O fluxo responde ao fornecedor com o protocolo e a lista de documentos que ele
   precisa mandar por e-mail para **vaneska@dgt.com.br** (o Forms não aceita anexo
   de quem é externo). Ver seção 8.
3. A analista revisa (aba **Ficha**) e roda as consultas (aba **Consultas**:
   Receita, sanções e certidões).
4. Ficha consolidada **e Código de Conduta** assinados pelo fornecedor, no mesmo
   envelope Clicksign (aguardando o token — ver seção 9).
5. Suprimentos envia ao **Jurídico**, que decide: **Aprovar**, **Aprovar com
   ressalvas**, **Não homologar** ou **Devolver a Suprimentos** → status **Homologado**
   (ou **Reprovado**). Ver seção 7b.
6. Colaboradores do prestador (botão **Colaboradores**): ASO e NR aplicável de cada
   um (seção 7c). O contrato só sai quando uma demanda fechar (Jurídico + Vaneska +
   comprador + prestador).

**Fora desta fase:** portal do fornecedor (acesso externo), aprovações por alçada,
IQF, integração com o CIGAM, matriz de risco e score, consulta Serasa, tipos de
documento de colaborador cadastráveis e consulta automática do TCU. Os avisos
(etapa da homologação, vencimentos) são do Power Automate — seção 10.

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

**Colaboradores do prestador — CPF.** Mesmo padrão: o CPF fica **só** em
`dgt_fornecedorcolaborador.dgt_cpf` (coluna protegida), perfil próprio
`DGT - Fornecedores - CPF de colaboradores` (Suprimentos / SESMT), para que quem
cuida dos colaboradores não precise ver os sócios. Sem e-mail e sem telefone do
colaborador. O CPF não vai para observações, histórico ou e-mail; a tela mostra
mascarado até clicar em Mostrar. Dados de saúde ficam só no arquivo do ASO.
Validação de LGPD considerada feita pelo responsável do projeto (nov/2026).

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
| `dgt_fornecedorhomologacao` | Ciclos de homologação (cards do kanban): etapa, item 9, resultado; concluído = somente leitura |
| `dgt_fornecedorcolaborador` | Colaboradores do prestador: nome, função, CPF (protegido), observações, ativo |
| `dgt_colaboradordocumento` | ASO e NR aplicável de cada colaborador (Vigente / Substituído), emissão, validade, arquivo |
| `dgt_fornecedorcontrato` | Contratos do fornecedor: nome, projeto (texto livre), assinatura, início e fim da vigência, arquivo, situação (Vigente / Encerrado), origem (Manual / E-mail) |

Colunas da homologação no motor (em `dgt_fornecedorhomologacao`): `dgt_fluxoestado`
(estado do fluxo, JSON), `dgt_etapaatual` (id da etapa), `dgt_prazoetapa`,
`dgt_responsaveisetapa` (mesmo formato de `dgt_responsaveisjson`, ver
`docs/fluxo-dataverse.md` seção 5) e `dgt_documentospendentes` (lista do e-mail ao
fornecedor). Controle dos avisos de vencimento: `dgt_avisovencimentoem` em
`dgt_fornecedordocumento`, `dgt_colaboradordocumento` e `dgt_fornecedorcontrato`.
O script também aumenta `dgt_fornecedordocumento.dgt_situacao` para 30 caracteres
(cabe "Convertido em contrato").

Nada é apagado pela tela. O script também cria o perfil de segurança de campo e a
Custom API `dgt_ConsultarFornecedor` (exige `prvWritedgt_fornecedor`).

## 3. Permissões

- Função de segurança de Suprimentos **e do Jurídico**: Criar / Ler / Gravar
  (Organização) nas 9 tabelas, **sem Excluir** (o Jurídico grava o ciclo ao decidir).
- **Áreas "Suprimentos" e "Jurídico"** cadastradas (Áreas, com as siglas usadas no
  pacote SUP-HOM — `SUY` (Supply/Suprimentos) e `JUR`; atenção: `SUP` é o Suporte) e as pessoas vinculadas em
  `dgt_usuarioarea`. Quem não estiver vinculado **não vê a pendência nem recebe o
  e-mail**.
- Pessoas (ou equipe) de Suprimentos no perfil de campo `DGT - Fornecedores - CNPJ`;
  quem cadastra colaboradores, no perfil `DGT - Fornecedores - CPF de colaboradores`.
- Usuários e acessos: liberar o módulo **Fornecedores**; quem aprova homologação
  recebe "Administrador do módulo" (status Homologado, Suspenso, Bloqueado e
  Descredenciado e a aba Tipos de documento).
- SharePoint: edição na pasta **Contratos Fornecedores** do site de Suprimentos (ver item 5).

## 4. Plugin `ConsultarFornecedorPlugin`

1. `dotnet build -c Release` e atualizar o assembly.
2. Registrar o **passo** (como o do ClickUp):
   - Message `dgt_ConsultarFornecedor` · Primary Entity none · PostOperation · Síncrono
   - **Configuração segura** (só aqui ficam as chaves):
     `{ "cnpja": "<chave do CNPJá>", "transparencia": "<chave da API de dados>", "infosimples": "<token da Infosimples>" }`
   - Configuração não segura (opcional):
     `{ "cnpjaParametros": "maxAge=30", "diasEntreConsultas": 14, "limiteLote": 20, "infosimplesTimeout": 90, "diasRenovacaoCertidoes": 15, "rotasEstaduais": {}, "rotasMunicipais": {}, "rotasTrt": { "RS": "tribunal/trt4/ceat" }, "areaSuprimentos": "SUY" }`
   - `areaSuprimentos`: sigla da área Suprimentos. O ciclo aberto pela ficha já
     sai com a etapa `ficha-recebida` e essa área em `dgt_responsaveisetapa`, para
     o aviso da primeira etapa sair antes de alguém abrir o portal.

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
| `ceat` | CEAT — ações trabalhistas (TRT da sede) | por UF ou cidade (`rotasTrt`); padrão `RS` → `tribunal/trt4/ceat` |

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
- **CEAT (TRT):** `data[0].nada_consta` = true → regular (entra em Documentos);
  false → irregular (Consultas + histórico, com varas e números dos processos). O
  comprovante vem em `data[0].site_receipt`. A CEAT não traz validade: vale a do
  tipo (sugestão: 30 dias). Fornecedor fora do RS fica "Sem cobertura" até o TRT
  dele entrar em `rotasTrt` (`"SP/Campinas": "<rota do TRT15>"` para UF com mais
  de um TRT; a cidade tem prioridade sobre a UF).
  **Atenção ao custo:** a chamada é cobrada mesmo com parâmetro inválido (código
  607). O plugin só chama a Infosimples com CNPJ de dígito válido (portal e lote).
  No teste, a cobrança foi de R$ 0,26 por chamada (a documentação pública cita
  R$ 0,04 de preço adicional): **confirmar com o financeiro/Infosimples** antes de
  dimensionar o lote diário. **Pendente:** repetir o teste com um CNPJ de dígito
  certamente correto para confirmar que o 607 foi erro de digitação.

Ações (`PayloadJson`):

| Ação | Payload | O que faz |
|---|---|---|
| `previa` | `{ "acao": "previa", "cnpj": "..." }` | Confere duplicidade e devolve os dados da Receita. Não grava. |
| `consultar` | `{ "acao": "consultar", "fornecedorId": "...", "consultas": ["cnpj","sancoes"] }` | Consulta e grava em `dgt_fornecedorconsulta` e no fornecedor |
| `lote` | `{ "acao": "lote", "consultas": ["sancoes"], "limite": 20 }` | Fornecedores ativos sem consulta há mais de `diasEntreConsultas` dias |
| `consultar` (certidão) | `{ "acao": "consultar", "fornecedorId": "...", "consultas": ["cnd_federal"] }` | Emite a certidão e registra o documento se regular (`"certidoes"` = todas, inclusive `ceat`) |
| `lote` (certidões) | `{ "acao": "lote", "consultas": ["certidoes"], "limite": 20 }` | Renova as que faltam ou vencem logo; para quando o tempo acaba (`haMais`) |
| `receberFicha` | `{ "acao": "receberFicha", "ficha": { … } }` | Resposta do Forms (seção 8). Abre um ciclo no kanban se não houver um aberto. Devolve `id`, `protocolo`, `novo`, `documentosPendentes` |

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

**Alertas de vencimento (30/15/5 dias), interno** — Agendado (diário). Os avisos
ao fornecedor e de contratos estão na seção 10.
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

## 7b. Homologação no motor de fluxos (processo SUP-HOM) — piloto

A etapa do ciclo segue o fluxo **publicado** do processo **SUP-HOM — Homologação de
fornecedor** (Processos → Fluxos), no mesmo padrão do Planejamento Orçamentário: o
estado do fluxo fica no próprio ciclo (`dgt_fluxoestado`).

**Configurar (uma vez):** Processos → Fluxos → **Importar JSON** com
`docs/exemplos/pacote-homologacao-fornecedor.json` → conferir → **Publicar**. As
siglas `SUY` (Supply = Suprimentos) e `JUR` do pacote precisam existir em Áreas (troque no JSON, se as
siglas forem outras). Sem processo publicado, a tela mostra o que falta e **nenhum
ciclo muda de etapa**.

| Etapa (id) | Responde | Botões |
|---|---|---|
| `ficha-recebida` | área Suprimentos | **Solicitar documentos** → documentos-pendentes; **Documentação já completa** → analise-suprimentos |
| `documentos-pendentes` | área Suprimentos | **Documentação completa** → analise-suprimentos |
| `analise-suprimentos` | área Suprimentos | **Enviar ao Jurídico** (exige risco e validade do cadastro); **Voltar a pedir documentos** (exige comentário) |
| `analise-juridico` | área Jurídico | **Aprovar**; **Aprovar com ressalvas** (comentário); **Não homologar** (comentário; resultado Reprovado); **Devolver a Suprimentos** (comentário) |
| fim `homologado` / `reprovado` | — | — |

- **Quem decide é o Jurídico.** Suprimentos só encaminha ou devolve. Os três botões
  finais concluem o ciclo com as regras de sempre: aprovar exige risco e validade;
  "com ressalvas" e "Não homologar" exigem ressalvas (o **parecer** do Jurídico ou, sem ele,
  o comentário). Grava o ciclo e o cadastro (status, risco, validade, quem
  respondeu por Suprimentos e pelo Jurídico, com a data).
- O botão de reprovar chama-se **Não homologar** (o ciclo e o cadastro ficam
  **Reprovado**): o motor não aceita, em nenhum fluxo, um botão "Reprovar/Devolver"
  que encerre o fluxo — reprovação, para o motor, sempre volta a uma etapa anterior.
- **Ninguém move card à mão**, nem o administrador. A etapa só muda pelos botões do
  fluxo, com comentário, histórico do fluxo e linha no histórico do fornecedor.
- **Kanban = só visualização** (aba Homologação do fornecedor e aba Homologações do
  módulo): etapa, há quanto tempo, prazo, quem responde e "Abrir". A coluna
  (`dgt_etapa`) é derivada da etapa do fluxo (`etapaKanbanDoFluxo` em
  `homologacao.ts`, testado).
- **Aba Pendências** ("Aguardando você"): ciclos em que o usuário responde a etapa
  atual. "Abrir" leva à aba Homologação do fornecedor: etapa, resumo dos documentos
  (inclusive "a conferir"), campos, comentário, botões e histórico do fluxo.
- **Checklist do item 9** continua no card: edita quem responde a etapa atual ou o
  administrador do módulo (correção de dados). Salvar o checklist **não** muda a etapa.
- **Abrir ciclo:** pela ficha (plugin, `receberFicha`) ou pelo botão **Abrir ciclo**
  (só o motivo). O plugin cria o ciclo **sem instância**, com `dgt_etapaatual =
  ficha-recebida` e a área Suprimentos em `dgt_responsaveisetapa`; o portal inicia a
  instância na primeira vez que alguém abre o ciclo (mesma etapa: o aviso não repete).
- **Ciclos abertos antes desta versão:** ao abrir, o fluxo começa na **etapa
  equivalente** à coluna em que o card estava (ex.: "Aguardando Jurídico" →
  `analise-juridico`), com registro no histórico do fluxo. Ciclos só de teste podem
  ser concluídos ou recriados. **Pendência (confirmar):** se houver ciclos reais
  abertos, conferir a etapa de cada um depois da migração.
- **Fluxo concluído sem gravar o ciclo** (falha de gravação): o card mostra **Gravar a
  conclusão** para quem responde ou para o administrador.
- **Homologação anterior ao kanban:** botão **Registrar a homologação atual como
  ciclo 1** (cria o ciclo 1 concluído com os dados do cadastro).
- **Limitação (piloto):** como em Documentos e Ambientes, quem pode agir é
  conferido no navegador. A homologação pelo motor fica em **piloto** até o motor ir
  para a Custom API.

## 7c. Colaboradores do prestador

Botão **Colaboradores** no detalhe do fornecedor.

- Cadastro: nome, função/cargo, CPF (coluna protegida, dígito validado, sem
  repetir no mesmo fornecedor) e observações. **Sem e-mail e sem telefone.**
  Desativar em vez de apagar.
- Documentos: **ASO** (obrigatório, com validade; sugestão de 1 ano a partir da
  emissão) e **NR aplicável** (texto livre com a norma — NR-10, NR-35… —, com
  validade). Nova versão do ASO, ou da mesma NR, deixa a anterior Substituída.
- Pendência: ASO faltando ou vencido, ou alguma NR vencida.
- Arquivos: pasta do fornecedor › `Colaboradores` › `Nome (8 primeiros
  caracteres do id)` no site de Suprimentos, ou link do arquivo.
- O histórico do fornecedor registra cadastro, alteração e documentos do
  colaborador, nunca o CPF.

## 7d. Contratos do fornecedor

Aba **Contratos** no fornecedor e aba **Contratos** no módulo (todos os fornecedores).

- Vários contratos por fornecedor: nome, **projeto** (texto livre, com sugestão dos
  já usados), data de assinatura, início e fim da vigência (vazio = prazo
  indeterminado), arquivo (pasta do fornecedor › `Contratos`, ou link) e observações.
- Ordena por assinatura, início ou fim da vigência; filtra por projeto e por
  "vencendo em até 30 dias (e vencidos)".
- Situação: **Vigente**, **Vence em N dias**, **Vencido** (calculados pelo fim da
  vigência) ou **Encerrado** (manual, com motivo). Não se exclui contrato.
- O histórico do fornecedor registra criação, alteração e encerramento.
- Contrato que chega assinado por e-mail (ex.: Clicksign) entra pela fila "A
  conferir": **Conferir → Contrato** (seção 8).
- Fim da vigência gera aviso interno para Suprimentos (seção 10, E2).
- **Pendência (confirmar):** a visão Contratos do módulo (além da aba do fornecedor)
  foi implementada como proposta; confirmar se fica.

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
"Incluir anexos" = Sim, "Somente com anexos" = Sim:

1. **Localizar o fornecedor** — Dataverse › *Executar uma ação não associada*
   `dgt_ConsultarFornecedor`, `PayloadJson` =
   `{"acao":"localizarProtocolo","assunto":"@{triggerOutputs()?['body/subject']}"}`
   → *Analisar JSON* do `ResultadoJson`
   (`{ encontrado, protocolo, fornecedorId, razaoSocial, pasta }`).
   O servidor acha o protocolo em qualquer ponto do assunto ("RE:", "ENC:",
   sequencial com mais de 4 dígitos) e também nos protocolos de ciclos antigos.
2. *Condição* `encontrado` = false → *Responder ao e-mail (V3)* pedindo para
   reenviar com o protocolo `FORN-AAAA-NNNN` no assunto, e parar.
3. *Aplicar a cada* anexo **com `isInline` = false** (ignora logos e imagens da
   assinatura): SharePoint › *Criar arquivo* no site de Suprimentos, pasta
   `/Shared Documents/General/03. CONTRATOS/Contratos/Contratos Fornecedores/@{pasta}`
   (o `pasta` vem do passo 1 — é o mesmo nome que o portal usa). Junte numa
   variável de matriz `arquivos` um item `{"nome": nome do arquivo, "url": link do arquivo criado}`.
4. **Registrar os arquivos** — *Executar uma ação não associada*
   `dgt_ConsultarFornecedor`, `PayloadJson` =
   `{"acao":"receberDocumentos","assunto":"@{triggerOutputs()?['body/subject']}","arquivos":@{variables('arquivos')}}`.
   Cada arquivo vira um documento **"A conferir"** (sem tipo e sem datas) e o
   histórico registra o recebimento. Um link já registrado não é repetido.
   Devolve `{ registrados, ignorados }`.
5. (Opcional) *Responder ao e-mail* confirmando o recebimento.

### Fluxo 2b — Retorno do Clicksign (documentos assinados)

O Clicksign manda **"N documentos assinados: arquivo1.pdf, arquivo2.pdf..."** de
`assinatura@clicksign.com` para quem enviou o envelope, com os PDFs anexados como
`<nome original> - Clicksign.pdf`. O assunto **é cortado com "..."** quando há muitos
arquivos.

**Regra operacional (Suprimentos):** o protocolo `FORN-AAAA-NNNN` vai **no nome do
arquivo** enviado ao Clicksign (ex.: `FORN-2026-0042 - Contrato manutencao.pdf`) e o
envelope é enviado pela conta da caixa monitorada (a mesma do Fluxo 2). Sem
protocolo no nome, o arquivo não é reconhecido. **Pendência (confirmar):** validar
esta regra com Suprimentos.

Fluxo separado do Fluxo 2 (ações em português):

1. *Quando um novo email chegar (V3)* — **De** = `assinatura@clicksign.com`,
   *Incluir anexos* = Sim, *Somente com anexos* = Sim.
2. *Inicializar variável* `arquivos` (Matriz, `[]`) e `protocolos` (Matriz, `[]`).
3. *Filtrar matriz* dos anexos com `isInline` = false (`Anexos_reais`).
4. *Aplicar a cada* anexo de `Anexos_reais`: *Executar uma ação não associada*
   `dgt_ConsultarFornecedor` com
   `string(setProperty(json('{"acao":"localizarProtocolo"}'), 'assunto', items('Aplicar_a_cada')?['name']))`
   → *Analisar JSON* → se `encontrado` = true, *Acrescentar à variável de matriz*
   `protocolos` o valor `protocolo`.
5. Se `protocolos` estiver vazio: tente uma vez com o **assunto** (mesma ação, com
   `triggerOutputs()?['body/subject']`). Ainda sem protocolo → **Encerrar** (Êxito),
   **sem responder** — o remetente é o Clicksign e há envelopes que não são de
   fornecedor (ex.: "Termo Inventário Estoque").
6. Protocolo usado = `first(union(variables('protocolos'), variables('protocolos')))`.
   Se `length(union(variables('protocolos'), variables('protocolos')))` > 1: e-mail a
   Suprimentos ("e-mail do Clicksign com mais de um protocolo; registrado no
   primeiro: …") e segue.
7. Chame `localizarProtocolo` com o protocolo escolhido para obter a `pasta` e siga os
   passos 3 e 4 do Fluxo 2 (Criar arquivo na pasta do fornecedor, acrescentar a
   `arquivos`, `receberDocumentos` com `"protocolo"` = o escolhido).
8. Para marcar a origem: *Aplicar a cada* item de `arquivos` → *Listar linhas*
   `dgt_fornecedordocumentos` com `dgt_arquivourl eq '@{items('Aplicar_a_cada_2')?['url']}'`
   → *Atualizar uma linha* com `dgt_observacoes` =
   `concat(<observações atuais>, ' Assinado via Clicksign.')`.

Os PDFs entram como **"A conferir"**: **não** viram contrato automaticamente. No
Conferir, quem confere escolhe o que é cada arquivo — um tipo de documento ou
**Contrato**.

**No portal (opção A):** os arquivos aparecem na aba **Documentos** do fornecedor,
no bloco **"Recebidos por e-mail — a conferir"** (e na Visão geral, coluna "A
conferir"). Para cada um: **Conferir** (abre o arquivo; escolher o tipo, emissão e
validade — a validade é sugerida pelo tipo) → vira **Vigente** e substitui a versão
anterior do mesmo tipo; **Conferir → Contrato** (nome, projeto, assinatura, início e
fim da vigência) → cria o contrato com o **mesmo arquivo** (origem E-mail) e o item
sai da fila como **Convertido em contrato**; ou **Descartar** (com motivo — o
arquivo continua no SharePoint, só sai da fila). "A conferir", "Descartado" e
"Convertido em contrato" **não contam** como documento entregue.

A conexão do Outlook do fluxo 2 é a da caixa de Suprimentos (ou de quem tiver
acesso a ela). **Próxima etapa (C):** a IA lê cada arquivo recebido e já sugere o
tipo, a emissão e a validade no "Conferir" (a analista só confirma).

## 9. Assinatura da ficha e do Código de Conduta (Clicksign) — bloqueado pelo token

O portal já tem a integração Clicksign via Power Automate (`docs/assinatura-digital.md`,
tabela `dgt_assinatura`); o **token da Clicksign fica só no Power Automate**.

Desenho (a executar quando o token entrar no fluxo de assinatura):

- **Um envelope só** por fornecedor/ciclo, com dois documentos: a **ficha
  consolidada** (PDF gerado a partir do cadastro) e o **Código de Conduta da DGT**
  (documento oficial já pronto, guardado no SharePoint de Suprimentos — o fluxo
  anexa a versão vigente).
- Signatário: representante legal informado na ficha (item 8); cópia para
  Suprimentos.
- O envelope é aberto com o card em **Em análise** ou **Aguardando Jurídico**
  (ação manual nesta fase). O fluxo grava o andamento em
  `dgt_fornecedor.dgt_assinaturastatus` ("Enviado", "Assinado", "Recusado") e o id
  em `dgt_assinaturaid`. Assinado → o fluxo registra os dois PDFs em Documentos
  (tipo "Ficha de Cadastro SUP-CPL-01 assinada" e um tipo "Código de Conduta
  assinado", a criar).
- O card mostra "Ficha e Código de Conduta assinados (Clicksign)" no andamento;
  hoje aparece "integração aguardando o token".

## 10. Avisos por Power Automate (homologação e vencimentos)

O motor e o portal **não enviam e-mail**. Os avisos são fluxos do Power Automate
que leem o que o portal grava. Ações em português.

**Padrão de falha (vale para toda chamada ao Dataverse):** em cada ação do Dataverse,
adicione em paralelo *Enviar um email (V2)* para a caixa de Suprimentos com
*Configurar executar após* = **falhou** e **atingiu o tempo limite**, assunto
"Falha no fluxo <nome>" e o link da execução:
`concat('https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])`.
Nunca coloque CNPJ, CPF ou dados bancários no e-mail.

### D2. Aviso de etapa da homologação

1. *Quando uma linha é adicionada, modificada ou excluída* — tipo **Adicionada ou
   modificada**, tabela **Ciclos de homologação** (`dgt_fornecedorhomologacao`),
   escopo Organização, **Selecionar colunas** = `dgt_etapaatual`.
2. *Condição*: `dgt_etapaatual` não vazio **e** `dgt_responsaveisetapa` diferente de
   `[]`; senão **Encerrar** (ciclo recém-criado ou concluído).
3. *Obter uma linha por ID* — **Fornecedores**, `_dgt_fornecedor_value`, colunas
   `dgt_name,dgt_protocolo,dgt_contatocomercial,dgt_emailpedidos`.
4. *Analisar JSON* de `dgt_responsaveisetapa` (lista de
   `{ descricao, usuarioId?, areaId?, somenteGestores?, usuariosIds? }`) e resolva os
   e-mails pela lógica do **Fluxo A** de `docs/fluxo-dataverse.md` (`areaId` →
   *Listar linhas* em `dgt_usuarioarea` da área, ativos → `dgt_usuario` → e-mail).
5. *Enviar um email (V2)* interno: razão social, protocolo, etapa (`dgt_etapa`), prazo
   (`dgt_prazoetapa`) e o link do portal (módulo Fornecedores → aba **Pendências**).
6. **Caso especial** `dgt_etapaatual` = `documentos-pendentes`: além do aviso interno,
   e-mail **ao fornecedor**, enviado pela caixa monitorada (a resposta precisa cair
   no Fluxo 2):
   - Para: `json(<dgt_contatocomercial>)?['email']`; se vazio, `dgt_emailpedidos`;
   - Assunto: `@{dgt_protocolo} — Documentos para homologação` (o protocolo no assunto
     é o que o Fluxo 2 reconhece);
   - Corpo: as linhas de `dgt_documentospendentes` (gravada pelo portal ao chegar na
     etapa: só tipos **manuais** que faltam, vencidos ou a vencer) e o pedido para
     **responder este e-mail com os anexos, sem mudar o assunto**.

### D3. Avisos de vencimento (agendado, diário)

A regra está escrita e testada em `services/fornecedores/avisosVencimento.ts` e
`contratos.ts` (`contratoNoAvisoDeVencimento`). Antecedência: **15 dias**.

**E1. Ao fornecedor: documentos manuais vencendo em 15 dias** — *Recorrência* diária, 07h.

1. *Listar linhas* **Fornecedores** com
   `dgt_ativo eq true and (dgt_status eq 'Homologado' or dgt_status eq 'Em homologação')`
   (Bloqueado, Suspenso, Inativo etc. não recebem).
2. *Aplicar a cada* fornecedor (Simultaneidade 1):
   - *Listar linhas* **Documentos de fornecedor**:
     `_dgt_fornecedor_value eq @{id} and dgt_situacao eq 'Vigente' and dgt_avisovencimentoem eq null and dgt_datavencimento ge @{formatDateTime(utcNow(),'yyyy-MM-dd')} and dgt_datavencimento le @{formatDateTime(addDays(utcNow(),15),'yyyy-MM-dd')} and not endswith(dgt_responsavelnome,'(automático)')`.
     Os automáticos (certidões emitidas pelo plugin, gravadas com "(automático)") a
     DGT renova sozinha; **CND estadual ou municipal enviada à mão entra**.
   - *Listar linhas* **Documentos de colaborador** com
     `dgt_Colaborador/_dgt_fornecedor_value eq @{id} and dgt_Colaborador/dgt_ativo eq true and dgt_situacao eq 'Vigente' and dgt_avisovencimentoem eq null and dgt_datavencimento ge … and dgt_datavencimento le …`,
     expandir `dgt_Colaborador($select=dgt_name)`.
   - Nada nas duas listas → próximo fornecedor.
   - **Um e-mail por fornecedor** (mesmo destinatário do D2): documento e vencimento;
     para colaboradores, **nome + tipo/norma + vencimento, nunca o CPF** (não
     selecione `dgt_cpf`).
   - Depois de enviar: *Atualizar uma linha* em cada documento listado com
     `dgt_avisovencimentoem` = `utcNow()`. **Um aviso por documento**: a renovação é
     um registro novo, sem a data, e volta a ser avisada no próximo vencimento.

**E2. Interno: contratos vencendo** — mesma recorrência.

1. *Listar linhas* **Contratos de fornecedor**:
   `dgt_situacao eq 'Vigente' and dgt_avisovencimentoem eq null and dgt_fimvigencia ge @{hoje} and dgt_fimvigencia le @{hoje + 15 dias}`,
   expandir `dgt_Fornecedor($select=dgt_name)`.
2. Para cada contrato: e-mail aos membros da área Suprimentos (mesma resolução do D2,
   pela área) com fornecedor, contrato, projeto, fim da vigência e o link do portal
   (aba **Contratos**); depois *Atualizar uma linha* com `dgt_avisovencimentoem` =
   `utcNow()`.
3. **Pendência (confirmar):** antecedência do aviso de contrato — proposta de 15 dias,
   igual à dos documentos.

## 11. Pendências a confirmar

1. Visão Contratos no módulo (seção 7d), além da aba do fornecedor — implementada
   como proposta.
2. Antecedência do aviso de contrato (seção 10, E2) — proposta de 15 dias.
3. Ciclos abertos antes do motor (seção 7b) — começam na etapa equivalente; conferir
   se há ciclos reais.
4. Regra operacional do protocolo no nome do arquivo enviado ao Clicksign (seção 8,
   Fluxo 2b).
