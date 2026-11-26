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

## Páginas (abas) — painéis curtos, como no Power BI

Cada seção pode ter `"pagina": "Nome da aba"` (até 40 caracteres). Seções com a mesma página
aparecem juntas numa aba; seção sem `pagina` fica na página da anterior. Sem nenhuma `pagina`, o
painel continua numa tela só. Com mais de uma página e o `assistente` ativo, a IA ganha a aba
**✦ Pergunte à IA** (a conversa se mantém ao navegar entre as abas e enxerga os dados de todas).

Para manter a ordem natural das linhas (ex.: DRE), use `"ordenar": "nenhum"` na tabela ou gráfico.

Exemplo completo: `docs/dashboards/exemplos/controladoria.json` (também em "Usar exemplo").

## Fontes dos módulos (Treinamentos, Ambientes, Licitações, Fornecedores, Projetos)

`treinamentos.atribuicoes`, `treinamentos.trilhas`, `treinamentos.avaliacoes`, `treinamentos.certificados`,
`documentos.tarefas`, `ambientes.registros`, `licitacoes.editais`, `fornecedores.documentos` e
`projetos.atividades` (em `services/dashboards/fontesDashboard.ts`, testadas em `fontesModulos.test.ts`).

Regra de área: treinamentos pela(s) área(s) do usuário (`dgt_usuarioarea`, a linha se repete em cada área);
tarefas pela área do documento; ambientes pela área do registro; licitações pela área de sigla LIC;
fornecedores e projetos não têm área (só aparecem para quem vê todas as áreas).

Permissões: quem vê o painel precisa de **Ler** nas tabelas de origem no nível que cobre o time
(ex.: Unidade de Negócios ou Organização para gestores). Com nível "Usuário", o gestor só enxerga os
próprios registros e o painel fica incompleto.

## Ano em que o painel abre (`filtros.anoPadrao`)

`"atual"`, `"proximo"` ou um ano. Sem ele: painéis só de orçamento abrem no ano seguinte a partir de julho;
os demais, no ano atual. As fontes de treinamento usam a data da atribuição (ou de criação, quando vazia)
e consideram "ativo" vazio como ativo, igual ao restante do portal.

## Gráficos legíveis e edição na tela

- Rótulos do eixo se ajustam sozinhos (`rotulos: auto`): inclinam (-40°) ou ficam na vertical quando não
  cabem, e a margem cresce para o texto não ser cortado. Valores aparecem sobre as barras quando há poucas.
- Novo tipo `barrasHorizontais` (nomes completos à esquerda; empilha com `serieDimensao`).
- ✎ em cada gráfico e tabela: título, tipo, nomes no eixo, valores, ordem, quantidade, altura e largura.
  Quem gerencia dashboards clica em **Salvar no dashboard**; os demais veem o ajuste só na tela.

## Filtros da tela: período e campos

```json
"filtros": { "ano": true, "area": true, "periodo": true, "campos": ["status", "tipo", "responsavel"] }
```

- `periodo`: "de mês / até mês" no topo; filtra as fontes que têm `mes` (linhas sem mês saem num período parcial).
- `campos` (até 4, só campos de texto das fontes do painel): listas com os valores existentes nos dados; filtram
  todas as fontes que têm o campo. Fontes sem o campo não são afetadas.
- Só na consulta (não alteram o salvo) e valem também para a IA do painel. "Limpar filtros" volta ao total.

## Documentos: campos novos

- `documentos.documentos`: `processo`, `criadoEm`, `mes` (mês do prazo da próxima revisão) e `mesCadastro`.
- `documentos.revisoes` (em andamento): `processo`, `etapa`, `situacaoFluxo`, `motivo`, `retreinamento`,
  `dataAbertura` e `mes` (mês de abertura). Responde "revisões pendentes por responsável/etapa".
- `documentos.historicoRevisoes` (nova): todas as revisões abertas no ano, com `aprovada`, `aprovador`,
  `dataAprovacao`, `dataVigencia`, `mesAprovacao` e `diasAteAprovar` (ciclo de revisão).

## Tamanho dos visuais

- Os gráficos são desenhados no tamanho real do espaço (largura medida na tela): as letras têm sempre o
  mesmo tamanho; muda o espaço entre as barras. Nomes do eixo: horizontais, inclinados (≥ 24 px por
  categoria) ou verticais, conforme couberem. Valores zero não são escritos (aparecem ao passar o mouse).
- Grade de 12 colunas: `larguraGrade` 3–12 (6 = meia linha) e `alturaPx` 160–800 (prioridade sobre
  `largura`/`altura`, que continuam valendo). Em telas estreitas (< 900 px) cada visual ocupa a linha inteira.
- Na tela: alça ◢ no canto de cada gráfico/tabela (arrastar) e deslizantes de Largura e Altura no ✎.

## Áreas por fonte (Administrador do módulo)

Quem não vê todas as áreas (Administrador do portal ou do módulo Indicadores) vê só as áreas de que participa —
**exceto nas fontes dos módulos que administra**, onde vê todas, como no próprio módulo
(`services/dashboards/acessoFontes.ts`). Ex.: a Controladoria, Administradora do Planejamento orçamentário,
vê o orçamento de todas as áreas, e continua vendo só a CTL em treinamentos ou documentos.

| Fonte | Módulo |
|---|---|
| orcamento.* | orcamento |
| documentos.* | documentos |
| treinamentos.* | treinamentos |
| licitacoes.* | licitacoes |
| fornecedores.* | fornecedores |

O Dataverse continua valendo: o perfil de segurança precisa permitir ler as planilhas de todas as áreas
(o mesmo que a página de Planejamento orçamentário já exige para o Administrador do módulo).

