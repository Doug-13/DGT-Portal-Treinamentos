# Pacote de processo (JSON) — `dgt-portal/pacote-processo@1`

Um único JSON descreve um processo completo. O portal **valida**, mostra o que
será criado e **importa**: processo → campos → fluxo (rascunho ou publicado) →
ambiente com telas (opcional).

- **Importar:** Processos → Fluxos → **Importar JSON** (ou “+ Adicionar ambiente” → **Importar JSON**).
- **Atualizar um processo aberto:** no editor do fluxo → **Importar JSON**. O JSON é aplicado
  **neste** processo (o `processo` do JSON é ignorado e pode faltar): campos novos são criados,
  os existentes podem ser **atualizados** (rótulo, opções, colunas, avaliação, ajuda — nunca o tipo),
  e o fluxo vira um novo rascunho (substitui o rascunho atual, se marcado). Nenhum campo é apagado.
  **Exportar JSON** no editor exporta a versão selecionada (salve o rascunho antes).
- **Exportar:** no processo aberto → **Exportar JSON**; na Configuração do ambiente → **Exportar pacote JSON**.
- Exemplos completos e testados: `docs/exemplos/` (o build roda testes com eles).

## Estrutura

```json
{
  "formato": "dgt-portal/pacote-processo@1",
  "processo":  { "codigo": "QUA-PDA", "nome": "Plano de ação", "descricao": "...", "area": "QUA" },
  "metadados": [ ...campos do processo... ],
  "fluxo":     { "elementos": [ ... ], "transicoes": [ ... ] },
  "ambiente":  { ...opcional... }
}
```

## O que cada combinação cria

| O JSON tem | O portal cria |
|---|---|
| `processo` + `fluxo` + `ambiente` | **tudo**: processo, campos, fluxo (rascunho/publicado), ambiente no menu ligado a esse fluxo, telas |
| `processo` + `fluxo` | processo, campos e fluxo (ex.: **documentos** — POP, auditoria, plano de ação) |
| `processo` + `ambiente` (sem `fluxo`) | processo e campos + ambiente; na importação você **escolhe o fluxo** do ambiente: o do processo (desenhar depois) ou um **fluxo existente** |
| só `ambiente` | só o ambiente, com um **fluxo existente** (`ambiente.fluxo` = código) ou escolhido na tela; sem escolha, cria um fluxo novo vazio |
| só `processo` | processo e campos (o fluxo é desenhado depois) |

Exemplos: `pacote-solicitacao-compra.json` (tudo), `pacote-plano-de-acao.json` e
`pacote-auditoria.json` (documentos), `pacote-ambiente-fluxo-existente.json` (só ambiente).

O fluxo do ambiente pode ser trocado depois em **Configuração → Trocar fluxo**.

## Regras gerais

| Regra | Detalhe |
|---|---|
| Sem ids internos | Áreas pela **sigla**, pessoas pelo **e-mail**, outros fluxos pelo **código do processo**. |
| Chaves | `metadados[].chave`, colunas e `acoes[].chave` em **camelCase sem acento**, começando com minúscula (`valorEstimado`). |
| Ids de elementos | Curtos e únicos (`solicitar`, `aprovarGestor`). São usados em `transicoes` e nas telas do ambiente. |
| Posições | **Opcionais.** Sem `posicao`, o desenho é montado sozinho (da esquerda para a direita, retornos por baixo). |
| Processo existente | Se o código já existir, ele é **usado** (nome e área não mudam) e o fluxo entra como **novo rascunho**. |
| Campos existentes | Campos com a mesma chave são **mantidos**; mesma chave com **tipo diferente** = erro. |
| Nada é apagado | Um rascunho existente só é substituído se o usuário marcar a opção. |

## `processo`

| Campo | Obrig. | Descrição |
|---|---|---|
| `codigo` | ✓ | 2–30 caracteres: letras, números, `.`, `-` (ex.: `COM-SOL`). Maiúsculas. |
| `nome` | ✓ | Nome do processo. |
| `descricao` | | Texto livre. |
| `area` | | Sigla da área dona do processo. |

## `metadados` (campos do processo)

```json
{ "chave": "urgencia", "rotulo": "Urgência", "tipo": "lista", "opcoes": ["Normal", "Alta"], "ajuda": "..." }
```

