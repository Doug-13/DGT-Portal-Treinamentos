# Ambientes dinâmicos (+ Adicionar ambiente)

Permite criar novos ambientes no portal — ex.: **Processo**, **Licitações**,
**Compras**, **Jurídico** — **sem escrever código novo**. Cada ambiente:

- aparece no **menu lateral** para quem tem o ambiente liberado;
- é liberado em **Usuários e acessos** exatamente como os módulos atuais
  (checkbox do módulo + "Administrador do módulo");
- fica **vinculado a um fluxo** de Processos → Fluxos: um **novo**, criado junto com o
  ambiente, ou um **já existente** (o mesmo fluxo pode servir a mais de um ambiente);
- cada registro do ambiente (solicitação, processo licitatório, pedido...)
  **segue esse fluxo**: etapas, responsáveis, campos, prazos e botões vêm do desenho.

Ordem de implantação: **1. tabelas → 2. permissões → 3. pacote → 4. teste**.

---

## 1. Criar as tabelas

Pré-requisito: as tabelas do fluxo configurável já existem
(`criar-tabelas-fluxo.ps1`).

```powershell
cd scripts\dataverse
.\criar-tabelas-ambientes.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao NOME_DA_SOLUCAO
```

Pode ser executado de novo: o que já existe é mantido.

| Tabela | Para que serve |
|---|---|
| `dgt_ambiente` | Cadastro do ambiente: nome, chave, ícone, ordem, liberação padrão, prefixo do código, processo do fluxo (`dgt_Processo`). |
| `dgt_ambienteregistro` | Cada registro do ambiente: código, título, área, quem abriu, situação, etapa atual, prazo, responsáveis da etapa e o **estado do fluxo** (`dgt_fluxoestado`, JSON com o histórico). |

> Enquanto as tabelas não existirem, o portal funciona exatamente como antes:
> nenhum ambiente aparece e o botão "+ Adicionar ambiente" explica o que falta.

---

## 2. Permissões (perfis de segurança)

Power Platform admin center → ambiente → *Configurações* → *Usuários + permissões*
→ *Perfis de segurança* → aba **Entidades personalizadas**:

| Tabela | Colaboradores / Gestores / Editores | Administradores |
|---|---|---|
| `dgt_ambiente` | Ler (Org.) | Criar, Ler, Gravar, Acrescentar, Acrescentar a (Org.) |
| `dgt_ambienteregistro` | Criar, Ler, Gravar, Acrescentar, **Acrescentar a** (Org.) | idem |
| `dgt_processo` | Ler (Org.) | + **Criar** (o portal cria o processo do ambiente) |
| `dgt_area`, `dgt_usuario` | + **Acrescentar a** (Org.) | idem |

- *Excluir* em `dgt_ambienteregistro` e `dgt_ambiente`: **só Administradores**, na fase de criação (veja “Excluir, desativar e recriar”). Em uso real, prefira **Desativar** e **Cancelar registro**, que preservam o histórico.
- Quem executa etapas precisa **Gravar** no registro, porque o estado do fluxo fica nele.
- Para restringir quem lê os registros (ex.: só a equipe de Licitações),
  use o nível **Unidade de negócios / Usuário** nos perfis — a tela
  respeita o que o Dataverse devolver.

---

## 3. Pacote do portal

```powershell
Remove-Item -Recurse -Force lib, lib-commonjs, temp -ErrorAction SilentlyContinue
npm run build
```

Envie o `.sppkg` ao Catálogo de Aplicativos e abra o portal com **Ctrl+F5**.

`FEATURE_FLAGS.FLUXO_PERSISTENCIA` precisa estar em `'dataverse'`
(ambientes não funcionam no modo de teste local).

---

## 4. Roteiro de teste

1. Entre como **Administrador** → menu lateral → **+ Adicionar ambiente**.
2. Preencha: nome "Licitações", ícone, "Como cada registro é chamado" =
   *Processo licitatório*, prefixo `LIC`. Marque a liberação padrão (ou deixe sem).
   Em **Fluxo do ambiente** escolha:
   - **Criar um fluxo novo** → o portal cria o processo `AMB-LICITACOES`; ou
   - **Usar um fluxo que já existe** → escolha um fluxo de Processos → Fluxos
     (a lista mostra se ele tem versão publicada e quais ambientes já o usam).
   → **Criar ambiente**. O portal abre o ambiente.
