# Assinatura digital (Clicksign) — tarefa do fluxo + Power Automate

## Como funciona

```
Portal: etapa "Assinatura digital"  ──►  Dataverse: dgt_assinatura (pedido, situação "pendente")
        ▲  libera o fluxo                         │
        │                               Power Automate (1) ENVIO: Clicksign API v3
        │                                         │  situação "enviado"
        └── situação "assinado" ◄── Power Automate (2) RETORNO: webhook da Clicksign →
                                    consulta a situação na API → salva o PDF assinado
```

1. O fluxo chega à tarefa **Assinatura digital** e **para** (com uma chave única por parada).
2. Ao abrir o documento/registro, o portal **garante o pedido** em `dgt_assinatura` (não duplica):
   arquivos, signatários (nome e e-mail dos usuários do portal), prazo e mensagem.
3. **Fluxo de envio** (Power Automate): cria o envelope na Clicksign e marca `enviado`.
4. **Fluxo de retorno**: a Clicksign avisa → o fluxo **consulta a situação na própria API** (não confia
   no conteúdo do aviso), salva o PDF assinado no SharePoint e grava `assinado` (ou `recusado`,
   `expirado`, `cancelado`).
5. O portal, ao abrir o registro ou em **Conferir agora**, vê a situação final e **libera o fluxo**.

O **token da Clicksign fica só no Power Automate** — nunca no portal.

## Configurar a tarefa (editor do fluxo)

Paleta → **Assinatura digital** (caneta) → duplo clique:

| Opção | Uso |
|---|---|
| Provedor | Clicksign |
| O que é assinado | **Arquivo da revisão** (documentos: POP, procedimento) ou **PDFs anexados ao registro** (ambientes; ligue os anexos no ambiente) |
| Signatários | campo **Usuário** do processo (ex.: "Dono do processo") ou **pessoa fixa**; papel: assina / aprova / testemunha. Só usuários do portal (e-mail do cadastro) |
| Ordem | "um de cada vez, na ordem da lista" ou todos ao mesmo tempo |
| Prazo | 1 a 90 dias |
| Campo da situação | opcional (Texto ou Lista com `assinado`, `recusado`, `expirado`, `cancelado`). Com ele, o fluxo segue também na recusa/expiração — ponha uma **decisão** depois. Sem ele, só segue quando **assinado** |
| Campo do link | opcional (Texto): recebe o link do PDF assinado |

A tarefa tem **uma** saída. Na tela do registro aparece o quadro **Assinatura digital** com a situação,
os signatários, **Conferir agora**, **Reenviar** (quando o envio deu erro) e **Liberar sem assinatura**
(Administrador, com motivo — fica no histórico).

## 1. Dataverse

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\dataverse\criar-tabelas-assinatura.ps1 -UrlAmbiente https://orga1bd9fe9.crm2.dynamics.com -Solucao DGTPortaldeConhecimentoeTreinamentos
```

Permissões (Funções de segurança → Entidades personalizadas → **Pedido de Assinatura**):

| Quem | Privilégios |
|---|---|
| Quem conclui etapas que chegam à assinatura | Criar, Ler (Organização) |
| Administradores do portal | Criar, Ler, Gravar (Reenviar) |
| Conta dona dos fluxos do Power Automate | Ler, Gravar |
| Ninguém | Excluir |

Colunas usadas pelos fluxos: `dgt_chave`, `dgt_situacao` (`pendente`, `enviado`, `assinado`, `recusado`,
`expirado`, `cancelado`, `erro`), `dgt_arquivosjson` (`[{ "nome", "url" }]`), `dgt_signatariosjson`
(`[{ "nome", "email", "papel", "ordem", "situacao", "assinadoEm" }]`), `dgt_ordemsequencial`, `dgt_prazo`,
`dgt_mensagem`, `dgt_idexterno` (id do envelope), `dgt_linkacompanhamento`, `dgt_arquivoassinado`,
`dgt_erro`, `dgt_concluidoem`.

## 2. Clicksign

1. Gere o **Access Token** da API (Configurações → API) — primeiro no **sandbox**
   (`https://sandbox.clicksign.com`), depois em produção (`https://app.clicksign.com`).
2. No Power Automate, guarde em **variáveis de ambiente** da solução:
   `dgt_ClicksignBaseUrl` (ex.: `https://sandbox.clicksign.com/api/v3`) e `dgt_ClicksignToken`
   (tipo **Segredo**, de preferência ligado ao Azure Key Vault).
3. Depois de criar o fluxo (2), cadastre a URL dele como **webhook** na Clicksign, com os eventos de
   envelope concluído/fechado, recusa, prazo e cancelamento (nomes exatos na documentação de webhooks).

Licença: os fluxos usam **HTTP**, **Quando uma solicitação HTTP é recebida** e **Dataverse** —
conectores **Premium** (por isso a licença Premium é necessária para a conta dona dos fluxos).

## 3. Fluxo (1) — ENVIO

