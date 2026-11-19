# Notificações do fluxo

Duas formas de avisar pessoas durante um fluxo de processo:

| Onde | Como configurar | Quando envia |
|---|---|---|
| **Aba Notificações** da atividade (etapa com responsável) | Duplo clique na atividade → aba **Notificações** → **+ Nova notificação** | Quando a atividade **começa** ou quando é **concluída** (opcional: só para certos botões, ex.: *Reprovar*) |
| **Evento de notificação** (círculo com carta) | Paleta do editor → ícone de círculo com carta → ligar no fluxo → duplo clique | Quando o fluxo **passa** pelo evento (o fluxo não para) |

**Na atividade**, quem recebe são sempre os **responsáveis da atividade** (aba Responsáveis), por **e-mail**. A caixa **Notificar também via Teams** envia, além do e-mail, uma mensagem no chat do Teams de cada responsável. Se o responsável for uma área, recebem todas as pessoas com vínculo ativo na área (ou só os gestores, se o responsável estiver como "só gestores"), resolvidas na hora do envio.

**No evento de notificação**, os destinatários são escolhidos (autor da revisão, gestores da área, área, usuário, usuário de um metadado, e-mails adicionais), assim como os canais (**E-mail** e/ou **Teams**).

Marcadores aceitos no assunto e na mensagem: `{registro}` `{revisao}` `{etapa}` `{acao}` `{comentario}` `{executor}` `{prazo}` `{processo}` `{link}` `{campo:chave}`.

Responder o e-mail **não** executa a atividade: a ação é feita no portal, pelo link. Sugestão de rodapé: *"Não responda este e-mail; acesse o portal: {link}"*.

> Não escreva dados pessoais sensíveis (CPF, dados bancários etc.) nem senhas nas mensagens. Prefira código, título e etapa.

O aviso no canto da tela do portal para etapas pendentes continua funcionando como antes (vem de `dgt_tarefafluxo`).

## Como funciona — sem tabela nova

As notificações usam a **fila de e-mails que já existe** (`dgt_implemail`, a mesma do painel de Implantações). O portal grava **uma linha por destinatário e por canal**:

| Canal | `dgt_tipo` | `dgt_status` | Quem envia |
|---|---|---|---|
| E-mail | `notificacaoFluxo` | `Pendente` | O fluxo de e-mail **que já existe** (docs/implantacoes.md, seção 5) — **nenhuma alteração** |
| Teams | `notificacaoFluxo` | `PendenteTeams` | O fluxo novo **DGT - Notificações Teams** (abaixo) |

Demais colunas: assunto em `dgt_name`, destinatário em `dgt_para` (um endereço por linha), mensagem em HTML em `dgt_corpo`, chave do envio em `dgt_motivo` (o mesmo envio nunca é gravado duas vezes).

O fluxo de e-mail existente filtra `dgt_status eq 'Pendente'`, então **não pega** as linhas do Teams. Os relatórios das Implantações não são afetados.

- Se a gravação falhar, **a ação do fluxo não é desfeita**; o usuário vê um aviso na tela.
- No **modo de teste** (navegador) nada é enviado; o evento aparece só no histórico.
- Nenhuma credencial fica no portal: o envio usa as conexões do Power Automate.

## Implantação

### 1. Permissão na fila (Power Platform admin center → Ambiente → Configurações → Usuários + permissões → Funções de segurança)

Aba **Entidades personalizadas**, linha **E-mails de implantações** (`dgt_implemail`):

| Perfil | Criar | Ler | Gravar | Excluir |
|---|---|---|---|---|
| DGT Treinamentos – Colaboradores | **Usuário** | **Usuário** | — | — |
| DGT Treinamentos – Gestores | **Usuário** | **Usuário** | — | — |
| DGT Treinamentos – Administradores | **Usuário** | **Usuário** | — | — |

Ler no nível **Usuário** é necessário para o portal conferir se o envio já foi gravado (não duplicar). Com esse nível, cada pessoa só vê as linhas que ela mesma criou — os relatórios das Implantações continuam invisíveis para quem não é do painel. Não altere os privilégios que já existem para o painel de Implantações e para a conta de automação.

### 2. Fluxo do Teams — "DGT - Notificações Teams"

Crie dentro da solução **DGT – Portal de Conhecimento e Treinamentos** (Soluções → abrir → Novo → Automação → Fluxo da nuvem → Automatizado), com as conexões da **conta de automação**.

1. **Gatilho** — *Microsoft Dataverse → Quando uma linha é adicionada, modificada ou excluída*
   - Tipo de alteração: **Adicionado**
   - Nome da tabela: **E-mails de implantações**
   - Escopo: **Organização**
   - Filtrar linhas: `dgt_status eq 'PendenteTeams'`
2. **Microsoft Teams → Postar mensagem em um chat ou canal**
   - Postar como: **Flow bot**
   - Postar em: **Chat com o bot de fluxo**
   - Destinatário: `dgt_para` (do gatilho)
   - Mensagem: `<b>` + `dgt_name` + `</b><br>` + `dgt_corpo`
3. **Dataverse → Atualizar uma linha** — tabela *E-mails de implantações*, ID da linha: `dgt_implemailid` do gatilho
   - `dgt_status` = `Enviado`
4. **Ramo de falha** — outra *Atualizar uma linha*; nos três pontos → **Configurar execução após** → marque só **falhou** e **atingiu o tempo limite** (no passo 2)
   - `dgt_status` = `Falha`
   - `dgt_erro` = `outputs('Postar_mensagem_em_um_chat_ou_canal')?['body']`
5. **Salvar** e **Ativar**.

O fluxo de **e-mail** não precisa ser criado nem alterado.

### 3. Teste

1. Em **Processos**, abra o fluxo, dê duplo clique numa atividade → aba **Notificações** → **+ Nova notificação** → *Quando a atividade começar* → marque **Notificar também via Teams** → **Salvar** e **Publicar** a versão.
2. (Opcional) Arraste um **evento de notificação** (círculo com carta) para depois de uma atividade, ligue-o, dê duplo clique e configure; publique.
3. Comece uma revisão nova (a revisão segue a versão do fluxo em que começou) e avance até a atividade.
4. Confira em **E-mails de implantações**, filtrando `dgt_tipo = notificacaoFluxo`:
   - uma linha por responsável com `Pendente` e outra com `PendenteTeams`;
   - em segundos, todas com `Enviado`;
   - e-mail e mensagem no Teams recebidos pelo responsável.

## Possíveis erros

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| Aviso na tela: *sem permissão para gravar na fila de e-mails* | Perfil sem Criar/Ler em `dgt_implemail` | Ajuste o perfil (passo 1) |
| Aviso: *nenhum destinatário encontrado* | Responsável sem e-mail em `dgt_usuario` ou área sem membros | Preencha o e-mail do usuário / confira a área |
| Linha fica `Pendente` | Fluxo de e-mail das Implantações desligado | Ative-o (docs/implantacoes.md) |
| Linha fica `PendenteTeams` | Fluxo do Teams desligado ou filtro errado | Ative-o; confira `dgt_status eq 'PendenteTeams'` |
| Linha `Falha` | Conexão do Outlook/Teams expirada ou destinatário sem Teams | Veja `dgt_erro`; corrija e use **Reenviar** no histórico de execução do fluxo |
| Validação ao publicar o fluxo | Notificação ativa sem destinatário, canal, assunto ou mensagem | Complete a configuração indicada |