| `tipo` | Uso | Extras |
|---|---|---|
| `texto` / `textoLongo` | texto curto / longo | |
| `numero` | número | |
| `data` | data (`AAAA-MM-DD`) | |
| `simNao` | Sim / Não (valores `sim` / `nao`) | |
| `lista` | uma opção | `opcoes` (obrigatório) |
| `usuario` | pessoa da plataforma | |
| `area` | área | |
| `documento` / `documentos` | documento(s) referenciado(s) | |
| `tabela` | linhas | `colunas` (obrigatório) |
| `avaliacao` | matriz de critérios com nota, peso e faixas (Go/No-Go) | `avaliacao` (obrigatório) |
| `componente` | tela personalizada: nativa (ex.: Montador de B.O.M.) ou HTML isolado | `componente` (obrigatório) — ver `docs/componentes.md` |

### Avaliação (`tipo: "avaliacao"`)

Critérios com nota (escala com cores vermelho → verde), peso, pontuação e **faixas** (sinaleira).
A faixa atingida pode decidir o caminho do fluxo e filtrar visões do ambiente.

```json
{
  "chave": "goNoGo", "rotulo": "Matriz Go/No-Go", "tipo": "avaliacao",
  "avaliacao": {
    "criterios": [
      { "chave": "aderencia", "rotulo": "Aderência ao portfólio", "descricao": "Compatibilidade com nossas soluções", "peso": 20 },
      { "chave": "tecnica", "rotulo": "Viabilidade técnica", "peso": 20 },
      { "chave": "prazo", "rotulo": "Prazo", "peso": 10 }
    ],
    "escala": { "minimo": 1, "maximo": 5, "rotulos": ["Muito desfavorável", "Desfavorável", "Aceitável", "Favorável", "Muito favorável"] },
    "calculo": "ponderada",
    "faixas": [
      { "chave": "go", "rotulo": "GO", "minimo": 80, "cor": "#107C10" },
      { "chave": "restricao", "rotulo": "GO com restrição", "minimo": 60, "cor": "#B45309" },
      { "chave": "nogo", "rotulo": "NO-GO", "minimo": 0, "cor": "#B42318" }
    ],
    "justificativaAte": 2
  }
}
```

| Campo | Regra |
|---|---|
| `criterios` | ≥ 1; `chave` camelCase única; `peso` > 0 |
| `escala` | inteiros, `minimo` ≥ 0, `maximo` até 10; `rotulos` opcionais, um por nota |
| `calculo` | `ponderada` = 0 a 100 (pesos viram %); `soma` = soma de nota × peso |
| `faixas` | chave camelCase, nome, `minimo` (pontos) e cor; **uma faixa com `minimo` 0** é obrigatória. Vale a de maior mínimo atingido |
| `justificativaAte` | opcional: justificativa obrigatória para notas ≤ este valor |

No fluxo: `{ "de": "decisao", "para": "bloqueado", "quando": { "campo": "goNoGo", "valor": "nogo" } }`
(o `valor` é a **chave da faixa**). Nas etapas, `campos: [{ "chave": "goNoGo", "obrigatorio": true }]`
exige nota em todos os critérios. Em visões do ambiente: `{ "tipo": "campo", "campo": "goNoGo", "valores": ["nogo"] }`.

### Componente (`tipo: "componente"`)

```json
{ "chave": "selecaoKit", "rotulo": "Seleção de kit", "tipo": "componente",
  "componente": { "tipo": "nativo", "nativo": "montadorBom", "parametros": { "campoCanal": "canal" } } }
```

```json
{ "chave": "itensExtras", "rotulo": "Itens extras", "tipo": "componente",
  "componente": {
    "tipo": "html",
    "html": "<div id=\"app\"></div><script>DGT.aoIniciar(function (c) { /* ... */ });</script>",
    "fontes": [{ "nome": "itens", "tabela": "dgt_kititem", "colunas": ["dgt_codigo", "dgt_name", "dgt_categoria"], "filtroFixo": "dgt_ativo eq true", "ordem": "dgt_ordem asc" }],
    "altura": 520
  } }
```