**Gatilho:** Dataverse → *Quando uma linha é adicionada, modificada ou excluída*
- Tipo: **Adicionado ou Modificado** · Tabela: **Pedidos de Assinatura** · Escopo: Organização
- Filtrar linhas: `dgt_situacao eq 'pendente'` (o **Reenviar** do portal volta o pedido para `pendente`)

**Ações** (todas com `Authorization: Bearer @{token}` e `Content-Type: application/vnd.api+json`;
confira o formato JSON:API de cada corpo na referência v3 da Clicksign):

1. **Analisar JSON** de `dgt_arquivosjson` e de `dgt_signatariosjson`.
2. **HTTP POST** `{base}/envelopes` — nome = `dgt_name`, prazo = `dgt_prazo`
   (e sequência de assinatura se `dgt_ordemsequencial` = sim). Guarde o **id do envelope**.
3. **Para cada arquivo:** obtenha o conteúdo no SharePoint (*Enviar uma solicitação HTTP para o
   SharePoint* → `GET _api/web/GetFileByServerRelativeUrl('<caminho do url>')/$value`) e
   **HTTP POST** `{base}/envelopes/{id}/documents` com o arquivo em base64
   (`data:application/pdf;base64,@{base64(body)}`) e o nome. Guarde o id de cada documento.
4. **Para cada signatário:** **HTTP POST** `{base}/envelopes/{id}/signers` (nome, e-mail; ordem/grupo
   se sequencial) e **requisitos** em `{base}/envelopes/{id}/requirements` para cada documento:
   qualificação (papel: `assinar` → assinar, `aprovar` → aprovar, `testemunha` → testemunha) e
   autenticação por **e-mail**.
5. **Ativar** o envelope (`PATCH {base}/envelopes/{id}` com status `running`) e **notificar** os
   signatários.
6. **Atualizar a linha:** `dgt_situacao = enviado`, `dgt_idexterno = id do envelope`,
   `dgt_linkacompanhamento` (link do envelope no painel da Clicksign).
7. **Em caso de falha** (*Configurar execução após: falhou*): `dgt_situacao = erro`,
   `dgt_erro = mensagem`. O portal mostra o erro e o botão **Reenviar**.

## 4. Fluxo (2) — RETORNO

**Gatilho:** *Quando uma solicitação HTTP é recebida* (a URL gerada vai no webhook da Clicksign).

1. Pegue o **id do envelope** do corpo do aviso. Responda `200` logo (os avisos podem ser reenviados;
   o fluxo é idempotente).
2. **Não confie no conteúdo do aviso:** **HTTP GET** `{base}/envelopes/{id}` com o token e leia a
   situação **na API**. (O Power Automate não calcula HMAC nativamente; consultar a API garante que um
   aviso falso não marque nada como assinado.)
3. **Dataverse — listar linhas** de Pedidos de Assinatura com `dgt_idexterno eq '{id}'`. Se a linha já
   está numa situação final, encerre.
4. Conforme a situação na API:
   - **concluído/assinado:** baixe o documento assinado (link de download do documento do envelope),
     **crie o arquivo** no SharePoint na mesma pasta do original como `<nome> - assinado.pdf`, e atualize
     a linha: `dgt_situacao = assinado`, `dgt_arquivoassinado = link do arquivo`,
     `dgt_concluidoem = utcNow()`, `dgt_signatariosjson` com `assinadoEm` de cada um;
   - **recusado / prazo vencido / cancelado:** `dgt_situacao = recusado` / `expirado` / `cancelado`,
     `dgt_concluidoem = utcNow()`.
5. (Opcional) **Envie um e-mail** ao `dgt_solicitadopor` avisando que o documento foi assinado e que o
   fluxo segue ao abrir o registro.

**Recomendado — Fluxo (3) de conferência:** *Recorrência* (a cada 1 h) → linhas com
`dgt_situacao eq 'enviado'` → para cada uma, repita os passos 2–4. Cobre avisos perdidos.

## 5. Teste

1. Sandbox da Clicksign + fluxos (1) e (2) ligados.
2. Num fluxo de teste: etapa "Elaborar" → **Assinatura digital** (signatário: você) → etapa "Conferir".
3. Conclua "Elaborar" → abra o documento: quadro **Assinatura digital** com "Aguardando envio" →
   em segundos, "Enviado para assinatura".
4. Assine pelo e-mail do sandbox → **Conferir agora** → o fluxo vai para "Conferir" e o histórico mostra
   "Documento assinado". O PDF assinado está ao lado do original.

## No pacote JSON

```json
{ "id": "assinar", "tipo": "tarefaSistema", "nome": "Assinatura digital", "acaoSistema": "assinaturaDigital",
  "assinatura": {
    "provedor": "clicksign", "documento": "arquivoRevisao",
    "signatarios": [ { "origem": "campo", "campo": "donoProcesso", "papel": "assinar" },
                     { "origem": "usuario", "email": "qualidade@dgt.com.br", "papel": "aprovar" } ],
    "ordemSequencial": true, "prazoDias": 10, "campoSituacao": "situacaoAssinatura"
  } }
```
