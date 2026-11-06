# Campo "Componente" — telas personalizadas dentro de uma etapa

Para etapas com tela muito específica (ex.: **Seleção de kit / B.O.M.**). Dois formatos,
o mesmo contrato com o fluxo:

| Formato | Para quê | Onde vive |
|---|---|---|
| **Nativo** | telas prontas e testadas do portal (ex.: Montador de B.O.M.) | código do portal |
| **HTML** | telas novas sem novo deploy (ex.: geradas por IA) | configuração do campo (Dataverse) |

Configurar: **Processos → Fluxos → Metadados →** novo campo do tipo **Componente** → escolher
Nativo ou HTML → **Pré-visualizar** → colocar o campo na etapa (ex.: "Seleção de kit") → publicar.

## Contrato com o fluxo (os dois formatos)

O valor do campo é um **envelope** JSON:

```json
{ "dados": {...}, "valido": true, "erros": [], "resumo": "1 ponto(s) · 11 itens", "itens": [ { "codigo": "3100050082", "descricao": "Câmera...", "quantidade": 2, "categoria": "camera" } ] }
```

- **`valido: false`** (ou qualquer `erro`) **bloqueia o Concluir** da etapa; os erros aparecem abaixo da tela.
- `resumo` aparece em listas, histórico e colunas de ambiente.
- `itens` é a lista gerada (B.O.M.), disponível para as etapas seguintes.
- O valor é gravado pelo fluxo (Salvar / botões da etapa), como qualquer campo.

## Nativo: Montador de B.O.M.

A **mesma tela** de Seleção de kit da Arquitetura (pontos, estrutura, câmeras, switch,
soluções, kit gerado), com o catálogo e a composição da **aba Kits**. Parâmetros:
- **Campo com o canal** (opcional): mostra Público/Privado do registro no cabeçalho.
- **Canal fixo**: se não houver campo.

Erros do montador (ex.: Wallfix com mais de 2 câmeras) bloqueiam a etapa. Assim a
Arquitetura de Soluções pode virar um **ambiente** com fluxo: Dados da demanda → Matriz
Go/No-Go (campo **Avaliação**) → **Seleção de kit (Componente nativo)** → …

## Nativo: Cálculo de HH

A **mesma tela** da etapa "Cálculo de HH" da Arquitetura, ligada à Seleção de kit do registro:
aplica o HH da **versão vigente** de cada área (menu Cálculo de HH) aos pontos do kit — HH dos
pontos e alocação de Analista de Projetos e Suprimentos sobre o custo total.

| Parâmetro | Uso |
|---|---|
| **Campo com a Seleção de kit** (obrigatório) | o campo Componente do **Montador de B.O.M.** de uma etapa anterior |
| **Campo com o custo total** (opcional) | campo Número do registro; sem ele, o custo é digitado na tela e gravado junto |
| **Custo obrigatório** | `sim` exige a alocação de horas para concluir |

- Grava o resultado **e qual versão de HH foi usada** (id, número, mês) — em etapas seguintes
  (somente leitura) aparece o que foi gravado, mesmo que uma versão nova de HH seja publicada depois.
- Bloqueia o Concluir se: o kit não tem pontos ou tem erros, não há HH publicado, ou o custo é
  obrigatório e não foi informado.

## A Arquitetura inteira como ambiente

`docs/exemplos/pacote-arquitetura-bom.json` monta o processo completo, pronto para publicar:
Dados da demanda → **Matriz Go/No-Go** (Avaliação; NO-GO vai para "Bloqueado") → **Seleção de kit**
(Montador de B.O.M.) → **Cálculo de HH** → **B.O.M. pronto** (aprovação), com o ambiente
"Arquitetura (B.O.M.)", visões (Aguardando você, Em Go/No-Go, Em montagem do kit, NO-GO, B.O.M.
prontos) e a barra de etapas. Importe em Processos → Fluxos → **Importar JSON** e teste em paralelo
com o módulo atual antes de trocar.

## HTML personalizado

O HTML (com `<style>` e `<script>`) roda **isolado** num `iframe` com `sandbox="allow-scripts"`
e **sem** `allow-same-origin`: ele **não acessa** o login do usuário, os cookies, a página do
portal nem o Dataverse diretamente. Tudo passa pela **ponte**:

```js
DGT.aoIniciar(function (contexto) {
  // contexto.dados          → o que este componente gravou antes (envelope.dados)
  // contexto.somenteLeitura → true em etapas concluídas / sem permissão
  // contexto.valores        → outros campos do registro (ex.: contexto.valores.canal)
  // contexto.tema           → cores DGT
});

DGT.consultar('itens', { dgt_categoria: 'camera' })   // Promise com as linhas
  .then(function (linhas) { /* [{ dgt_codigo, dgt_name, ... }] */ });

DGT.alterar({ dados: {...}, valido: true, erros: [], resumo: '...', itens: [...] });
DGT.ajustarAltura();   // opcional: a altura também é medida sozinha
```

- **Fontes de dados** (na configuração do campo): `nome` usado em `DGT.consultar`, `tabela`
  (nome lógico, ex.: `dgt_kititem`), **colunas liberadas**, filtro fixo OData e ordenação.
  O componente só pode filtrar por **igualdade** nessas colunas e recebe **só** essas colunas.
- **Somente leitura**: o componente não grava nada no Dataverse; só devolve o envelope.
- Cores DGT em variáveis CSS: `--dgt-azul`, `--dgt-ciano`, `--dgt-verde`, `--dgt-ambar`,
  `--dgt-vermelho`, `--dgt-borda`, `--dgt-texto2`, `--dgt-fundo`, `--dgt-fonte`.
- **Modelo de exemplo** (botão no cadastro): lista os itens da aba Kits (`dgt_kititem`) com
  busca e quantidade — ponto de partida para telas próprias.

Tabelas da aba Kits: `dgt_kititem` (dgt_codigo, dgt_name, dgt_chave, dgt_categoria, dgt_tipo,
dgt_atributos, dgt_ativo, dgt_ordem), `dgt_kitkit` (dgt_chave, dgt_name, dgt_maxcameras,
dgt_aceitaocr, dgt_modelo, dgt_ativo, dgt_ordem), `dgt_kitcomposicao` (dgt_kit, dgt_itemchave,
dgt_quantidade, dgt_regra, dgt_condicao, dgt_ativo).

### Atenção: política de scripts do SharePoint (CSP)

O SharePoint Online pode restringir scripts embutidos em páginas. **Teste o modelo de exemplo
no seu ambiente primeiro** (Pré-visualizar). Se a tabela não carregar e o console do navegador
mostrar erro de *Content Security Policy*, o formato HTML precisará de um ajuste de
hospedagem (arquivo numa biblioteca do SharePoint) — o formato **nativo** não é afetado.
