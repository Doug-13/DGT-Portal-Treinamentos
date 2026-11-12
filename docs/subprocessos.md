# Subprocesso nos fluxos (um fluxo que abre documentos em outro fluxo)

O **Subprocesso** é um elemento do editor de fluxo que, quando o documento
passa por ele, **cria documentos que seguem outro fluxo** e os **referencia
no documento atual**. Exemplo típico — auditoria:

```
Fluxo "Auditoria" (documento pai: QUA-AUD-001)
  Registrar constatações ── tabela "Ações": O quê | Responsável (Usuário) | Prazo
        │
  [Subprocesso] Abrir planos de ação  ──►  QUA-PDA-004  (fluxo "Plano de Ação", responsável: Ana)
        │                              ──►  QUA-PDA-005  (fluxo "Plano de Ação", responsável: Bruno)
  Verificar eficácia ── campo "Ações abertas" mostra QUA-PDA-004 e QUA-PDA-005
        │
       Fim
```

- Um documento por **linha preenchida** da tabela (ou um único documento).
- Cada documento criado já **começa o próprio fluxo**: o responsável da
  1ª etapa recebe a pendência na hora.
- Os documentos criados são gravados num campo **Documentos referenciados
  (vários)** do pai. A aba **Referências** mostra a ligação nos dois
  sentidos (o pai *referencia* os filhos; cada filho é *referenciado por* o pai).
- Depois de criar os filhos, o pai pode **seguir para a próxima etapa** ou
  **aguardar todos serem concluídos** (configurável — seção 2.1).
- Nada é apagado; tudo fica no histórico do pai e dos filhos.

Não há tabela nova no Dataverse: o subprocesso usa as tabelas de documentos,
revisões e fluxo que já existem.

---

## 1. Preparar o fluxo FILHO (ex.: Plano de Ação)

1. **Processos → Fluxos** → processo do plano de ação.
2. Aba **Metadados**: crie os campos que vão receber dados do pai, por exemplo:
   - *Prazo* (Data)
   - *Auditoria de origem* (Documento referenciado) — para o plano mostrar de onde veio.
3. Desenhe o fluxo. Na 1ª etapa, use o responsável **Autor da revisão**: é
   a pessoa definida pelo subprocesso (ex.: a coluna Responsável da linha).
4. **Publique** o fluxo. Sem versão publicada, o subprocesso não cria documentos.

## 2. Preparar o fluxo PAI (ex.: Auditoria)

1. Aba **Metadados**:
   - tabela **Ações** com as colunas *O quê* (Texto), *Responsável* (**Usuário** —
     tipo de coluna novo) e *Prazo* (Data);
   - campo **Ações abertas** do tipo **Documentos referenciados (vários)**.
2. Na etapa *Registrar constatações*, adicione o campo **Ações**.
3. Na **paleta** do editor (barra de ícones à esquerda do desenho), arraste o
   **Subprocesso**: é o ícone de **retângulo com borda grossa e um “+” embaixo**,
   logo abaixo do ícone de Tarefa (passe o mouse: *“Subprocesso (cria documentos
   em outro fluxo)”*). No padrão BPMN é a *chamada de processo* (Call Activity).
   Uma tarefa já desenhada também pode virar subprocesso pela chave inglesa
   (*Trocar tipo* → *Subprocesso*). Ligue-o depois da etapa; ele deve ter
   **uma só saída**.
4. Duplo clique no subprocesso e configure:

| Campo | Exemplo |
|---|---|
| Fluxo que eles seguem | PDA-001 — Plano de Ação |
| Tipo do documento | PDA — Plano de Ação |
| Área | Mesma área deste documento |
| Quantos documentos | Um por linha da tabela **Ações** |
| Título | `{pai.codigo} — Ação {n}: {coluna:oque}` |
| Autor da revisão do novo documento | Coluna “Responsável” da linha |
| Guardar os documentos criados no campo | Ações abertas |
| Valores levados | Coluna: Prazo → Prazo · Este documento (como referência) → Auditoria de origem |

5. Nas etapas seguintes (ex.: *Verificar eficácia*), mostre o campo
   **Ações abertas** como **somente leitura** para o auditor acompanhar.
