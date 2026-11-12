# Implantações — painel de gestão de implantações

Carteira, cronogramas (G1–G5), físico x financeiro, Controladoria, Painel PMO,
equipes de campo, roteirização e assistente IA, dentro do Portal DGT.

Origem: aplicativo `painel-projetos` (HTML + JavaScript, servidor Python com
login e base em arquivos JSON). No portal:

| Antes (aplicativo) | Agora (portal) |
|---|---|
| `login.html`, usuários, setores, perfis e histórico próprios | Módulo **Implantações** em Usuários e acessos + perfil no portal |
| `tools/servidor.py` + pasta `dados/` | Tabela `dgt_implregistro` no Dataverse |
| Assistente com `ANTHROPIC_API_KEY` no servidor | Custom API `dgt_AnalisarLicitacaoIa` (mesma chave da IA de Licitações) |
| Relatório semanal por SMTP (`tools/relatorio.py`) | Fila `dgt_implemail` + fluxo do Power Automate |

Ordem de implantação: **1. tabelas → 2. permissões → 3. pacote → 4. importação
→ 5. fluxo de e-mail → 6. IA**.

---

## Arquivos

| Peça | Arquivo |
|---|---|
| Página do painel | `pages/Implantacoes/ImplantacoesPage.tsx` |
| Ambiente (shadow root, document/window de fachada) | `services/implantacoes/AmbientePainel.ts` |
| Código do painel (JS puro) | `pages/Implantacoes/legado/painelApp.js` |
| Estilos e estrutura do painel | `pages/Implantacoes/legado/painelCss.ts`, `painelHtml.ts` |
| Conteúdo dos e-mails | `pages/Implantacoes/legado/painelEmails.js` |
| Base de dados (API de documentos → Dataverse) | `services/implantacoes/BaseImplantacoes.ts` |
| Sessão e permissões | `services/implantacoes/permissoesImplantacoes.ts` |
| Rotas `api/*` do painel | `services/implantacoes/PonteApiImplantacoes.ts` |
| Assistente IA | `services/implantacoes/AssistenteImplantacoes.ts` |
| E-mails (configuração, fila, recorrência) | `services/implantacoes/RelatorioImplantacoes.ts` |
| Nomes das tabelas | `services/implantacoes/esquemaImplantacoes.ts` |
| Bibliotecas de PDF, Excel e mapa (npm, sob demanda) | `services/implantacoes/BibliotecasPainel.ts` |
| Tabelas | `scripts/dataverse/criar-tabelas-implantacoes.ps1` |

O painel é desenhado **no fluxo normal da página do portal** (uma só barra de
rolagem, a do portal), dentro de uma **shadow root** que isola os estilos dele dos
do portal (`services/implantacoes/AmbientePainel.ts`). O painel recebe um
`document` e um `window` de fachada: `body`, `head`, `querySelector` e os eventos
apontam para a shadow root; rolagem, tamanhos, `location` e bibliotecas são os da
janela real. Eventos, temporizadores e animações que ele registra são desfeitos ao
sair da página. As telas do painel ficam no endereço da página (`#painel`, `#pmo`,
`#g3`…), então links diretos funcionam; ao sair, o `#…` é retirado.

Visual: tema claro com a paleta do portal (azul-marinho `#063654`, azul `#0878d1`,
ciano `#11c9df`, fundo `#f5f8fb`, Segoe UI). O tema escuro do painel original foi
retirado. As cores de situação (fora do prazo, em atraso, no prazo) continuam
vermelho, laranja e verde, porque carregam significado. O CSS original é convertido
na geração (`:root`/`html` → `:host`, `body` → `[data-implbody]`) e o tema do
portal vai no fim de `legado/painelCss.ts`.

Os arquivos `.js` são JavaScript puro de propósito (o TypeScript do SPFx compila
para ES5 e quebraria `Set`, `Map` e `...` desse código); eles são copiados para
`lib/` por `config/typescript.json` (`includeGlobs`).