3. Aba **Configuração** mostra o fluxo vinculado. Se ainda não houver versão
   publicada → **Desenhar fluxo**. Abre Processos → Fluxos já no processo:
   - aba **Metadados**: crie os campos (ex.: *Órgão*, *Valor estimado*, *Data da sessão*);
   - aba **Fluxo**: crie as etapas, responsáveis, campos por etapa e caminhos →
     *Verificar fluxo* → **Publicar**.
4. Volte ao ambiente pelo menu → aba Configuração mostra *Fluxo vN publicado*.
5. **Usuários e acessos** → um colaborador → o ambiente aparece em
   *Módulos liberados*, com a opção *Administrador do módulo*. Libere.
6. Como o colaborador: o ambiente aparece no menu → **+ Novo(a) processo licitatório**
   → título, descrição e área → **Criar e iniciar fluxo**. O código sai
   como `LIC-2026-0001` e o registro vai para a 1ª etapa.
7. Com o responsável de cada etapa (aba **Aguardando você**), preencha os campos
   e use os botões do desenho até concluir.
8. Confira no Dataverse (`dgt_ambienteregistro`): situação, etapa atual, prazo,
   responsáveis e `dgt_fluxoestado` (histórico completo).
9. Como Administrador: **Cancelar registro** (motivo obrigatório) e, em
   *Editar dados do ambiente*, desativar/reativar o ambiente.

---

## Regras

| Regra | Como funciona |
|---|---|
| Quem cria ambientes | Somente o **Administrador** global. |
| Quem configura o fluxo | Quem edita fluxos em Processos → Fluxos (Editor/Administrador). |
| Quem vê o ambiente | Módulo `amb:<chave>` liberado — mesma regra dos módulos fixos (lista do usuário; sem lista, a liberação padrão do ambiente). Administrador vê todos. |
| Administrador do ambiente | "Administrador do módulo" em Usuários e acessos: vê a aba *Todos*, a *Configuração* e pode cancelar registros. |
| Chave do ambiente | Permanente (as liberações apontam para ela). Nome, ícone, ordem e liberação podem mudar. |
| Fluxo do ambiente | Novo ou existente. Pode ser trocado em *Configuração → Trocar fluxo*: registros em andamento terminam no fluxo em que começaram; os novos seguem o novo fluxo. Um fluxo pode ser usado por vários ambientes. |
| Fluxo feito para documentos | Pode ser usado. Etapas próprias de documentos (publicar, evento de revisão, anexar arquivo, editar documento, subprocesso) são ignoradas — o fluxo segue adiante — e a aba *Configuração* lista quais são. |
| Versão do fluxo | O registro segue a versão publicada **quando começou**. Uma nova versão vale para os próximos registros. |
| Responsáveis | "Autor da revisão" = quem abriu o registro; "Gestor da área" = gestores da área informada no registro. Os demais tipos funcionam como em Documentos. |
| Histórico | Nada é apagado: ambiente é desativado, registro é cancelado; o histórico do fluxo fica no registro. |
| Códigos | `<PREFIXO>-<ANO>-<0001>`, sequencial por ambiente e ano. |

> **Atenção à liberação "para todos":** como nos módulos fixos, ela vale para
> quem **não tem lista própria** de módulos. Usuários que já têm uma lista
> personalizada precisam receber o ambiente em Usuários e acessos.

---

## Avisos (Power Automate) — opcional

Fluxo "Nova etapa em ambiente":

- Gatilho: **Dataverse – Quando uma linha é adicionada ou modificada** ·
  tabela *Registros de Ambiente* · colunas de filtro `dgt_etapaatual`.
- **Analisar JSON** de `dgt_responsaveisetapa` (mesmo formato de
  `dgt_responsaveisjson` das pendências de documentos — ver `docs/fluxo-dataverse.md`).
