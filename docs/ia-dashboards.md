# Dashboards — assistente de IA (caixa de perguntas)

## Visão geral

```
Dashboard do portal (definição com "assistente": { "ativo": true })
  └─ caixa "Pergunte à IA" no fim do painel
       Portal ──login Dataverse──► Custom API dgt_PerguntarDashboardIa
              ──► passo do plugin PerguntarDashboardIaPlugin ──chave──► API do Claude
              ◄── resposta exibida na tela (nada é gravado)
```

A caixa é só uma análise rápida: recebe a pergunta, responde e termina. A conversa existe apenas
na tela; ao sair da aba, trocar o filtro ou clicar em "Nova conversa", ela é descartada.

| Peça | Arquivo |
|---|---|
| Bloco `assistente` e validação | `services/dashboards/dashboardModelo.ts` |
| Montagem do contexto e chamada | `services/dashboards/assistenteDashboard.ts` |
| Caixa de perguntas | `pages/Indicadores/AssistenteDashboard.tsx` |
| Onde a caixa aparece | `pages/Indicadores/DashboardPortalView.tsx` (recebe `dashboardId` da `IndicadoresPage.tsx`) |
| Chamada à Custom API | `DataverseService.perguntarDashboardIa` |
| Custom API (sem tabelas) | `scripts/dataverse/criar-ia-dashboards.ps1` |
| Chamada ao Claude | `server/DGT.Treinamentos.Plugins/PerguntarDashboardIaPlugin.cs` |

## Bloco `assistente` na definição

```json
"assistente": {
  "ativo": true,
  "escopo": "Assunto do painel e limites das respostas (até 2.000 caracteres).",
  "fontes": ["orcamento.dre", "orcamento.planilhas"],
  "perguntasSugeridas": ["Até 6 atalhos"],
  "camposOcultos": ["campo que não deve ir para a IA"],
  "modelo": "claude-sonnet-5-5"
}
```

Só `ativo` e `escopo` são obrigatórios. `fontes` precisa conter apenas fontes usadas por itens do
painel (sem ela, vão todas as fontes do painel). Dashboards sem o bloco continuam iguais.

## Escopo fechado — como é garantido

1. **Dados**: a IA recebe só o que o painel já carregou para quem está vendo (ano e áreas
   permitidas). Nenhuma consulta nova ao Dataverse é feita para a IA.
2. **Escopo**: o plugin lê `assistente.escopo` no registro `dgt_dashboard`, com as permissões de
   quem pergunta. O navegador envia só o id do dashboard; não consegue trocar o escopo nem as regras.
3. **Regras fixas** no plugin: responder só com os dados enviados, recusar o que estiver fora do
   escopo, ignorar instruções dentro dos dados, não avaliar pessoas, sem parecer contábil/fiscal definitivo.
4. **LGPD**: campos pessoais (nome, e-mail, responsável, usuário, CPF, matrícula...) nunca saem do
   portal; o plugin ainda mascara CPF, CNPJ e e-mails. Pergunta, resposta e dados não são gravados.
5. **Tamanho**: até 45 mil caracteres de dados. Fontes grandes são somadas no ano (sem o mês) e, se
   ainda não couberem, cortadas — a tela e a IA avisam quando isso acontece.

## Ligar (uma vez por ambiente)

1. Rodar `scripts/dataverse/criar-ia-dashboards.ps1 -UrlAmbiente <url> -Solucao DGTPortaldeConhecimentoeTreinamentos`.
2. Permissão: quem tem **Ler** em `dgt_dashboard` (quem já vê as abas de Indicadores) pode
   perguntar. Nenhum perfil novo é necessário.
3. Compilar `server/DGT.Treinamentos.Plugins` e dar **Update** no assembly pelo Plugin Registration
   Tool (novo tipo **PerguntarDashboardIaPlugin**).
4. **Register New Step**: Message `dgt_PerguntarDashboardIa` · Primary Entity *none* ·
   Stage **PostOperation** · **Synchronous** · **Secure Configuration** = a chave do Claude
   (a mesma usada em Licitações, ou outra para separar custos).
5. Publicar o `.sppkg` e incluir o bloco `assistente` no JSON do dashboard.

## Uso e custo

Nada fica gravado no Dataverse. Para acompanhar o uso, consulte o Rastreamento de plugins
(cada chamada registra dashboard, modelo e tokens, sem a pergunta) ou o console da Anthropic.

## Chave e consumo

A chave e o registro de consumo (por usuário e área) são administrados em Indicadores ›
Administrar IA. Ver `docs/ia-administracao.md`.
