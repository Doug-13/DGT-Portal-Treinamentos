---
name: criador-processos-dgt
description: Gera o "pacote de processo" (JSON no formato dgt-portal/pacote-processo@1) que o Portal DGT importa para criar de uma vez o processo, os campos (metadados), o fluxo BPMN e, opcionalmente, o ambiente no menu com as telas configuradas. Use SEMPRE que o usuário pedir para "criar um processo/fluxo no portal", "desenhar o fluxo de X", "gerar o JSON do processo", "montar um ambiente para Y", "criar o fluxo de aprovação de Z", ou descrever um processo (etapas, aprovações, responsáveis, campos) que deva virar fluxo no Portal de Conhecimento e Treinamentos da DGT — mesmo sem citar JSON. Também use para AJUSTAR um pacote exportado do portal.
---

# Criador de processos do Portal DGT

Você transforma a descrição de um processo num **pacote JSON** que o portal importa em
Processos → Fluxos → **Importar JSON**. Antes de escrever, leia
`references/pacote-processo.md` (formato completo) e veja os exemplos em
`references/exemplos/`.

## 1. Entender o processo (perguntas curtas, só o que faltar)

1. Nome e **código** do processo (ex.: `COM-SOL`) e a **sigla da área** dona.
2. É um **documento controlado** (POP, IT, auditoria, plano de ação — tem revisão,
   publicação, vigência) ou uma **solicitação/pedido** (compras, licitações, demandas)?
   - Documento → **sem** `ambiente`. Pode usar `statusDocumento`, `anexoArquivo`,
     `tarefaSistema` de publicação e `subprocesso`.
   - Solicitação → **com** `ambiente` (item no menu, telas). **Não** use subprocesso,
     publicação, evento de revisão nem anexo do documento.
3. Etapas na ordem, **quem faz cada uma** e os **botões** (aprovar, devolver…).
4. Os **dados** a preencher e em qual etapa; quais são obrigatórios.
5. Decisões (ex.: "acima de R$ 50 mil vai para a diretoria") e devoluções.
6. Prazos (dias úteis) por etapa.

Se o usuário já deu as informações, não pergunte de novo: assuma o razoável e diga o que assumiu.

### O que gerar

- **Processo novo de solicitação** → `processo` + `metadados` + `fluxo` + `ambiente` (cria tudo).
- **Processo de documento** → `processo` + `metadados` + `fluxo` (sem `ambiente`).
- **Ambiente para um fluxo que já existe no portal** → só `ambiente`, com
  `"fluxo": "<CÓDIGO do processo>"` (pergunte o código; se o usuário não souber, omita e
  ele escolhe na importação). As `telas.etapas` usam os ids das etapas desse fluxo
  (peça o JSON exportado dele, se precisar).

## 2. Montar o JSON

- `"formato": "dgt-portal/pacote-processo@1"` sempre.
- Declare **todos** os campos em `metadados` primeiro; nas etapas, `campos` usa só a `chave`
  (+ `obrigatorio`, `somenteLeitura`, `mostrarQuando`...).
- Chaves em **camelCase sem acento** (`valorTotal`); ids de elementos curtos (`aprovarGestor`).
- Responsáveis: prefira `autorRevisao`, `gestorArea`, `cargoArea` (`origemArea: "documento"`) e
  `campoUsuario`, que funcionam em qualquer empresa. Use `area` (sigla) e `usuario` (e-mail) só
  com valores que o usuário informou — nunca invente siglas ou e-mails.
- Toda etapa com mais de um botão: dê um `resultado` diferente a cada botão e crie um caminho
  (`quando.resultado`) para cada um. Devoluções levam `"excecao": true`.
- **Etapa → decisão: SEM `quando`.** A ligação da etapa para uma decisão é sempre "qualquer botão";
  quem separa os botões são os caminhos que SAEM da decisão. (Um `quando.resultado` nessa ligação
  impede os outros botões de chegarem à decisão — o portal corrige e avisa, mas evite.)
- Decisão (`gateway`): um caminho por condição + **um** caminho `"padrao": true`.
  Condição por campo só com `simNao`, `lista`, `texto`, `numero` ou `data`.
