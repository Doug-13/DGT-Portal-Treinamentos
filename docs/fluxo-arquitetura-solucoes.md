# Fluxo do B.O.M. — Arquitetura de Soluções (processo ARQ-SOL)

O módulo **Arquitetura de Soluções** (menu Arquitetura) usa o mesmo motor de fluxos de
Documentos, Treinamentos e Orçamento. As telas do módulo continuam sendo onde os dados são
preenchidos (tabelas `dgt_bom_*`); o fluxo controla **quem** age, **quando** (prazo em dias
úteis), **quais ações** existem em cada etapa e o **histórico**.

## Etapas

Dados da demanda → Matriz Go/No-Go → (GO) Seleção de kit → Cálculo de HH → B.O.M. pronto →
**Aprovação do B.O.M.** → B.O.M. aprovado.

| Caminho | Regra |
|---|---|
| GO com restrição | vai para **Parecer da restrição**; "Liberar a seleção de kit" exige o parecer. |
| NO-GO | vai para **Bloqueado no Go/No-Go**: encerrar a demanda (comentário obrigatório) ou reabrir a análise. |
| Devoluções | "Voltar"/"Ajustar" exigem comentário e voltam para a etapa indicada. |
| Aprovação | aprovar conclui o processo; devolver exige comentário e volta para B.O.M. pronto, Seleção de kit ou Cálculo de HH (a lista congelada volta a ser editável; o envio anterior fica guardado). |

A decisão do Go/No-Go é a calculada pelo módulo (`GO` → `go`, `GO com restrição` →
`restricao`, `NO-GO` → `nogo`), comparada pelo gateway do fluxo.

## Como funciona

- Estado do fluxo de cada B.O.M.: `dgt_bom_bom.dgt_bom_fluxoestado` (JSON), gravado com ETag —
  duas pessoas agindo ao mesmo tempo: a segunda é recusada. A etapa também é gravada em
  `dgt_bom_etapa` (listas, filtros e Power BI).
- Valores dos campos do fluxo: calculados a partir dos dados do módulo na hora de cada ação
  (`services/bom/fluxoBom.ts` → `valoresDoBom`). Nada é cadastrado em dobro.
- Botões de conclusão das telas (Concluir dados da demanda, Registrar análise, Concluir seleção de
  kit, Avançar para B.O.M. pronto, Enviar para aprovação) gravam os dados e executam a ação
  principal da etapa. As demais ações ficam no painel **Fluxo do B.O.M.**, acima das telas.
- Só os responsáveis pela etapa atual alteram os dados dela; o perfil Administrador não passa por
  cima do fluxo.
- B.O.M. criado antes do fluxo: ao ser aberto, o fluxo começa na etapa em que ele já estava
  (registrado no histórico).
- Sem a coluna, sem o processo ou sem fluxo publicado, o módulo segue como antes e o
  Administrador vê o motivo na visão geral.

## Ativar

1. `scripts/dataverse/criar-fluxo-bom.ps1 -UrlAmbiente <url> -Solucao <solução>`.
2. Arquitetura de Soluções → visão geral (Administrador) → **Criar o fluxo em Processos**
   (marque "Publicar agora" ou deixe como rascunho para revisar). O processo ARQ-SOL e o fluxo
   passam a aparecer em Processos → Fluxos. Alternativa manual: Processos → processo
   **ARQ-SOL** → editor do fluxo → **Importar JSON** com
   `docs/exemplos/pacote-arquitetura-solucoes-fluxo.json` (o pacote não tem `ambiente`: não cria
   ambiente nem outro processo; campos existentes são mantidos). Sem o processo, importe pelo
   botão Importar JSON de Processos → Fluxos (cria o ARQ-SOL uma vez).
3. Revise a atividade **Aprovação do B.O.M.** (aprovador e prazo) e **publique**.
4. Perfis de segurança: aprovadores precisam de Ler e Gravar em `dgt_bom_bom`.