6. **Verificar fluxo** → **Publicar**. A verificação recusa subprocessos
   incompletos (sem fluxo, sem campo de referências do tipo certo, coluna de
   autor que não é Usuário, apontando para o próprio fluxo etc.).

### 2.0 Criar só para algumas linhas (condição)

Em **Quantos documentos → Um por linha de uma tabela**, marque **“Criar só para as
linhas que atendem a uma condição”**, escolha a coluna e marque os valores aceitos.
A coluna precisa ser do tipo **Lista** ou **Sim/Não**. Exemplos:

| Coluna da tabela | Valores marcados | Viram documento |
|---|---|---|
| *Conforme?* (Sim/Não) | Não | só as não conformidades |
| *Gravidade* (Lista: Maior, Menor, Observação) | Maior, Menor | só as não conformidades maiores e menores |
| *Gera ação?* (Sim/Não) | Sim | só as linhas marcadas para ação |

- As demais linhas ficam só na tabela (não viram documento).
- `{n}` no título continua sendo a **posição da linha na tabela**: a 3ª linha vira
  “Ação 3” mesmo que a 1ª e a 2ª não atendam à condição.
- Se nenhuma linha atender (ex.: auditoria sem não conformidades) e o subprocesso
  estiver em **aguardar**, o fluxo segue na hora.
- Uma linha que deixou de atender depois de virar documento **não** apaga o
  documento (nada é apagado); uma linha que passou a atender vira documento na
  próxima passagem pelo subprocesso.

### 2.1 Depois de criar os documentos: seguir ou aguardar

No subprocesso, seção **“Depois de criar os documentos”**:

| Opção | O que acontece com a auditoria |
|---|---|
| **Seguir para a próxima etapa** (padrão) | Cria as ações e vai direto para a etapa seguinte; as ações correm em paralelo. |
| **Aguardar todos serem concluídos** | Cria as ações e **fica parada no subprocesso**. Só segue quando o fluxo de **todas** as ações chegar ao **Fim**. |

No modo **aguardar**:

- Ao concluir a **última** ação, o portal libera a auditoria automaticamente para a
  próxima etapa (ex.: *Verificar eficácia*) e o responsável recebe a pendência.
- Ao abrir a auditoria, a aba **Fluxo** mostra *“Aguardando o subprocesso…”* com a
  lista das ações (✓ concluída / em andamento) e o botão **Conferir agora** — a
  conferência também roda sozinha ao abrir o documento.
- Um **Administrador** pode **Liberar sem esperar** (motivo obrigatório, fica no
  histórico com o nome dele e as ações que estavam pendentes).
- Se nenhuma linha gerar documento (tabela vazia), não há o que esperar: segue na hora.
- Se a criação das ações falhar, a auditoria continua parada (o erro aparece no
  histórico); corrija e use **Liberar sem esperar** ou peça ao administrador.
- Ação “resolvida” = fluxo da ação **concluído** (chegou ao Fim). Desenhe o fluxo do
  Plano de Ação para só chegar ao Fim depois da verificação da ação.
- Quem conclui a última ação precisa de **Gravar** na revisão da auditoria
  (`dgt_documentorevisao`) e de **Criar** em `dgt_tarefafluxo` — é ele quem faz a
  auditoria andar. Se faltar permissão, a auditoria anda quando alguém a abrir.

Marcadores do título: `{pai.codigo}`, `{pai.titulo}`, `{n}` (número da linha),
`{coluna:<chave>}`, `{campo:<chave>}`.

## 3. Permissões

A criação roda com o usuário que concluiu a etapa (ex.: o auditor). Ele precisa,
nas Security Roles:

| Tabela | Privilégios |
|---|---|
| `dgt_documento` | Criar, Ler, Gravar, Acrescentar, Acrescentar a |
| `dgt_documentorevisao` | Criar, Ler, Gravar, Acrescentar, Acrescentar a |
| `dgt_documentoprocesso` | Criar, Ler |
| `dgt_tarefafluxo`, `dgt_historicofluxo` | Criar, Ler, Acrescentar (já exigido pelo fluxo) |
| `dgt_area`, `dgt_usuario` | Ler, Acrescentar a |

