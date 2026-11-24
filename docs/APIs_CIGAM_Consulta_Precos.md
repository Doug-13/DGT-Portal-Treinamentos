# APIs CIGAM utilizadas — Consulta de Preços de Materiais

> Documentação técnica das chamadas à API REST do CIGAM (Cigam.Web.API) feitas pelo
> programa **ConsultaPrecosCIGAM.exe** e pelo script `consulta_material_cigam.py`.
> Atualizado em 05/11/2026.

## 1. Visão geral

| Item | Valor |
|---|---|
| API | Cigam.Web.API (REST/JSON) |
| Base URL — Produção | `https://dgtportais.cigam.cloud/api/api/` |
| Base URL — Homologação | `https://dgtportaishml.cigam.cloud/api/api/` |
| Documentação oficial | `https://dgtportais.cigam.cloud/api/Help` |
| Autenticação | `Authorization: Bearer <hash>` (hash obtido no login) |
| Filtros | Parâmetros OData (`$filter`, `$top`) na query string |
| Natureza das chamadas | **Somente leitura**: nenhuma chamada grava dados no CIGAM |

> A rota na documentação aparece como `api/suprimentos/...`; a URL efetiva tem o prefixo
> duplicado (`/api/api/suprimentos/...`), conforme validado nos scripts do projeto.

### Endpoints utilizados

| # | Método | Endpoint | Finalidade | Uso |
|---|---|---|---|---|
| 1 | POST | `genericos/ge/Login/Autenticar` | Autenticar o usuário e obter o token | Obrigatório |
| 2 | GET | `suprimentos/es/Materiais/PesquisarMateriais` | Cadastro do material (código e descrição) | Principal |
| 3 | GET | `suprimentos/es/Materiais/Buscar` | Cadastro do material | Alternativa ao #2 se falhar |
| 4 | GET | `suprimentos/es/Estoque/Buscar` | Saldo em estoque | Principal |
| 5 | GET | `genericos/ge/PrecosTabela/Buscar` | Tabelas de preço e preço unitário | Principal |
| 6 | DELETE | `genericos/ge/Sessao/Logout` | Encerrar a sessão | Ao sair |

### Sequência por material consultado

```
Login (1x por sessão)
 └─ para cada código:
     1. PesquisarMateriais  → descrição          (se falhar: Materiais/Buscar)
     2. Estoque/Buscar      → saldo
     3. PrecosTabela/Buscar → tabelas de preço
Logout (ao sair / fechar)
```

Cada material gera **3 chamadas GET**. O código é sempre enviado **sem máscara**
(`490.010.0018` → `4900100018`).

---

## 2. Login — `POST genericos/ge/Login/Autenticar`

**Requisição**

```http
POST https://dgtportais.cigam.cloud/api/api/genericos/ge/Login/Autenticar
Content-Type: application/json; charset=utf-8
Accept: application/json
```

```json
{
  "NomeUsuario": "<usuario_cigam>",
  "Senha": "<senha>"
}
```

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `NomeUsuario` | string | Sim | Usuário do CIGAM do operador |
| `Senha` | string | Sim | Digitada pelo operador; não é gravada em disco |
| `Portal` | string | Não | Enviado apenas se informado (`--portal`). Não foi necessário nos testes |

**Resposta (200)**

```json
{
  "success": true,
  "hash": "<token>",
  "messages": [],
  "data": {},
  "tipoLogin": "cigam",
  "messagesAttributes": []
}
```

| Campo usado | Uso |
|---|---|
| `success` | Login só é aceito se `true` |
| `hash` | Enviado nas chamadas seguintes como `Authorization: Bearer <hash>` |
| `messages` | Exibido ao usuário em caso de falha |

---

## 3. Cadastro do material — `GET suprimentos/es/Materiais/PesquisarMateriais`

**Requisição**

```http
GET https://dgtportais.cigam.cloud/api/api/suprimentos/es/Materiais/PesquisarMateriais?$filter=Codigo%20eq%20'4900100018'&$top=200
Authorization: Bearer <hash>
Accept: application/json
```

