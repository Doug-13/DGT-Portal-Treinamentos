# Fluxo de revisão por processo — implantação no Dataverse

Este guia coloca em produção o fluxo configurável de revisão documental:
processos com fluxo (BPMN) e metadados, documentos vinculados a processos,
revisões que seguem as etapas, pendências e histórico — tudo gravado no
Dataverse.

Ordem: **1. tabelas → 2. permissões → 3. pacote do portal → 4. teste → 5. avisos (Power Automate)**.

---

## 1. Criar as tabelas e colunas

### Opção A — script (recomendado)

Pré-requisitos: PowerShell 7 (ou Windows PowerShell 5.1) e acesso de
**Personalizador do Sistema** (ou Administrador do Sistema) no ambiente.

1. Descubra a **URL do ambiente**: Power Apps → engrenagem → *Detalhes da sessão* → *URL da instância*
   (ex.: `https://suaorg.crm2.dynamics.com`).
2. Descubra o **nome da solução**: Power Apps → *Soluções* → coluna **Nome**
   (não é o nome de exibição "DGT – Portal de Conhecimento e Treinamentos").
3. Na pasta do projeto:

```powershell
cd scripts\dataverse
.\criar-tabelas-fluxo.ps1 -UrlAmbiente https://suaorg.crm2.dynamics.com -Solucao NOME_DA_SOLUCAO
```

Na primeira vez o script instala o módulo `Az.Accounts` e abre o login da
Microsoft. Ele pode ser executado de novo: o que já existe é mantido.
Ao final ele publica as personalizações.

