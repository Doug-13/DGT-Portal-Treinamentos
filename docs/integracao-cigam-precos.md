# Integração de preços com o CIGAM (Kits → Valor R$)

A coluna **Valor (R$)** da aba *Kits → Equipamentos e itens* mostra o preço
unitário de cada item, buscado no CIGAM pelo **código CIGAM** do item.

```
Portal (botão "Atualizar valores do CIGAM")
  └─ cria uma linha em dgt_cigamsincronizacao (Situação = Pendente)
       └─ Power Automate: "Quando uma linha é adicionada"
            1. Login no CIGAM            → hash (Bearer)
            2. Para cada dgt_kititem com código:
                 GET PrecosTabela/Buscar → PrecoUnitario
                 atualiza dgt_valor, dgt_valoratualizadoem, ...
            3. Atualiza o pedido         → Concluída / Erro
Portal lê dgt_kititem e mostra o valor (somente leitura)
```

O portal **nunca** fala com o CIGAM e **nunca** vê usuário ou senha do
CIGAM. Isso segue a regra da DGT: credenciais não ficam no código, em
logs, em mensagens de erro nem em URLs.

---

## 1. Qual endpoint traz o preço

O endpoint sugerido inicialmente,
`GET api/suprimentos/me/ItemListaMateriaisEnderecamento/BuscarItem`,
**não serve**: ele busca um item de lista de materiais do
multiendereçamento pela *hash* do documento (estoque/separação) e não
devolve preço.

O que traz preço, pela documentação (`/api/Help`):

| Endpoint | O que devolve | Uso |
|---|---|---|
| `GET api/genericos/ge/PrecosTabela/Buscar` | Linhas de tabela de preço: `CodigoTabela`, `Elemento` (material), `PrecoUnitario`, `PrecoMenor`, `PrecoMaior`, `PrecoDesconto`, `ValidadeInicial`, `ValidadeFinal` | **Recomendado.** Aceita filtros OData |
| `GET api/genericos/ge/TabelaPreco/BuscarTabelasPedido` | Tabelas de preço disponíveis | Descobrir o código da tabela certa |
| `GET api/suprimentos/co/ItemOrdem/Buscar` | Itens de ordens de compra | Alternativa: último custo de compra |

> **A confirmar com Suprimentos/Controladoria antes de ligar o fluxo:**
> 1. O "Valor" do kit é **preço de venda** (tabela de preço) ou **custo**
>    (última compra / custo médio)? O fluxo abaixo usa tabela de preço.
> 2. Qual é o **código da tabela de preço** a usar (ex.: tabela de
>    custo de referência dos projetos)?
> 3. O campo `Elemento` da tabela de preço é o **código do material**
>    (ex.: `3100050082`)? Testar com um item conhecido (passo 3).

## 2. Usuário de integração no CIGAM

1. Peça ao administrador do CIGAM um **usuário só de leitura** para
   integração (não use o usuário de uma pessoa).
2. Anote também o valor de **Portal** exigido no login
   (`SESSION_APP_PORTAL` do Web.config da API) — o suporte do CIGAM
   informa.
3. A senha **não** vai para o portal, para o código nem para este
   documento. Ela será guardada no passo 4.

## 3. Testar a consulta (Postman ou Insomnia, na sua máquina)

1. `POST https://dgtportais.cigam.cloud/api/genericos/ge/Login/Autenticar`
   com o corpo `{ "NomeUsuario": "...", "Senha": "...", "Portal": "..." }`.
   A resposta traz `hash`.
2. `GET https://dgtportais.cigam.cloud/api/genericos/ge/PrecosTabela/Buscar?$filter=CodigoTabela eq 'TABELA' and Elemento eq '3100050082'`
   com o cabeçalho `Authorization: Bearer <hash>`.
3. Confira se `PrecoUnitario` é o valor esperado.

Se o filtro por `Elemento` não funcionar, teste sem filtro com `$top=5`
para ver os nomes reais dos campos e ajuste o passo 5.

Não cole a resposta do login (o `hash`) em chats, e-mails ou tickets: ele
funciona como uma senha temporária.

## 4. Guardar a credencial no Power Platform

Em *make.powerapps.com → Soluções → DGT – Portal de Conhecimento e
Treinamentos → Novo → Mais → Variável de ambiente*:

| Variável | Tipo | Valor |
|---|---|---|
| `dgt_CigamUrl` | Texto | `https://dgtportais.cigam.cloud/api` |
| `dgt_CigamUsuario` | Texto | usuário de integração |
| `dgt_CigamPortal` | Texto | valor de *Portal* do login |
| `dgt_CigamTabelaPreco` | Texto | código da tabela de preço |
| `dgt_CigamSenha` | **Segredo** (Azure Key Vault) | referência ao segredo no Key Vault |