A área dos documentos criados precisa ter **sigla** (usada no código ÁREA-TIPO-NNN)
e o tipo escolhido precisa existir na coluna *Tipo* de `dgt_documento`.

## 4. Roteiro de teste

1. Crie o documento da auditoria e avance até *Registrar constatações*.
2. Preencha 2 linhas na tabela Ações (com responsáveis diferentes) e uma vazia → **Concluir**.
3. Confira no documento da auditoria:
   - campo **Ações abertas** com 2 documentos (a linha vazia é ignorada);
   - histórico do fluxo: *“Subprocesso: 2 documento(s) criado(s): …”*;
   - aba **Referências** → *Referencia* lista os 2 planos.
4. Abra cada plano: código `ÁREA-PDA-NNN`, revisão Rev.00A em Elaboração,
   fluxo já iniciado, Prazo preenchido, *Auditoria de origem* apontando para a
   auditoria e o responsável da linha com a pendência em **Minhas pendências**.
5. Devolva a auditoria para *Registrar constatações*, acrescente uma 3ª linha e
   conclua de novo: só **1** documento novo é criado (as linhas já usadas não se repetem).

## 5. Comportamento e limites desta versão

- **Aguardar + publicação**: se logo depois de um subprocesso que aguarda vier uma
  etapa de publicação (status Vigente), a publicação fica como *Publicação
  pendente* no documento pai (botão na aba Fluxo). Prefira uma etapa humana entre
  o subprocesso e a publicação.
- **Em ambientes** o subprocesso não cria documentos; no modo aguardar o registro
  é liberado na hora (não trava).
- **Erros não bloqueiam o pai.** Se uma linha falhar (tipo inexistente, área sem
  sigla, permissão), as demais seguem; o problema aparece no histórico do fluxo
  do pai com “Atenção: …”. Documentos já criados ficam referenciados.
- **Linha alterada depois de virar documento** é tratada como linha nova (a
  identificação é pelo conteúdo, porque as linhas da tabela não têm código).
- **Retornar um passo** (administrador) não apaga documentos já criados.
- Se a gravação do pai falhar depois de os filhos terem sido criados (ex.:
  outra pessoa alterou a revisão ao mesmo tempo), repetir a ação pode criar
  os documentos de novo. Raro; confira os documentos antes de repetir.
- **Modo de teste local** (`FLUXO_PERSISTENCIA = 'local'`): a passagem pelo
  subprocesso só é registrada no histórico; nenhum documento é criado.


---

## Valores levados para o novo documento (mapeamento pai → filho)

Os fluxos têm metadados próprios; cada par **origem → campo do filho** faz a ponte (campo do pai,
coluna da linha, referência/código/título do pai). Na configuração do subprocesso:

- **Compatibilidade** em cada par: ✓ ok · ⚠ aviso (ex.: opções de lista que não existem no filho) ·
  ✕ incompatível (bloqueia a publicação no editor).
- **Somente leitura no filho** (por par): o valor herdado não pode ser alterado no filho.
- **Mapear automaticamente**: sugere pares por **mesma chave** ou **mesmo nome**, com tipo compatível.
- **Criar no filho**: campos deste processo que o fluxo filho não tem são criados lá com a **mesma
  chave** e definição (tipo, opções, regra de exibição) e já entram mapeados. (Mesma chave = caminho
  aberto para, no futuro, compartilhar metadados entre processos.)

Na criação do filho, cada valor é **ajustado ao tipo** do campo de destino (Usuário/Área/Documento →
Texto vira o nome/código; lista aceita a opção sem diferenciar maiúsculas; data dd/mm/aaaa vira
aaaa-mm-dd). O que não puder ser aproveitado fica em branco e é registrado no histórico do filho
(*"Valores do documento de origem não aproveitados"*). É uma **cópia do momento da criação**: mudanças
posteriores no pai não alteram o filho.

Os valores herdados ficam **protegidos** da limpeza que roda nas devoluções do fluxo filho (antes, um
campo herdado que aparecia editável numa etapa ainda não percorrida podia ser apagado numa devolução).
