# Script no fluxo (caixa com engrenagem)

Uma **tarefa de sistema** que roda um script: consulta o banco (Dataverse), chama uma API
(ex.: CEP) e **preenche campos** — ou só **verifica** e bloqueia a ação.

**Desenhar:** na paleta do editor, **Script** (caixa com engrenagem) → duplo clique → o script, os
campos que ele pode preencher, os endereços de API e as fontes do Dataverse → **Testar script**.
(Ou uma tarefa de sistema comum com "O que o sistema faz" = **Executar script**.)

## Como roda

1. A etapa anterior é concluída → o fluxo **para no script**.
2. O script roda **isolado** (no navegador de quem concluiu a etapa), com até 20 s (configurável até 60).
3. Os campos devolvidos são gravados **e só então o fluxo segue** — a decisão logo depois do script já
   enxerga o que ele preencheu (ex.: `cepEncontrado = sim` → Confirmar; senão → Corrigir CEP).
4. Se o script devolver `{ erro }`, der erro ou passar do tempo, **a ação não é concluída** e nada é
   gravado; a pessoa vê a mensagem (ex.: "CNPJ já cadastrado").

Fica no histórico: *"Script: <mensagem>"* com os campos preenchidos. Funciona em documentos e ambientes.

## Contrato

O código é o **corpo de uma função assíncrona**:

```js
// entrada.valores   → campos do registro (texto)
// entrada.registro  → { codigo, titulo }      entrada.usuario → { id, nome }
const cep = (entrada.valores.cep || '').replace(/\D/g, '');
const r = await DGT.http('https://viacep.com.br/ws/' + cep + '/json/');   // { status, ok, dados, texto }
if (!r.ok || (r.dados || {}).erro) {
  return { valores: { cepEncontrado: 'nao' }, mensagem: 'CEP não encontrado' };
}
const linhas = await DGT.consultar('clientes', { dgt_cep: cep });          // fonte liberada
DGT.log(linhas.length + ' cliente(s) com este CEP');
return { valores: { logradouro: r.dados.logradouro, cepEncontrado: 'sim' }, mensagem: 'Endereço preenchido' };
// Para BLOQUEAR a ação:  return { erro: 'motivo' };
```

| Regra | Detalhe |
|---|---|
| Campos que pode preencher | só os marcados na configuração; o resto é ignorado. Valores viram texto (Sim/Não: `"sim"`/`"nao"`; data: `"AAAA-MM-DD"`). Nenhum marcado = script só de verificação |
| APIs | só **HTTPS** para os **endereços liberados** (e subdomínios), **sem enviar o login**. A API precisa aceitar chamadas do navegador (CORS) — ViaCEP e BrasilAPI aceitam |
| Dataverse | só **leitura**, só as **fontes liberadas** (tabela + colunas), filtro de igualdade — igual ao componente HTML |
| Isolamento | `iframe sandbox` sem `allow-same-origin`: sem acesso ao login, cookies ou portal |
| Ligações | o script tem **uma** saída; para escolher caminhos, ponha uma **decisão** depois, por campo que o script preenche |

**Testar script** (no editor) roda de verdade com valores de exemplo em JSON, mostra os campos que
seriam preenchidos, o log e se bloquearia — sem gravar nada.

> Como o componente HTML, o script depende de a política de scripts do SharePoint (CSP) permitir o
> quadro isolado. Teste o exemplo de CEP com **Testar script** no seu ambiente.

## No pacote JSON

```json
{ "id": "buscarCep", "tipo": "tarefaSistema", "nome": "Script: buscar CEP", "acaoSistema": "executarScript",
  "script": { "codigo": "...", "camposSaida": ["logradouro", "cidade", "uf", "cepEncontrado"],
              "hostsPermitidos": ["viacep.com.br"], "tempoLimiteSegundos": 20 } }
```