Nativos disponíveis: `montadorBom` (parâmetros `campoCanal`, `canal`) e `calculoHH`
(parâmetros `campoKit` — obrigatório, chave do campo do `montadorBom` —, `campoCusto` — campo `numero` —
e `exigirCusto`: `sim`/`nao`). Exemplo completo: `docs/exemplos/pacote-arquitetura-bom.json`. O contrato do HTML (ponte `DGT.*`) está em `docs/componentes.md`.
Componente **não** pode ser usado em condição de caminho.

Colunas de `tabela`: `{ "chave", "rotulo", "tipo", "obrigatoria"?, "opcoes"? }` com
`tipo` em `texto, textoLongo, numero, data, simNao, lista, usuario, documento, documentos, area`.

### Regra de exibição do campo (`exibirQuando`)

Definida no **metadado** (vale em todas as etapas que exibem o campo):

```json
{ "chave": "justificativa", "rotulo": "Justificativa", "tipo": "textoLongo",
  "exibirQuando": { "campo": "exigeRetreinamento", "valor": "nao" } }
```

O campo da condição deve ser `simNao` (`sim`/`nao`), `lista` (uma das opções), `texto`, `numero` ou `data`.
Na etapa, use só o modo (`obrigatorio`, `somenteLeitura`); se o campo for obrigatório na etapa, ele é
exigido apenas quando aparece. Prefira `exibirQuando` no metadado a `mostrarQuando`/`obrigatorioQuando`
na etapa (formato antigo, ainda aceito).

## `fluxo.elementos`

Todo fluxo tem **um** `inicio` e ao menos um `fim`.

| `tipo` | O que é | Campos próprios |
|---|---|---|
| `inicio` / `fim` | começo / fim | — |
| `tarefaHumana` | etapa com responsável | `responsaveis`, `acoes`, `campos`, `prazoDiasUteis`, `instrucoes`, `statusDocumento`, `anexoArquivo`, `permiteEditarDocumento` |
| `gateway` | decisão (o caminho sai pelas condições das transições) | — |
| `tarefaSistema` | ação automática de documento | `acaoSistema` |
| `eventoRevisao` | nova revisão do documento | `tipoRevisao`, `removerArquivo` |
| `subprocesso` | cria documentos em outro fluxo | `subprocesso` |

### Etapa (`tarefaHumana`)

```json
{
  "id": "aprovarGestor", "tipo": "tarefaHumana", "nome": "Aprovação do gestor",
  "instrucoes": "Confira valor e justificativa.",
  "prazoDiasUteis": 2,
  "responsaveis": [{ "tipo": "gestorArea" }],
  "campos": [
    { "chave": "valorTotal", "somenteLeitura": true },
    { "chave": "observacao", "obrigatorio": true, "mostrarQuando": { "campo": "urgencia", "valor": "Alta" } }
  ],
  "acoes": [
    { "chave": "aprovar", "rotulo": "Aprovar", "resultado": "aprovado" },
    { "chave": "devolver", "rotulo": "Devolver", "resultado": "devolvido", "exigeComentario": true }
  ]
}
```

- **`campos`**: só a `chave` do metadado é obrigatória — rótulo, tipo, opções e colunas vêm dele.
  Opcionais: `obrigatorio`, `somenteLeitura`, `ajuda`, `mostrarQuando`, `obrigatorioQuando`
  (`{ campo, valor }`) e `validarNosResultados` (ex.: `["aprovado"]`: só exige ao aprovar).
- **`acoes`**: botões da etapa. Sem `acoes` = um botão **Concluir** (`resultado: "concluido"`).
  `resultado` é o que as transições testam. Extras: `principal`, `exigeComentario`,
  `dispensaCampos` (ex.: devolver sem preencher), `mensagemConfirmacao`.
- **`statusDocumento`** (documentos): `Elaboração`, `Revisão`, `Aprovação`, `Vigente`.
- **`anexoArquivo`** (documentos): `nao`, `opcional`, `obrigatorio`.

### Responsáveis

| `tipo` | Quem | Extras |
|---|---|---|
| `autorRevisao` | quem abriu (registro de ambiente) / autor da revisão (documento) | — |
| `gestorArea` | gestores da área do registro/documento | — |
| `area` | pessoas de uma área | `area` (sigla), `somenteGestores` |
| `cargoArea` | cargo numa área | `cargo` (ex.: `Diretor`), `area` (sigla) **ou** `origemArea`: `documento` / `autor` |
| `nivelHierarquico` | nível acima | `nivel` (1 = chefe imediato), `area` ou `origemArea` |
| `usuario` | uma pessoa | `email` |
| `campoUsuario` | a pessoa escolhida num campo | `campo` (chave de metadado `usuario`) |