| Parâmetro | Valor | Observação |
|---|---|---|
| `$filter` | `Codigo eq '<codigo>'` | Código sem máscara; aspas simples escapadas (`'` → `''`) |
| `$top` | `200` | Limite de segurança |

**Body:** nenhum.

**Resposta (200)**: lista de `PesquisarMateriaisDTO`

```json
[
  {
    "Codigo": "4900100018",
    "Descricao": "LIGHTERA 35510275 OLT LIGHTERA INT OPTICA MM SFP G",
    "Referencia": "",
    "CodigoGrupo": "490",
    "CodigoSubGrupo": "010",
    "CodigoUnidadeMedida": "UN",
    "Imagem": "",
    "Aplicacao": "",
    "ControlaEspecif1": "",
    "ControlaEspecif2": "",
    "ControlaEspecif3": "",
    "CodigoConfigurador": ""
  }
]
```

| Campo usado | Uso |
|---|---|
| `Codigo` | Conferência do material retornado |
| `Descricao` | Exibida e usada na validação de descrição |
| `CodigoUnidadeMedida` | Unidade exibida junto ao saldo |

> Lista vazia = material não cadastrado.

---

## 4. Cadastro do material (alternativa) — `GET suprimentos/es/Materiais/Buscar`

Usado **apenas se o endpoint #2 retornar erro**.

**Requisição**

```http
GET https://dgtportais.cigam.cloud/api/api/suprimentos/es/Materiais/Buscar?$filter=Material/Codigo%20eq%20'4900100018'&$top=200
Authorization: Bearer <hash>
```

| Tentativa | `$filter` |
|---|---|
| 1ª | `Material/Codigo eq '<codigo>'` (aceito nos testes) |
| 2ª | `Codigo eq '<codigo>'` |

**Body:** nenhum.

**Resposta (200)**: lista de `MaterialDTO`

```json
[
  {
    "Material": {
      "Codigo": "4900100018",
      "Descricao": "LIGHTERA 35510275 OLT ...",
      "Tipo": "...",
      "CodigoUnidadeMedida": "UN",
      "...": "..."
    },
    "Imagem": "",
    "ImagemCDN": "",
    "DescricaoCompleta": "..."
  }
]
```

Campos usados: `Material.Codigo`, `Material.Descricao`, `Material.CodigoUnidadeMedida`.

---

## 5. Estoque — `GET suprimentos/es/Estoque/Buscar`

**Requisição**

```http
GET https://dgtportais.cigam.cloud/api/api/suprimentos/es/Estoque/Buscar?$filter=Estoque/CodigoMaterial%20eq%20'5400010044'&$top=200
Authorization: Bearer <hash>
```

| Tentativa | `$filter` |
|---|---|
| 1ª | `Estoque/CodigoMaterial eq '<codigo>'` (aceito nos testes) |
| 2ª | `CodigoMaterial eq '<codigo>'` |

**Body:** nenhum.

**Resposta (200)**: lista de `EstoqueDTO`, um item por unidade de negócio / centro de armazenagem

```json
[
  {
    "Estoque": {
      "CodigoMaterial": "5400010044",
      "CodigoUnidadeNegocio": "007",
      "CodigoCentroArmazenagem": "010",
      "Saldo": 5.0,
      "Material": null,
      "CentroArmazenagem": null,
      "UnidadeNegocio": null,
      "Lote": "",
      "Numeracao": "",
      "...": "..."
    },
    "UnidadeMedida": { "Codigo": "UN", "Descricao": "UNIDADE", "Mascara": "...", "Inteiro": 8, "NumeroDecimal": 6 }
  }
]
```

| Campo usado | Uso |
|---|---|
| `Estoque.Saldo` | Somado entre todos os registros = saldo total |
| `Estoque.CodigoUnidadeNegocio` / `CodigoCentroArmazenagem` | Detalhamento do saldo por local (script) |
| `UnidadeMedida.Codigo` | Unidade, quando o cadastro não traz |

> ⚠️ **`Estoque.Material` vem sempre `null`**. Por isso a descrição é buscada no endpoint #2.
> Lista vazia = material sem registro de estoque (saldo 0).