- Envie e-mail/Teams com código (`dgt_codigo`), título (`dgt_name`), etapa e prazo.

---

## Limitações atuais

- Como nos fluxos de documentos, quem pode agir é verificado **no navegador**;
  a proteção dos dados é a das Security Roles. Use em piloto antes de
  restringir por Custom API.
- A aba *Aguardando você* lê o estado de cada registro em andamento; com
  centenas de registros abertos por ambiente, a próxima melhoria é filtrar
  por `dgt_responsaveisetapa` direto na consulta.
- O código sequencial é calculado no portal: dois registros criados no mesmo
  segundo no mesmo ambiente podem colidir (raro; o próximo segue normalmente).

---

## Telas configuráveis (modelo Arquitetura de Soluções)

Cada ambiente monta as telas a partir do fluxo, sem código novo:

| Tela | O que mostra | Configurável em *Personalizar telas* |
|---|---|---|
| **Visão geral** | Cards de resumo (contagem) que filtram a lista; lista de registros | **Visões**: nome, ícone, cor e filtro (aguardando você, meus, etapa(s), situação, prazo vencido, campo Lista/Sim-Não). **Colunas**: básicas e campos do fluxo, na ordem escolhida. Quem vê todos os registros. |
| **Registro** | Cabeçalho + **barra de etapas** (✓ concluída, atual, a fazer). Em **duas colunas** (padrão): à esquerda os dados do registro (nome, código, etapa, prazo, responsável, situação), **Ver fluxo** (desenho + histórico) e **Documentos relacionados**; à direita só os campos da etapa, o comentário e os botões. Clicar numa etapa mostra o que foi preenchido ou o que será pedido | **Disposição** (duas colunas / uma coluna), **Etapas**: quais aparecem, ordem e nome curto. Quadro “Campos preenchidos”, desenho aberto ao entrar e histórico. |

- Sem personalização, tudo é gerado do fluxo publicado: uma visão por etapa
  (até 4) + “Aguardando você” + “Concluídos”, colunas básicas e todas as etapas.
- Publicar uma nova versão do fluxo ajusta as telas sozinho: etapas removidas
  saem, etapas novas entram visíveis, colunas de campos removidos somem.
- Botões (Administrador ou administrador do ambiente): **Personalizar telas** e
  **Configuração** (fluxo vinculado, liberação, dados do ambiente).

### Colunas novas (rodar o script de novo)

`criar-tabelas-ambientes.ps1` acrescenta (só o que falta):

| Tabela | Coluna | Para quê |
|---|---|---|
| `dgt_ambiente` | `dgt_layoutjson` | configuração das telas |
| `dgt_ambienteregistro` | `dgt_etapaatualid` | filtro por etapa (mesmo se renomeada) |
| `dgt_ambienteregistro` | `dgt_valoresjson` | colunas e filtros por campo do fluxo |

Sem elas o ambiente funciona com as telas geradas do fluxo, mas não salva
personalizações nem mostra colunas/filtros de campos. Registros antigos passam a
ter etapa e valores na próxima ação do fluxo.

### Substituir um módulo programado (ex.: Arquitetura de Soluções)

| Parte da Arquitetura | Ambiente configurável |
|---|---|
| Visão geral com cards por etapa e lista | ✓ visões + colunas |
| Novo B.O.M. | ✓ “+ Novo(a) …” |
| Barra de etapas 1–5 clicável | ✓ etapas do fluxo |
| Dados da demanda (formulário) | ✓ campos da etapa (metadados) |
| Bloqueio no Go/No-Go | ✓ decisão no fluxo (caminho de reprovação) |
| Matriz Go/No-Go (pontuação calculada) | ⚠ tabela de critérios dá para registrar; o **cálculo automático** da nota ainda é código |
| Seleção de kit (montador de B.O.M.) e Cálculo de HH | ✗ telas especializadas — continuam no módulo programado |

Caminho sugerido: recriar o processo como ambiente para as etapas de formulário e
decisão, e numa próxima fase permitir que uma etapa use um **componente especial**
já existente (ex.: montador de B.O.M.) — assim o módulo programado pode ser
desligado quando todas as etapas estiverem cobertas.

