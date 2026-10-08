# Indicadores do ClickUp na plataforma — Fase 1: dados

Esta fase traz as tarefas do ClickUp para o Dataverse, substituindo as
consultas do Power BI "BI - Clickup V3". As telas (Executivo e Visão
Geral) vêm nas próximas fases e leem a tabela `dgt_clickuptarefa`.

```
ClickUp API ──(fluxo Power Automate, a cada 1 h)──► Custom API dgt_SincronizarClickUp
                                                    └► dgt_clickuptarefa (1 linha por tarefa)
```

O **token do ClickUp fica somente no fluxo** (variável de ambiente). Ele
nunca vai para o portal, para o código ou para o Dataverse.

---

## 1. Atualizar o assembly de plugins

1. Compile: `cd server\DGT.Treinamentos.Plugins` e `dotnet build -c Release`.
2. Plugin Registration Tool → conecte no ambiente → selecione o assembly
   **DGT.Treinamentos.Plugins** → **Update** → aponte para
   `bin\Release\net462\DGT.Treinamentos.Plugins.dll` → marque o novo tipo
   **SincronizarClickUpPlugin** → **Update Selected Plugins**.

Não é preciso registrar *steps*: o plugin é acionado pela Custom API.

## 2. Criar as tabelas e a Custom API

```powershell
cd scripts\dataverse
Unblock-File .\criar-estrutura-clickup.ps1
.\criar-estrutura-clickup.ps1 -UrlAmbiente https://SUAORG.crm2.dynamics.com -Solucao NOME_EXCLUSIVO_DA_SOLUCAO
```

Cria `dgt_clickuptarefa`, `dgt_metaindicador`, a coluna `dgt_area.dgt_tagclickup`
e a Custom API `dgt_SincronizarClickUp`. Se aparecer o aviso de que o
plugin ainda não está registrado, faça o passo 1 e rode o script de novo.

## 3. Permissões (Funções de segurança)

| Função | dgt_clickuptarefa | dgt_metaindicador |
|---|---|---|
| Funcionário / Gestor / Editor | Ler (Organização) | Ler (Organização) |
| Administrador | Criar, Ler, Gravar (Organização) | Criar, Ler, Gravar, Excluir (Organização) |
| Conta dona do fluxo | Criar, Ler, Gravar (Organização) | — |

A Custom API exige **Gravar em dgt_clickuptarefa** para ser chamada.

## 4. Variáveis de ambiente (na solução)

Power Apps → Soluções → *DGT – Portal de Conhecimento e Treinamentos* →
**Novo → Mais → Variável de ambiente**:

| Nome de exibição | Nome | Tipo | Valor |
|---|---|---|---|
| ClickUp - Token | `dgt_ClickUpToken` | **Segredo** (Azure Key Vault) ou Texto | o **novo** token gerado no ClickUp |
| ClickUp - Workspace | `dgt_ClickUpWorkspaceId` | Texto | id do workspace (Team) |
| ClickUp - Space | `dgt_ClickUpSpaceId` | Texto | id do space |
| ClickUp - Lista do Cronograma | `dgt_ClickUpListaCronogramaId` | Texto | id da lista "Cronograma Geral" |

Os ids estão na consulta do Power BI (`WorkspaceId`, `SpaceId` e
`IdCronogramaGeral`). Se a variável do token for do tipo **Texto**,
restrinja quem pode editar a solução e o fluxo: qualquer *maker* da
solução consegue ler o valor. O tipo **Segredo** guarda o token no Azure
Key Vault e é o recomendado.

## 5. Criar o fluxo "DGT - Sincronizar ClickUp"

Na mesma solução: **Novo → Automação → Fluxo de nuvem → Agendado**.

**Gatilho — Recorrência:** a cada **1 hora**.

**Inicializar variável** (três ações):

| Nome | Tipo | Valor |
|---|---|---|
| `pagina` | Inteiro | `0` |
| `continuar` | Booleano | `true` |
| `ids` | Matriz | `[]` |

**Fazer até** (*Do until*): condição `continuar` **é igual a** `false`.
Em *Alterar limites*: Contagem `200`, Tempo limite `PT1H`.

Dentro do *Fazer até*, nesta ordem:

