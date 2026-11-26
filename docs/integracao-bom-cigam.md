# Integração B.O.M. → CIGAM (Homologação)

O botão **Lançar no CIGAM** da etapa *B.O.M. pronto* envia a lista congelada do B.O.M. ao webhook da MAAX. Com ela, a MAAX cria a oportunidade e o pedido de venda na Homologação do CIGAM.

```
Portal (botão) → Custom API dgt_EnviarBomCigam → EnviarBomCigamPlugin → webhook MAAX → CIGAM HML
```

O navegador nunca recebe o token. Ele fica só na Configuração segura do passo do plugin.

## Instalação

1. Execute `scripts/dataverse/criar-integracao-bom-cigam.ps1 -UrlAmbiente <url> -Solucao DGTPortaldeConhecimentoeTreinamentos`.
2. Compile `server/DGT.Treinamentos.Plugins` e atualize o assembly no Plugin Registration Tool.
3. Registre o passo:
   - Message `dgt_EnviarBomCigam` · PostOperation · Synchronous · plugin `EnviarBomCigamPlugin`;
   - **Unsecure Configuration**: `{ "url": "<endereço do webhook informado pela MAAX>", "ambiente": "Homologação" }`;
   - **Secure Configuration**: o token entregue pela MAAX, colado diretamente, sem aspas.
4. Garanta que os perfis de quem vai lançar tenham **Write** em `dgt_bom_bom`.

## Regras

- Só lança B.O.M. **enviado para aprovação**. Os itens e preços são lidos da lista congelada no servidor, nunca do navegador.
- Bloqueia o envio se houver item sem código, item sem preço ou cliente sem código CIGAM na demanda.
- Itens com o mesmo código são somados em uma linha.
- O webhook não protege contra repetição. Por isso, depois de um lançamento **recebido** ou **sem resposta**, um novo lançamento exige justificativa e cria outra oportunidade e outro pedido.
- Não há nova tentativa automática. Cada tentativa fica em `dgt_bom_cigamenvio` com data, usuário, HTTP, itens, valor e parâmetros. O token nunca é registrado.
- O número da oportunidade e o do pedido não voltam nesta versão. Para conferir, use o CIGAM HML ou o log da MAAX.

## Testes

| ID | Cenário | Esperado |
|---|---|---|
| CT-C1 | B.O.M. enviado, todos os itens com código e preço | "Recebido pela MAAX"; oportunidade e pedido no CIGAM HML |
| CT-C2 | Item sem código ou sem preço | Botão bloqueado, com a lista dos itens |
| CT-C3 | Segundo lançamento | Exige justificativa; registra `reenvio: true` |
| CT-C4 | Token errado no passo | "Recusado": token ausente ou inválido |
| CT-C5 | Controle 05 | Webhook responde 200; a recusa aparece só no CIGAM ou no log da MAAX |