---

## Excluir, desativar e recriar (fase de criação)

| Onde | O que faz |
|---|---|
| Ambiente → **Configuração → Excluir ambiente** | analisa e oferece **Desativar** (some do menu; registros ficam; dá para reativar) ou **Excluir definitivamente** (apaga o ambiente **e os registros**; digite a chave para confirmar). Opção de excluir junto o **processo/fluxo**, se só este ambiente o usa e não há documentos nele. |
| **+ Adicionar ambiente → Ambientes desativados** | **Reativar** ou **Excluir** ambientes desativados. |
| Processos → Fluxos → **⋮ → Remover** ou **Remover** no processo aberto | analisa: com **ambientes** usando o fluxo → bloqueia (exclua os ambientes ou troque o fluxo deles); com **documentos** → transferir; com **histórico de revisões** → arquivar; **sem nada ligado** → remover definitivamente (digite o código). |
| Editor do fluxo → **Descartar rascunho** / **Importar JSON** (substituir rascunho) | refazer só o fluxo, sem apagar o processo. |

Ciclo para recriar do zero: **Excluir ambiente** (marcando "excluir também o processo e o fluxo")
→ importar o pacote JSON de novo. A chave do ambiente e o código do processo ficam livres.

**Permissão necessária (Administradores):** privilégio **Excluir** em *Ambiente* e *Registro de
Ambiente* (e, para remover fluxos, nas tabelas do fluxo: Processo, Fluxo, Metadado do processo,
Tarefa e Histórico do fluxo). Recomendação: conceder **só ao perfil de Administradores** e, depois que
os ambientes estiverem em uso real, considerar retirar o Excluir de *Registro de Ambiente* — a partir
daí, use **Desativar** e **Cancelar registro**, que preservam o histórico.

---

## Anexos dos registros

**Ligar:** Editar ambiente → **Anexos** → *Permitir anexar arquivos nos registros* (opcional: a biblioteca
do SharePoint; vazio = **Documentos** do site do portal). Os arquivos ficam em
`<biblioteca>/Anexos de Ambientes/<chave do ambiente>/<código do registro>`.

**Por etapa:** no editor do fluxo, cada etapa tem **Anexo de arquivo nesta etapa**:

| Opção | No registro |
|---|---|
| Não | anexos só para **consulta** |
| Opcional | o responsável da etapa pode **incluir, substituir e remover** |
| Obrigatório | idem, e a etapa **só conclui com ao menos um anexo** (ações que dispensam campos, como Devolver, continuam liberadas) |

- O quadro **Anexos** fica na coluna da esquerda do registro (com nome, tamanho, quem alterou e quando).
- **Substituir** mantém o nome e guarda a versão anterior no **histórico de versões** do SharePoint;
  **Remover** manda para a **lixeira** (recuperável). Nada se perde.
- Registro concluído/cancelado: anexos só para consulta.
- **Permissão:** quem inclui anexos precisa de **edição** na biblioteca do SharePoint; quem só consulta,
  de leitura.
- **Colunas novas** (rodar o script de novo): `dgt_ambiente.dgt_permiteanexos` e `dgt_bibliotecaanexos`.

---

## Tela de execução da atividade

- **Painel esquerdo:** *Dados do documento* · *Histórico* (eventos já gravados no registro) · *Ver fluxo*
  (sempre recolhido ao abrir; mostra o desenho em largura total ao clicar).
- **Sequência de atividades no topo:** cartões compactos (concluída em verde, atual em destaque azul,
  a fazer em cinza), com rolagem horizontal quando não cabe.
- **Editar ambiente → Tela do registro → “Mostrar sequência de atividades no topo”**: ligada, a faixa
  aparece com o controle *Ocultar sequência / Mostrar sequência*; desligada, a faixa e o controle somem
  (o *Ver fluxo* continua no painel). Ambientes antigos, sem a opção salva, continuam mostrando.
  Coluna nova: `dgt_ambiente.dgt_mostrarsequencia` (rodar `criar-tabelas-ambientes.ps1`).