---

## 6. Preços — `GET genericos/ge/PrecosTabela/Buscar`

**Requisição**

```http
GET https://dgtportais.cigam.cloud/api/api/genericos/ge/PrecosTabela/Buscar?$filter=Elemento%20eq%20'5100250019'&$top=200
Authorization: Bearer <hash>
```

| Tentativa | `$filter` |
|---|---|
| 1ª | `Elemento eq '<codigo>'` (aceito nos testes) |
| 2ª | `CodigoMaterial eq '<codigo>'` |

**Body:** nenhum.

> O filtro por tabela específica **não** é enviado à API: o CIGAM mistura códigos com e
> sem zero à esquerda (`068`, `70`), então a filtragem por tabela é feita no programa.

**Resposta (200)**: lista, um item por tabela de preço do material

```json
[
  {
    "CodigoTabela": "010",
    "DescricaoTabela": "VENDA PADRÃO 2021",
    "DescontoMaximoCalculado": 0.0,
    "Elemento": "5100250019",
    "Regra": 0,
    "PrecoMaior": 0.0,
    "PrecoMenor": 0.0,
    "PrecoUnitario": 712.056,
    "PrecoDesconto": 0.0,
    "ValidadeInicial": "2020-10-01T00:00:00",
    "ValidadeFinal": "2029-12-31T00:00:00"
  }
]
```

| Campo usado | Uso |
|---|---|
| `Elemento` | Código do material (conferência) |
| `CodigoTabela` / `DescricaoTabela` | Identificação da tabela |
| `PrecoUnitario` | Preço exibido |
| `ValidadeInicial` / `ValidadeFinal` | Classificação **Vigente** / **Vencida** (data atual) |

> ⚠️ **A API não retorna tabelas em que o preço do material está zerado.** Confirmado com o
> material 540.001.0044 (tabela 068 com preço 0 no CIGAM, lista vazia na API). Por isso o
> programa exibe "SEM TABELA DE PREÇO (ou preço zerado)".

---

## 7. Logout — `DELETE genericos/ge/Sessao/Logout`

```http
DELETE https://dgtportais.cigam.cloud/api/api/genericos/ge/Sessao/Logout
Authorization: Bearer <hash>
```

**Body:** nenhum. Chamado ao clicar em **Sair** ou fechar o programa; falhas são ignoradas.

---

## 8. Tratamento de respostas

| Situação | Comportamento |
|---|---|
| HTTP 200 com lista | Sucesso |
| HTTP 401 | Sessão expirada → programa solicita novo login |
| HTTP 403 | Usuário sem direito no endpoint → erro informado |
| Outros erros (400/500) | Tenta o filtro alternativo; persistindo, registra "ERRO NA CONSULTA" e segue para o próximo código |
| Campos texto com espaços à direita | O CIGAM devolve campos CHAR completados (`"010    "`); o programa remove os espaços de todo retorno |

## 9. Regras de negócio aplicadas no programa

| Situação exibida | Regra |
|---|---|
| POSSUI TABELA DE PREÇO (n vigentes) | Ao menos uma tabela vigente com `PrecoUnitario > 0` |
| SOMENTE TABELAS VENCIDAS | Há tabelas, mas nenhuma dentro da validade |
| SEM TABELA DE PREÇO (ou preço zerado) | API não retornou tabelas para o material |
| MATERIAL NÃO ENCONTRADO | Sem cadastro (#2) e sem estoque (#4) |
| ERRO NA CONSULTA | Falha na chamada; motivo na coluna *Observação* da exportação |

## 10. Pontos em aberto

1. **Preço zerado indistinguível de "sem tabela"**: a API omite o registro. Validar com o
   fornecedor CIGAM se existe parâmetro para retornar preços zerados.
2. **Parâmetros OData não documentados**: o Help não lista campos filtráveis; os filtros
   acima foram validados empiricamente em HML e PRD.
3. **Permissões**: cada operador precisa de direito nos endpoints #2, #4 e #5.