## 1. Tabelas

```powershell
.\scripts\dataverse\criar-tabelas-implantacoes.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao NOME_DA_SOLUCAO
```

| Tabela | Para que serve |
|---|---|
| `dgt_implregistro` | Um documento do painel por linha: `dgt_balde` (projeto, `_root` = dados gerais), `dgt_colecao`, `dgt_chave`, `dgt_chaveunica` (chave alternativa), `dgt_dados` (JSON), `dgt_excluido` |
| `dgt_implemail` | Fila de e-mails: assunto (`dgt_name`), `dgt_para`, `dgt_corpo` (HTML), `dgt_tipo`, `dgt_motivo`, `dgt_status` (Pendente / Enviado / Falha), `dgt_erro` |

A chave alternativa é ativada em segundo plano: confira o status **Ativo** antes
de usar. Nada é apagado pela tela (exclusão = `dgt_excluido`).

## 2. Permissões

- Perfis de segurança: **Criar, Ler, Gravar** (Organização) em `dgt_implregistro`
  e **Criar** em `dgt_implemail` para quem usa o módulo, sem Excluir. O fluxo de
  e-mail (conta de serviço) precisa **Ler e Gravar** em `dgt_implemail`.
- Usuários e acessos: liberar o módulo **Implantações**. Padrão: só Administrador.

| Perfil no portal | No painel |
|---|---|
| Colaborador (Funcionário) | Consulta: carteira, projetos e físico x financeiro (sem PMO, campo e assistente) |
| Editor / Gestor | Opera tudo: projetos, faturamento, PMO, equipes de campo, assistente |
| Administrador ou **Administrador do módulo** | Tudo, mais **E-mails e relatórios** e a importação |

Como no restante do portal, a tela organiza o acesso; a proteção dos dados é a
Security Role. A regra fica em `permissoesImplantacoes.ts`.

## 3. Pacote

Build e publicação normais do portal (README, seção 11). O menu ganha
**Implantações** para quem tem o módulo.

## 4. Importação dos dados

Com a tabela vazia, o Administrador do módulo vê **Importar os dados do painel
antigo**: selecione todos os `.json` da pasta `dados/` do aplicativo (sem a
pasta `_resgate` e sem `_seq.json`). A importação só cria o que não existe e
pode ser repetida. Enquanto a base estiver vazia o painel não abre (aberto vazio,
ele criaria um projeto padrão por cima dos dados).

## 5. Fluxo de e-mail (Power Automate) — 1 fluxo

O portal só grava cada e-mail em `dgt_implemail` (status `Pendente`). Quem envia
é **um único fluxo automatizado**, com as conexões da **conta de automação**:

1. Gatilho (Dataverse): **Quando uma linha é adicionada, modificada ou excluída**
   — tipo de alteração *Adicionado*, tabela *E-mails de implantações*, escopo
   *Organização*, linhas de filtro `dgt_status eq 'Pendente'`.
2. **Office 365 Outlook › Enviar um email (V2)** com a conexão da conta de
   automação: Para = `dgt_para`, Assunto = `dgt_name`, Corpo = `dgt_corpo`
   (o corpo já é HTML completo; Importância normal).
3. Dataverse **Atualizar uma linha** (mesma linha, `dgt_implemailid` do gatilho):
   `dgt_status` = `Enviado`.
4. Ramo de falha (Configurar execução após = *falhou* / *atingiu o tempo limite*
   no passo 2): **Atualizar uma linha** com `dgt_status` = `Falha` e `dgt_erro` =
   a mensagem de erro do passo 2 (`outputs('Enviar_um_email_(V2)')?['body']`).

A conta de automação precisa: licença com Exchange (caixa de correio) e, no
Dataverse, Ler e Gravar em *E-mails de implantações*. Se os e-mails tiverem de
sair de outro endereço (ex.: implantacao@), troque o passo 2 por **Enviar um
email de uma caixa de correio compartilhada (V2)** e dê à conta de automação
permissão "Enviar como" nessa caixa.