- Não informe `posicao` nem `pontos`: o portal desenha sozinho.
- Campo que só aparece em certa situação: `exibirQuando: { campo, valor }` **no metadado** (não na etapa).
- Avaliação/pontuação por critérios (Go/No-Go, qualificação, matriz de risco): use um metadado
  `tipo: "avaliacao"` com critérios, pesos e faixas; decida caminhos pela faixa
  (`quando: { campo, valor: <chave da faixa> }`).
- `subprocesso.fluxo` = código de um processo que **já existe** no portal (ou que será importado
  antes — diga a ordem ao usuário).
- Ambiente: `prefixoCodigo` curto (2–6 letras), `rotuloRegistro` no singular, 3–6 `visoes`
  úteis (sempre "Aguardando você"), `etapas` com rótulos curtos.

### Telas personalizadas (campo `componente`)

- Seleção de kit / B.O.M. → `{ "tipo": "nativo", "nativo": "montadorBom" }`.
- Cálculo de HH sobre o kit → `{ "tipo": "nativo", "nativo": "calculoHH", "parametros": { "campoKit": "<chave do montadorBom>" } }`
  (veja `references/exemplos/pacote-arquitetura-bom.json`, o processo completo da Arquitetura).
- Tela nova → `{ "tipo": "html", "html": "...", "fontes": [...] }`. Siga o contrato de
  `references/componentes.md`: use só `DGT.aoIniciar`, `DGT.consultar(fonte, { coluna: valor })`
  e `DGT.alterar({ dados, valido, erros, resumo, itens })`; nada de `fetch`, cookies ou bibliotecas
  externas; estilos com as variáveis `--dgt-*`; reabra a tela a partir de `contexto.dados`;
  respeite `contexto.somenteLeitura`; libere em `fontes` só as colunas que a tela usa.

### Script (consulta banco/API e preenche campos)

- Use `{ "tipo": "tarefaSistema", "acaoSistema": "executarScript", "script": {...} }` (contrato em
  `references/scripts.md`). Só `DGT.http` (HTTPS, endereços em `hostsPermitidos`), `DGT.consultar`
  (fontes liberadas) e `DGT.log`; devolva `{ valores, mensagem }` ou `{ erro }` para bloquear.
- Declare em `camposSaida` cada campo que o script preenche; para decidir pelo resultado, ponha uma
  decisão depois do script por um desses campos (ex.: `cepEncontrado`). O script tem uma só saída.

### Assinatura digital (Clicksign)

- `{ "tipo": "tarefaSistema", "acaoSistema": "assinaturaDigital", "assinatura": {...} }` — contrato em
  `references/assinatura-digital.md`. Só usuários da DGT como signatários (campo `usuario` do processo
  ou e-mail cadastrado). `documento`: `arquivoRevisao` (documentos) ou `anexosRegistro` (ambientes).
- Uma única saída. Para tratar recusa/expiração, declare um metadado `lista` com as opções
  `assinado; recusado; expirado; cancelado`, use-o em `campoSituacao` e ponha uma decisão depois.

## 3. Conferir antes de entregar

- [ ] Um `inicio`, ao menos um `fim`, todo elemento alcançável e com saída (menos `fim`).
- [ ] Todo `de`/`para` existe em `elementos`; todo campo de etapa existe em `metadados`.
- [ ] `lista` tem `opcoes`; `tabela` tem `colunas`.
- [ ] Nenhuma etapa sem `responsaveis`; nenhuma etapa com dois botões de mesmo `resultado`.
- [ ] Decisões com ≥ 2 caminhos e no máximo um `padrao`; ligação etapa → decisão sem `quando`.
- [ ] Ambiente só em processo de solicitação (não de documento).

## 4. Entregar

Entregue o JSON num arquivo `<codigo>.pacote.json` e diga ao usuário:
1. Processos → Fluxos → **Importar JSON** → escolher o arquivo → **Validar**.
2. Conferir o resumo; marcar **Publicar** (se não houver pendências) e **Criar o ambiente**.
3. Revisar o desenho no editor e liberar o ambiente em Usuários e acessos.

Para ajustar um processo existente: peça o arquivo de **Exportar JSON**, altere e devolva —
o portal cria uma nova versão (rascunho) sem perder as anteriores.
