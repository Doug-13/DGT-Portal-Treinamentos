# Integração de preços com o CIGAM (Kits → Valor R$)

A coluna **Valor (R$)** da aba *Kits → Equipamentos e itens* mostra o preço
unitário de cada item, buscado no CIGAM pelo **código CIGAM** do item.
Referência da API: [APIs_CIGAM_Consulta_Precos.md](APIs_CIGAM_Consulta_Precos.md)
(mesmas chamadas do programa *ConsultaPrecosCIGAM.exe*).

```
Portal (botão "Atualizar valores do CIGAM")
  └─ cria uma linha em dgt_cigamsincronizacao (Situação = Pendente)
       └─ Plugin AtualizarValoresCigamPlugin (Create, assíncrono)
            1. Login no CIGAM            → hash (Bearer)
            2. Para cada dgt_kititem ATIVO e COM código:
                 GET PrecosTabela/Buscar?$filter=Elemento eq '<código sem máscara>'
                 escolhe a tabela configurada (padrão 010), vigente e com preço
                 grava dgt_valor, dgt_valoratualizadoem, dgt_valororigem, dgt_valorsituacao
            3. Logout e atualiza o pedido → Concluída / Erro (com resumo)
Portal acompanha o pedido a cada 8 s e recarrega os valores ao terminar
```

O portal **nunca** fala com o CIGAM e **nunca** vê usuário ou senha do
CIGAM. A credencial fica na **configuração segura** do passo do plugin,
visível só para administradores do sistema.

## Regras

| Situação | O que acontece |
|---|---|
| Item **sem código CIGAM** (vazio ou texto como "a levantar") | **Não é consultado** e não é alterado |
| Tabela configurada vigente e com preço > 0 | `dgt_valor` recebe o `PrecoUnitario`; origem "CIGAM — tabela 010 … (vigente até …)" |
| API devolve lista vazia | "Sem tabela de preço no CIGAM (ou preço zerado na tabela)" — a API omite preço zerado |
| Só existe a tabela vencida | "Tabela 010 vencida em dd/mm/aaaa" |
| Item está em outras tabelas | "Não está na tabela 010. Tabelas do item no CIGAM: 012, 024" |
| Erro na chamada (400/500, timeout) | Tenta o filtro alternativo (`CodigoMaterial`); persistindo, grava o motivo no item |
| HTTP 401 | Faz novo login uma vez e repete |
| HTTP 403 | "Usuário de integração sem permissão em PrecosTabela/Buscar" |

Sem preço, o **valor anterior é mantido** (o portal mostra a data e o motivo).

Correções em relação à primeira versão deste documento (validadas pelo
programa ConsultaPrecosCIGAM):
1. A URL efetiva tem o prefixo duplicado: `https://dgtportais.cigam.cloud/api/api/`.
2. O código vai **sem máscara** (`310.005.0082` → `3100050082`).
3. A tabela **não** vai no `$filter`: o CIGAM mistura `068` e `70`; a escolha é feita no plugin (`068` = `68`).
4. O campo `Portal` do login não é necessário.

## 1. Decisões antes de ligar

1. **Valor do kit = preço de venda** (tabela de preço). A API de preços não traz custo.
   Se o B.O.M. precisar de custo, é outra consulta (ex.: última compra) — combinar com Suprimentos.
2. **Tabela(s) a usar**, em ordem de preferência. Padrão: `010` (VENDA PADRÃO 2021).

## 2. Usuário de integração no CIGAM

Peça ao administrador do CIGAM um **usuário só de leitura** com direito em
`genericos/ge/PrecosTabela/Buscar`. Não use o usuário de uma pessoa.

## 3. Registrar o plugin (Plugin Registration Tool)

1. Compile `server/DGT.Treinamentos.Plugins` (Release) e use **Update** na assembly
   *DGT.Treinamentos.Plugins* já registrada.
2. **Register New Step**:

   | Campo | Valor |
   |---|---|
   | Message | `Create` |
   | Primary Entity | `dgt_cigamsincronizacao` |
   | Event Handler | `DGT.Treinamentos.Plugins.AtualizarValoresCigamPlugin` |
   | Stage | **PostOperation** |
   | Execution Mode | **Asynchronous** |
   | Delete AsyncOperation if StatusCode = Successful | marcado |
   | Unsecure Configuration | `{ "url": "https://dgtportais.cigam.cloud/api/api/", "tabelas": ["010"], "segundosMaximos": 100 }` |
   | Secure Configuration | `{ "usuario": "<usuário de integração>", "senha": "<senha>" }` |

3. Use `https://dgtportaishml.cigam.cloud/api/api/` primeiro (homologação) e troque a URL depois.

A senha é digitada **só** na configuração segura do passo: não vai para o
código, para este documento, para logs nem para mensagens de erro.

## 4. Testar

1. Na aba *Kits → Equipamentos e itens*, clique em **↻ Atualizar valores do CIGAM**.
2. A barra mostra "Em andamento … buscando no CIGAM" e se atualiza sozinha.
3. Ao terminar: "Concluída — N com valor · N sem preço · N sem código (não consultados)".
4. Passe o mouse no valor de um item para ver a tabela de origem e a data.

Se a barra mostrar "sem resposta há mais de 15 min", o passo não está
registrado ou falhou: veja *Configurações → Trabalhos do sistema* (filtro
pela tabela *Sincronização com o CIGAM*). O botão vira **↻ Pedir de novo**.

## 5. Limite de tempo

Plugins têm 2 minutos por execução. O plugin para com folga (100 s, ajustável
em `segundosMaximos`) e processa primeiro os itens atualizados há mais tempo.
Se faltar algum, a mensagem avisa e um novo pedido continua de onde parou.

## 6. Permissões

- Quem mantém os kits: **Criar e Ler** em `dgt_cigamsincronizacao` (o script
  `criar-colunas-valor-cigam.ps1` já concede com `-PapelMantenedores`).
- O plugin grava como SYSTEM: não precisa de permissão extra para os usuários.

## 7. Como o portal mostra

| Situação | Na coluna Valor (R$) |
|---|---|
| Item sem código CIGAM | `—` (não consultado) |
| Ainda não buscado | selo *a buscar* |
| Sem preço | selo *! sem preço* (passe o mouse para ver o motivo) |
| Com valor | `R$ 1.234,56` e a data; data com mais de 30 dias aparece com `!` |

O valor é **somente leitura** no portal.