**a) HTTP** (renomeie para `HTTP_ClickUp`)
- Método: `GET`
- URI: `https://api.clickup.com/api/v2/team/@{parameters('ClickUp - Workspace (dgt_ClickUpWorkspaceId)')}/task`
- Consultas:
  - `space_ids[]` = variável de ambiente *ClickUp - Space*
  - `subtasks` = `true`
  - `include_closed` = `true`
  - `page` = variável `pagina`
- Cabeçalhos: `Authorization` = variável de ambiente *ClickUp - Token*
- **Configurações da ação → Entradas seguras: Ativado** (o token não
  aparece no histórico de execuções).

**b) Dataverse → Executar uma ação não associada** (renomeie para `Gravar_Pagina`)
- Nome da ação: `dgt_SincronizarClickUp`
- PayloadJson (expressão):
  ```
  concat('{"acao":"pagina","listaCronogramaId":"', parameters('ClickUp - Lista do Cronograma (dgt_ClickUpListaCronogramaId)'), '","resposta":', string(body('HTTP_ClickUp')), '}')
  ```

**c) Selecionar** (*Select*, renomeie para `Ids_da_Pagina`)
- De: `body('HTTP_ClickUp')?['tasks']`
- Mapa (clique em "modo texto"): `item()?['id']`

**d) Compor** (renomeie para `Ids_Acumulados`)
- Entradas: `union(variables('ids'), body('Ids_da_Pagina'))`

**e) Definir variável** `ids` = `outputs('Ids_Acumulados')`

**f) Definir variável** `continuar` =
```
and(not(equals(body('HTTP_ClickUp')?['last_page'], true)), greater(length(coalesce(body('HTTP_ClickUp')?['tasks'], json('[]'))), 0))
```

**g) Incrementar variável** `pagina` em `1`.

**Depois do *Fazer até*** — **Dataverse → Executar uma ação não associada** (`Finalizar`):
- Nome da ação: `dgt_SincronizarClickUp`
- PayloadJson: `concat('{"acao":"finalizar","ids":', string(variables('ids')), '}')`
- *Configurar execução após*: somente **for bem-sucedido**. Assim, se uma
  página falhar, nenhuma tarefa é desativada por engano.

> Os nomes dentro de `parameters('...')` são os nomes de exibição das
> variáveis de ambiente. O jeito mais fácil é escolher a variável na
> lista de "Conteúdo dinâmico" em vez de digitar.

## 6. Testar

1. **Testar → Manualmente** no fluxo.
2. Abra a tabela **Tarefas do ClickUp** em Power Apps → Tabelas → Dados.
   Deve haver uma linha por tarefa, com Frequência, Tempo antes/depois,
   Progresso, Tags e Responsáveis preenchidos.
3. Rode o fluxo de novo: a saída de `Gravar_Pagina` deve mostrar quase
   tudo como `inalteradas` (só grava o que mudou).
4. Confira a quantidade com o Power BI: medida **Total Tarefas** = linhas
   ativas da tabela.

## 7. Vincular as áreas às tags

Em **Gestão → Áreas** (ou direto na tabela Área), preencha **Tag no
ClickUp** com o nome exato da tag usada nas tarefas (ex.: PRO →
`processos`). É esse vínculo que liga os indicadores ao recorte por área
do portal.

## 8. Meta mensal

Cadastre em **Metas de indicadores** (tabela `dgt_metaindicador`):
Indicador `HorasEconomizadasMes`, Ano `0`, Mês `0`, Valor `160`, Área vazia.
Na fase 3 isso vira uma tela de configuração para o Administrador.

## Diferenças intencionais em relação ao Power BI

| Ponto | Power BI | Plataforma |
|---|---|---|
| Concluído | 3 regras diferentes | Uma regra: tipo de status `closed`/`done` ou data de conclusão |
| Horas por tag | Soma por tag (tarefa com 2 tags conta 2×) | Total por tarefa; por área usa a tag vinculada |
| Área | Nome da área = nome da tag (texto) | Vínculo explícito Área ↔ Tag |
| Meta | 160 fixo na fórmula | Tabela de metas (por mês/área) |
| Atrasada | Calculada na atualização | Calculada ao abrir a página |