Envios (Configurações › **E-mails e relatórios**, Administrador do módulo):

| Envio | Conteúdo |
|---|---|
| Relatório semanal | Cada pessoa recebe as próprias pendências |
| Resumo gerencial | Pendências por pessoa, projetos com mais atrasos, ações vencidas |
| Cronograma para cliente e equipe | Situação do cronograma de cada projeto; o cliente recebe só o do próprio projeto, sem link |

Cada envio tem **recorrência** (diária, semanal, quinzenal ou mensal + hora),
destinatários (perfis do portal, pessoas e e-mails avulsos), **Prévia**,
**Enviar teste para mim** e **Enviar agora**.

**Como a recorrência dispara:** não há servidor sempre ligado. Quem estiver com o
painel aberto (Editor, Gestor ou Administrador) confere a cada 5 minutos se um
envio venceu hoje; a primeira pessoa cria a trava `relatorioEnvios/<tipo-data-hora>`
(chave alternativa) e só ela enfileira. Se ninguém abrir o painel no dia, o envio
daquele dia não acontece. Para garantir o horário, a alternativa é um fluxo
agendado do Power Automate (pendência registrada).

## 6. Assistente IA

Usa a Custom API da IA de Licitações (`docs/ia-licitacoes.md`) — a mesma chave,
na Configuração segura do passo `AnalisarLicitacaoIaPlugin`. Quem usa precisa
de **Criar** em *Análise de IA de licitação*. Modelo: `claude-sonnet-5-5`.

Como esse plugin recebe texto e devolve texto, as consultas do assistente
(panorama, detalhe de projeto, busca de atividades) rodam no navegador: a IA pede
`CONSULTAR: {...}`, o portal executa e devolve o resultado (até 4 rodadas).
Contatos (e-mail/telefone) de stakeholders **não** vão para a IA.

## 7. Agenda de campo — período

Ao programar por **período**, com os pontos distribuídos entre os dias, a ordem
dos pontos é a rota mais curta saindo da DGT (vizinho mais próximo + 2-opt, a
mesma da Roteirização), cortada em trechos seguidos: cada dia fica numa mesma
região. Pontos sem coordenadas na Vistoria vão para o fim, na ordem da lista.

## 8. Stakeholders

Contato separado em **E-mail** e **Telefone**. Cadastros antigos (campo único
`contato`) são lidos assim: o que parece e-mail vai para o e-mail, o resto para o
telefone. O campo `contato` continua gravado (`e-mail · telefone`) por
compatibilidade.

## 9. Exportações e mapa (bibliotecas)

PDF (jsPDF + AutoTable), Excel (ExcelJS) e o mapa da Roteirização (Leaflet) vêm do
npm, dentro do pacote do portal, em arquivos separados que só são baixados no
primeiro uso (`implantacoes-pdf`, `implantacoes-excel`, `implantacoes-mapa`). O
painel original baixava do cdnjs, o que não funciona no SharePoint (o carregador
de módulos AMD da página "captura" essas bibliotecas).

O SheetJS saiu (versão do npm desatualizada e com falha de segurança): a
exportação Excel da Controladoria usa o ExcelJS, e a importação da vistoria lê
`.xlsx` (ExcelJS) e `.csv` (separador `;` ou `,`, UTF-8 ou Windows-1252).
**Arquivos `.xls` (Excel 97-2003) não são mais aceitos.**

Depois de atualizar o código: `npm install` (novas dependências fixas: `jspdf`
4.2.1, `jspdf-autotable` 5.0.9, `exceljs` 4.4.0, `leaflet` 1.9.4 e, para
desenvolvimento, `@types/leaflet` 1.9.12).

## 10. Tela cheia

Botão com duas setas no canto do cabeçalho do painel (ao lado do assistente):
o painel ocupa a tela inteira, com o cabeçalho preso no topo ao rolar. Esc ou o
mesmo botão saem. Não guarda preferência.