### Ação automática (`tarefaSistema`, só documentos)

`acaoSistema`: `assinaturaDigital` (assinatura Clicksign — ver `docs/assinatura-digital.md`; signatários: `{ "origem": "campo", "campo": "<metadado usuario>" }` ou `{ "origem": "usuario", "email": "..." }`), `executarScript` (script — ver `docs/scripts.md`; também em ambientes), `publicarComRetreinamento`, `publicarSemRetreinamento`, `novaRevisao`,
`novaSubRevisao`, `proximaRevisao`, `removerArquivoRevisao`.

### Subprocesso (só documentos)

```json
{
  "id": "abrirAcoes", "tipo": "subprocesso", "nome": "Abrir planos de ação",
  "subprocesso": {
    "fluxo": "QUA-PDA",
    "origem": "tabela", "campoTabela": "constatacoes",
    "filtroLinhas": { "coluna": "conforme", "valores": ["nao"] },
    "campoReferencias": "acoesAbertas",
    "tipoDocumento": "PDA",
    "titulo": "{pai.codigo} — NC {n}: {coluna:descricao}",
    "autor": "coluna:responsavel",
    "aguardar": "todos",
    "mapeamentos": [
      { "origem": "coluna:prazo", "destino": "prazo" },
      { "origem": "pai:referencia", "destino": "auditoriaOrigem" }
    ]
  }
}
```

| Campo | Valores |
|---|---|
| `fluxo` | **código** de um processo que **já existe** no portal (importe-o antes) |
| `origem` | `tabela` (um documento por linha) ou `unico` |
| `campoTabela` | chave do metadado `tabela` (com `origem: tabela`) |
| `filtroLinhas` | opcional: `{ coluna, valores }` — coluna `lista` ou `simNao` |
| `campoReferencias` | chave de um metadado `documentos` deste processo |
| `tipoDocumento` | sigla do tipo (ex.: `PDA`) |
| `area` | sigla; vazio = área do documento pai |
| `titulo` | marcadores `{pai.codigo}`, `{pai.titulo}`, `{n}`, `{coluna:x}`, `{campo:x}` |
| `autor` | `executor`, `autorPai` ou `coluna:<chave de coluna usuario>` |
| `aguardar` | `nao` (segue) ou `todos` (espera todos os filhos concluírem) |
| `mapeamentos` | `origem`: `coluna:x`, `campo:x`, `pai:referencia`, `pai:codigo`, `pai:titulo` → `destino`: chave de metadado do fluxo filho |

## `fluxo.transicoes` (caminhos)

```json
{ "de": "aprovarGestor", "para": "limite", "quando": { "resultado": "aprovado" } }
{ "de": "limite", "para": "aprovarDiretoria", "quando": { "campo": "acimaDoLimite", "valor": "sim" }, "rotulo": "Sim" }
{ "de": "limite", "para": "comprar", "rotulo": "Não", "padrao": true }
{ "de": "aprovarGestor", "para": "solicitar", "quando": { "resultado": "devolvido" }, "excecao": true }
```

| Campo | Uso |
|---|---|
| `de`, `para` | ids de elementos |
| `quando` | omitido = sempre; `{ "resultado": "x" }` = botão com esse resultado; `{ "campo": "x", "valor": "y" }` = valor de campo |
| `padrao` | caminho usado quando nenhuma condição bate (decisões) |
| `excecao` | **retorno/devolução** (volta para trás); desenhado por baixo |
| `rotulo` | texto no desenho |

> **Etapa → decisão sem `quando`.** A ligação de uma etapa para uma decisão deve ser "qualquer botão":
> a decisão é quem separa os botões. Se o JSON trouxer `quando.resultado` nessa ligação e a decisão tratar
> outros botões da etapa, a importação **corrige para "qualquer botão" e avisa**.

### Regras para PUBLICAR (as mesmas do botão Publicar do editor)