Se aparecer *"execução de scripts desabilitada"*:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` e rode de novo.

### Opção B — manual (Power Apps → Soluções → sua solução → Novo)

Statuses são **texto**, não Opção (Choice). Em lookups, o nome entre
parênteses é o **nome de esquema** (com maiúscula); ao salvar, o Power
Apps gera o nome lógico em minúsculas.

| Tabela | Colunas (além de `dgt_name`, texto 200) |
|---|---|
| **dgt_fluxo** — Fluxo | `dgt_Processo` (Pesquisa → Processo) · `dgt_versao` (Número inteiro) · `dgt_situacao` (Texto 20) · `dgt_definicaojson` e `dgt_bpmnxml` (Várias linhas de texto, 1.048.576) · `dgt_modelo` (Texto 100) · `dgt_publicadoem`, `dgt_arquivadoem` (Data e hora) |
| **dgt_processometadado** — Metadado do Processo | `dgt_Processo` (Pesquisa) · `dgt_chave` (100) · `dgt_tipo` (20) · `dgt_ordem` (Inteiro) · `dgt_opcoesjson`, `dgt_colunasjson` (Várias linhas, 100.000) · `dgt_ajuda` (500) · `dgt_ativo` (Sim/Não) |
| **dgt_tarefafluxo** — Pendência do Fluxo | `dgt_chave` (150) · `dgt_DocumentoRevisao` (Pesquisa → Revisão) · `dgt_Fluxo` (Pesquisa → Fluxo) · `dgt_etapaid` (100) · `dgt_etapanome` (200) · `dgt_situacao` (20) · `dgt_responsaveisjson` (Várias linhas, 100.000) · `dgt_prazo`, `dgt_concluidaem` (Data e hora) · `dgt_ConcluidaPor` (Pesquisa → Usuário) · `dgt_acaorotulo` (200) |
| **dgt_historicofluxo** — Histórico do Fluxo | `dgt_chave` (150) · `dgt_DocumentoRevisao`, `dgt_Fluxo` (Pesquisa) · `dgt_etapaid`, `dgt_acaochave` (100) · `dgt_etapanome`, `dgt_acaorotulo`, `dgt_executadopornome` (200) · `dgt_resultado` (100) · `dgt_comentario` (Várias linhas, 10.000) · `dgt_ExecutadoPor` (Pesquisa → Usuário) · `dgt_sistema` (Sim/Não) · `dgt_dataevento` (Data e hora) |
| dgt_processo | + `dgt_Area` (Pesquisa → Área) |
| dgt_documentoprocesso | + `dgt_principal` (Sim/Não) |
| dgt_documentorevisao | + `dgt_Fluxo` (Pesquisa → Fluxo) · `dgt_etapaatual` (100) · `dgt_situacaofluxo` (20) · `dgt_estadofluxojson` (Várias linhas, 1.048.576) |

Depois: **Publicar todas as personalizações**.

> O portal grava os vínculos documento × processo usando os lookups já
> existentes de `dgt_documentoprocesso` com os nomes de esquema
> `dgt_Documento` e `dgt_Processo`. Se o seu ambiente usa outro nome de
> esquema, ajuste `DOCUMENTO_PROCESSO` em `esquemaFluxo.ts`.

---

## 2. Permissões (perfis de segurança)

Power Platform admin center → ambiente → *Configurações* → *Usuários + permissões* →
*Perfis de segurança*. Em cada perfil, aba **Entidades personalizadas**:

| Tabela | Colaboradores | Gestores | Administradores / Editores |
|---|---|---|---|
| dgt_fluxo | Ler (Org.) | Ler (Org.) | Todos (Org.) |
| dgt_processometadado | Ler (Org.) | Ler (Org.) | Todos (Org.) |
| dgt_processo, dgt_documentoprocesso | Ler (Org.) | Ler (Org.) | Todos (Org.) |
| dgt_tarefafluxo | Criar, Ler, Gravar, Acrescentar (Org.) | idem | Todos (Org.) |
| dgt_historicofluxo | Criar, Ler, Acrescentar (Org.) | idem | Criar, Ler, Acrescentar (Org.) |
| dgt_documentorevisao | + Gravar e **Acrescentar a** (Org.) | idem | Todos |
| dgt_usuario | + **Acrescentar a** (Org.) | idem | — |

- **Ninguém** deve ter *Excluir* em `dgt_historicofluxo` (trilha de auditoria).
- "Acrescentar a" é o que permite um registro apontar (lookup) para outro.
- Quem executa etapas precisa gravar a revisão porque o estado do fluxo fica nela.

---

## 3. Pacote do portal

Em `src/webparts/portalTreinamentosWebPart/constants/featureFlags.ts`:

```ts
FLUXO_CONFIGURAVEL_TESTE: true,
FLUXO_PERSISTENCIA: 'dataverse'   // 'local' volta ao modo de teste
```

```powershell
Remove-Item -Recurse -Force lib, lib-commonjs, temp -ErrorAction SilentlyContinue
npm run build
```

Envie o `.sppkg` ao Catálogo de Aplicativos e abra o portal com **Ctrl+F5**.

> Os dados criados no **modo de teste** (navegador) não são migrados.
> Recrie no Dataverse os processos e fluxos que quiser manter
> (dica: *Exportar .bpmn* no modo de teste e *Importar .bpmn* no Dataverse).

---

## 4. Roteiro de teste

1. **Processos → Novo processo**: código, nome e **área**.
2. Aba **Metadados**: crie os campos (ex.: "Exige retreinamento?" Sim/Não).
3. Aba **Fluxo de revisão**: *Criar fluxo* (modelo POP ou em branco) → duplo clique nas
   etapas → defina **responsáveis reais** (Autor da revisão, Gestor da área do documento,
   Área específica ou Usuário), botões, campos e caminhos → *Verificar fluxo* → *Publicar*.
4. **Documentos → Novo documento**: escolha a área e o **processo**.
5. No documento, aba **Revisão**: crie a revisão. Os botões antigos dão lugar ao aviso
   *"Esta revisão segue o fluxo do processo"*.
6. Aba **Fluxo de revisão**: a etapa atual mostra **quem pode agir** (nomes reais).
   Execute com cada responsável (outro navegador/usuário) até a publicação.
7. Confira no Dataverse: `dgt_documentorevisao` (etapa, situação, estado),
   `dgt_tarefafluxo` (pendências), `dgt_historicofluxo` (ações) e o status do documento.
8. **Documentos (início)** → painel *Minhas pendências* → grupo
   *"Etapas do fluxo aguardando você"*.

---

## 5. Avisos e prazos (Power Automate)

### Fluxo A — "Nova pendência do fluxo"

- Gatilho: **Dataverse – Quando uma linha é adicionada** · tabela *Pendências do Fluxo* · escopo *Organização*.
- **Analisar JSON** de `dgt_responsaveisjson` (lista de `{ descricao, usuarioId?, areaId?, somenteGestores? }`).
- Para cada item:
  - com `usuarioId` → *Obter linha* em **Usuários (dgt_usuario)** → e-mail;
  - com `areaId` → *Listar linhas* em **dgt_usuarioarea** filtrando a área
    (e perfil Gestor quando `somenteGestores` = true) → e-mails dos usuários.
- Envie e-mail (Outlook) ou mensagem no Teams com: etapa (`dgt_etapanome`), documento (`dgt_name`),
  prazo (`dgt_prazo`) e o link do portal.

### Fluxo B — "Pendências vencidas" (agendado, diário)

- *Listar linhas* em **Pendências do Fluxo** com filtro
  `dgt_situacao eq 'pendente' and dgt_prazo lt @{utcNow()}`.
- Para cada uma: avise os responsáveis (mesma lógica do Fluxo A) e, se quiser, o gestor da área.

---

## Limitações atuais

- As regras de quem pode agir são verificadas **no navegador**; a próxima etapa leva o
  motor do fluxo para uma **Custom API** (plugin em `server/DGT.Treinamentos.Plugins`),
  para que o Dataverse recuse ações de quem não é responsável. Até lá, use em **piloto**.
- Responsáveis do tipo **Grupo, Função e Setor** ainda não são aceitos na publicação
  (não há vínculo desses cadastros com os usuários).
- No modo de teste continuam existindo os usuários simulados e o "Reiniciar simulação";
  no Dataverse não há reinício: o histórico é preservado.