A variável do tipo **Segredo** exige um Azure Key Vault com o segredo
cadastrado e permissão para o Dataverse lê-lo (o administrador do Azure
faz isso uma vez). Assim a senha nunca aparece no fluxo nem no histórico
de execuções.

## 5. Criar o fluxo (Power Automate, dentro da solução)

**Gatilho:** *Dataverse — Quando uma linha é adicionada, modificada ou
excluída*
- Tipo de alteração: **Adicionada**
- Tabela: **Sincronizações com o CIGAM**
- Escopo: **Organização**
- Filtrar linhas: `dgt_situacao eq 'Pendente'`

**Ações:**

1. *Dataverse — Atualizar uma linha* (o pedido do gatilho):
   `dgt_situacao = Em andamento`.
2. **HTTP** (login no CIGAM):
   - Método `POST`, URI `@{parameters('dgt_CigamUrl')}/genericos/ge/Login/Autenticar`
   - Corpo: `{ "NomeUsuario": "@{parameters('dgt_CigamUsuario')}", "Senha": "@{parameters('dgt_CigamSenha')}", "Portal": "@{parameters('dgt_CigamPortal')}" }`
   - **Configurações da ação → Entradas seguras e Saídas seguras: LIGADO**
     (assim usuário, senha e hash não aparecem no histórico).
3. *Compor* `hash` = `body('HTTP_Login')?['hash']`.
4. *Dataverse — Listar linhas*: tabela **Itens do catálogo de kits**,
   filtro `dgt_ativo eq true and dgt_codigo ne null`, colunas
   `dgt_kititemid,dgt_codigo`.
5. *Inicializar variáveis* `atualizados` e `semPreco` (inteiro, 0).
6. *Aplicar a cada* item da lista (simultaneidade 5):
   1. **HTTP** `GET`
      `@{parameters('dgt_CigamUrl')}/genericos/ge/PrecosTabela/Buscar?$filter=CodigoTabela eq '@{parameters('dgt_CigamTabelaPreco')}' and Elemento eq '@{items('Aplicar_a_cada')?['dgt_codigo']}'`
      com cabeçalho `Authorization: Bearer @{outputs('Compor_hash')}`
      (**Entradas seguras ligado**).
   2. *Condição*: `length(body('HTTP_Preco'))` maior que 0
      - **Sim** → *Dataverse — Atualizar uma linha* (`dgt_kititem`):
        - `dgt_valor` = `first(body('HTTP_Preco'))?['PrecoUnitario']`
        - `dgt_valoratualizadoem` = `utcNow()`
        - `dgt_valororigem` = `CIGAM — tabela @{parameters('dgt_CigamTabelaPreco')}`
        - `dgt_valorsituacao` = *(vazio)*
        - *Incrementar variável* `atualizados`
      - **Não** → atualizar só `dgt_valorsituacao` = `Não encontrado na tabela de preços`
        e `dgt_valoratualizadoem` = `utcNow()`; *Incrementar* `semPreco`.
        (Não apague o `dgt_valor` anterior: o portal mostra a data.)
7. *Dataverse — Atualizar uma linha* (o pedido):
   `dgt_situacao = Concluída`, `dgt_itensatualizados`, `dgt_itenssempreco`,
   `dgt_concluidoem = utcNow()`.
8. **Tratamento de erro:** um escopo *Em caso de falha* (Configurar
   execução após: *falhou / atingiu o tempo limite*) que atualiza o
   pedido com `dgt_situacao = Erro` e `dgt_mensagem` com um texto
   simples (ex.: "Falha no login do CIGAM"). **Não** copie o corpo da
   resposta do CIGAM para a mensagem (pode conter dados de sessão).

Opcional: um segundo gatilho **Recorrência** (ex.: toda segunda, 6h) que
apenas cria uma linha *Pendente* em `dgt_cigamsincronizacao` — o mesmo
fluxo faz o resto.

## 6. Permissões

- Conexão do Dataverse usada pelo fluxo: **Ler e Gravar** em
  `dgt_kititem` e `dgt_cigamsincronizacao`.
- Perfil de quem mantém os kits: **Criar e Ler** em
  `dgt_cigamsincronizacao` (o script já concede com `-PapelMantenedores`).
- O conector HTTP é **premium** no Power Automate.

## 7. Como o portal mostra

| Situação | Na coluna Valor (R$) |
|---|---|
| Item sem código CIGAM | `—` |
| Ainda não buscado | selo *a buscar* |
| Não encontrado na tabela | selo *! sem preço* (passe o mouse para ver o motivo) |
| Com valor | `R$ 1.234,56` e a data; data com mais de 30 dias aparece com `!` |

O valor é **somente leitura** no portal. Alterar o código CIGAM de um
item não apaga o valor antigo; ele é substituído na próxima atualização.