Se alguma falhar, o pacote ainda pode ser importado como **rascunho**; o portal lista o que corrigir.

- Todo elemento (menos `fim`) tem **ligação de saída** e é **alcançável a partir do `inicio`**.
- Toda etapa tem **responsável** e **ações**; duas ações da mesma etapa não podem ter o **mesmo `resultado`**.
- `prazoDiasUteis` entre 0 e 365.
- **Decisão** (`gateway`): pelo menos **dois caminhos**, no máximo **um `padrao`**, e os demais com condição.
- Caminho com `quando.resultado` precisa do resultado; com `quando.campo` precisa do `valor`.
- Condição por campo **não** pode usar campo `tabela`, `usuario`, `documento(s)` ou `area`
  (use `simNao`, `lista`, `texto`, `numero` ou `data`).
- `subprocesso` e `eventoRevisao` têm **uma** saída (para escolher caminhos, ponha uma decisão depois).
- Campos usados nas etapas e em `mostrarQuando` precisam existir em `metadados`.

## `ambiente` (opcional)

Cria um item no menu, ligado a este fluxo, com telas configuradas.
**Use ambiente para solicitações/pedidos (não são documentos).** Fluxos com
`subprocesso`, publicação ou revisão são de **documentos**: deixe sem `ambiente`.

```json
{
  "nome": "Compras", "chave": "compras", "icone": "package",
  "prefixoCodigo": "COM", "rotuloRegistro": "Solicitação",
  "subtitulo": "Da solicitação ao pedido emitido.",
  "liberadoParaTodos": true, "perfisPadrao": [],
  "telas": {
    "visoes": [
      { "nome": "Aguardando você", "icone": "bell", "cor": "#B45309", "filtro": { "tipo": "aguardandoVoce" } },
      { "nome": "Em aprovação", "icone": "checkCircle", "cor": "#6B4FBB", "filtro": { "tipo": "etapas", "etapas": ["aprovarGestor"] } }
    ],
    "colunas": ["codigo", "titulo", "campo:valorTotal", "etapa", "prazo", "situacao"],
    "etapas": [{ "id": "solicitar", "rotulo": "Solicitação" }, { "id": "aprovarGestor", "rotulo": "Gestor" }],
    "registro": { "mostrarDados": true, "mostrarDiagrama": false, "mostrarHistorico": true },
    "lista": { "todosVeemTodos": false }
  }
}
```

| Campo | Valores |
|---|---|
| `chave` | minúsculas e hífen; permanente. Vazio = gerada do nome. |
| `fluxo` | **só em pacote sem `fluxo`**: código de um processo existente cujo fluxo o ambiente usa. Omitido = escolher na tela. |
| `icone` | `workflow, gavel, fileText, folder, building, package, wallet, users, checkCircle, barChart, grid, layers, settings, search, megaphone, activity, bell, clock, alertTriangle` |
| `prefixoCodigo` | 2–6 letras/números maiúsculos (códigos `COM-2026-0001`) |
| `perfisPadrao` | `Funcionario`, `Editor`, `Gestor` |
| `telas.visoes[].filtro.tipo` | `todos`, `aguardandoVoce`, `meus`, `atrasados`, `etapas` (`etapas: [ids]`), `situacao` (`situacoes: emAndamento/concluido/cancelado`), `campo` (`campo`, `valores`: campo lista/simNao) |
| `telas.visoes[].cor` | `#0F6CBD` azul, `#B45309` laranja, `#B42318` vermelho, `#6B4FBB` roxo, `#107C10` verde, `#0E7490` ciano, `#64748B` cinza |
| `telas.colunas` | `codigo, titulo, etapa, prazo, situacao, solicitante, area, criadoEm` ou `campo:<chave>` |
| `telas.etapas` | ids das etapas humanas, na ordem da barra; `rotulo` curto; `visivel: false` esconde |

Sem `telas`, as telas são geradas do fluxo. O ambiente ainda precisa ser **liberado
em Usuários e acessos** (ou use `liberadoParaTodos` / `perfisPadrao`).

## Ordem de importação com subprocesso

O fluxo chamado pelo subprocesso precisa existir antes: importe primeiro o
**Plano de ação** (`pacote-plano-de-acao.json`), depois a **Auditoria**
(`pacote-auditoria.json`).
