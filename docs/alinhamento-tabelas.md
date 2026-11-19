# Alinhamento das tabelas do Dataverse

Plano para eliminar tabelas duplicadas e alinhar referências **sem quebrar funcionalidades em uso**. Este documento é o ponto de controle do trabalho: cada fase só começa depois que a anterior foi validada.

Ordem: **0. diagnóstico → 1. remoção sem impacto → 2. certificados → 3. referências → 4. PMO → 5. pessoa externa**.

---

## 1. Regras do trabalho

### Módulos protegidos

As tabelas destes módulos são a **referência**. Os outros módulos se adaptam a elas.

| Módulo | Tabelas |
|---|---|
| Base (pessoas e áreas) | `dgt_usuario`, `dgt_area`, `dgt_usuarioarea` |
| Treinamentos | `dgt_treinamento`, `dgt_modulo*`, `dgt_avaliacao`, `dgt_questao`, `dgt_alternativa`, `dgt_midia`, `dgt_treinamentorevisao`, `dgt_trilha*`, `dgt_treinamentoarea`, `dgt_grupotrilha`, `dgt_funcaotrilha`, `dgt_usuariotreinamento`, `dgt_usuariotrilha`, `dgt_usuariomodulo`, `dgt_tentativa*`, `dgt_resposta`, `dgt_certificado` |
| Documentos | `dgt_documento`, `dgt_documentorevisao`, `dgt_documentoprocesso`, `dgt_documentosetor`, `dgt_treinamentodocumento`, `dgt_revisaoimpacto`, `dgt_assinatura` |
| Processos | `dgt_processo`, `dgt_fluxo`, `dgt_processometadado`, `dgt_tarefafluxo`, `dgt_historicofluxo`, `dgt_processonegocio`, `dgt_processonegociofluxo` |
| Planejamento orçamentário | `dgt_orcamento*` |
| Apoio | `dgt_auditorianegocio`, `dgt_setor`, `dgt_funcao`, `dgt_grupo` (referenciadas pelas tabelas acima) |

Nas tabelas protegidas é permitido **somente**: incluir coluna nova opcional, incluir opção nova em coluna de escolha e incluir índice ou chave alternativa. Não se renomeia, não se remove e não se muda o tipo de nenhuma coluna existente.

### Como cada mudança é feita (expandir → migrar → contrair)

1. **Expandir:** cria a coluna ou tabela nova sem tirar nada do que existe.
2. **Gravar nos dois:** o portal passa a gravar no novo e no antigo, e a ler do novo com fallback para o antigo. Publica-se uma versão.
3. **Migrar:** um script copia os dados antigos para o novo formato. O script é idempotente e tem modo de simulação (`-Simular`).
4. **Validar:** o diagnóstico é executado de novo e o módulo é testado pelos usuários-chave.
5. **Contrair:** após **um ciclo completo (mínimo de 30 dias)** sem problemas, o portal deixa de usar o antigo. A remoção física é a última etapa e exige backup.

### Garantias

- **Histórico não se move nem se apaga.** Tabelas de histórico ficam como estão. Registros migrados recebem uma observação "migrado para…" e são desativados, nunca excluídos.
- **Backup antes de qualquer remoção:** exportar a solução (gerenciada e não gerenciada) e as linhas da tabela em CSV.
- **Cada fase é uma versão do portal**, com entrada no `CHANGELOG.md` e reversão possível pela versão anterior do `.sppkg`.
- **Dependências externas:** fluxos do Power Automate e relatórios do Power BI são verificados antes de cada remoção (o diagnóstico encontra os fluxos; o Power BI é conferido manualmente).

---

## 2. Decisões por item

| # | Sobreposição | Decisão | Quem se adapta | Fase |
|---|---|---|---|---|
| 1 | `dgt_servidorcatalogo` e `dgt_servidoralerta` × `dgt_kititem` | **Remover** as tabelas antigas. O portal já usa só `dgt_kititem`. | Kits | 1 |
| 2 | `dgt_certificadoexterno` (tipo "certificação") × `dgt_certificacaofabricante` | **Separar por regra**: certificado externo = formação, cursos e NRs; certificação de fabricante e registro profissional = `dgt_certificacaofabricante`. Migrar os externos que forem certificação de fabricante. | RH | 2 |
| 3 | Fabricante em texto em `dgt_declaracaofabricante`, `dgt_certificacaofabricante` e `dgt_bom_ro` | **Lookup para `dgt_fabricante`**, mantendo o texto. | RH, Arquitetura | 3 |
| 4 | Área em texto em `dgt_terceiro` e `dgt_certificacaofabricante` | **Lookup para `dgt_area`** (confirmado: os valores são áreas da empresa). | RH | 3 |
| 5 | `dgt_projeto*` × `dgt_implregistro` | **Fonte única = `dgt_implregistro`**. As tabelas `dgt_projeto*` foram uma carga única e serão removidas (ver fase 4). | Implantações, Indicadores | 4 |
| 6 | `dgt_terceiro` × `dgt_fornecedorcolaborador` | **Vincular**, sem fundir (opção A, decidida em 19/11/2026). | RH | 5 |

### Itens que ficam como estão (e por quê)

| Item | Motivo |
|---|---|
| `dgt_documentoprocesso` (derivada do processo de negócio) | Tabelas protegidas. Funciona como cache mantido pelo `ProcessoNegocioService`. O diagnóstico (verificação 6) passa a conferir a coerência. |
| Estado de fluxo em tabelas (Documentos) × JSON (Orçamento e Ambientes) | Os dois modelos pertencem a módulos protegidos. Ambientes já segue o padrão do Orçamento. |
| Tabelas de histórico de cada módulo | Histórico não se migra. **Para módulos novos:** usar `dgt_auditorianegocio`, a não ser que o histórico precise de colunas próprias. |
| `dgt_usuario.dgt_cargo` × `dgt_usuarioarea.dgt_cargo` | **Não é duplicação:** o primeiro é o cargo do Entra ID; o segundo é o cargo na hierarquia da área, usado pelos fluxos de aprovação. |
| Área do Cálculo de HH (`dgt_hhcalculo.dgt_area`) | **Não é duplicação:** é a chave do modelo de cálculo (Implantação, Suporte), não uma área da empresa. |
| Função em texto de terceiros e de colaboradores de fornecedor | `dgt_funcao` é o catálogo de funções **internas** usado nas trilhas. Função de pessoa externa é outro domínio. |
| `dgt_setor`, `dgt_documentosetor`, `dgt_grupotrilha`, `dgt_funcaotrilha` | Sem uso hoje, mas pertencem a módulos protegidos e estão previstas no roadmap. Ficam, marcadas como sem uso na seção 6.21 do README. |
| Licitações ligadas por `dgt_chaveedital` (texto) | Baixa prioridade. Melhoria futura: chave alternativa em `dgt_licitacaoacompanhamento.dgt_chaveedital`. |

---

## 3. Fases

### Fase 0 – Diagnóstico (somente leitura)

```powershell
cd scripts\dataverse
.\diagnosticar-alinhamento-tabelas.ps1 -EnvironmentUrl https://suaorg.crm2.dynamics.com
```

Gera `Alinhamento_Diagnostico_AAAAMMDD-HHMM.csv`. Peça a um **administrador do ambiente** para rodar também, porque só aparecem os fluxos do Power Automate que o usuário consegue ver. O relatório pode conter nomes de contas: trate-o como dado pessoal e apague após o uso.

| Verificação | O que responde | Decide |
|---|---|---|
| 1 | As tabelas `dgt_servidor*` têm linhas, dependências ou fluxos? | Fase 1 |
| 2 | As tabelas `dgt_projeto*` têm dados? Quem grava e quando foi a última alteração? | Fase 4 |
| 3 | Quais tipos existem em `dgt_certificadoexterno`? | Fase 2 |
| 4 | Quantas pessoas estão em `dgt_terceiro` e em `dgt_fornecedorcolaborador`? (só contagem; o CPF não é lido) | Fase 5 |
| 5 | Os valores de área e de fabricante em texto já existem nos cadastros? | Fase 3 |
| 6 | O vínculo `dgt_documentoprocesso` bate com o fluxo definido pelo processo de negócio? | Correção pontual, se houver |

#### Resultado da primeira execução (19/11/2026)

| Verificação | Resultado | Leitura |
|---|---|---|
| 1 – `dgt_servidor*` | 10 e 11 linhas, última alteração em 09/11/2026; sem fluxos e sem dependências | Têm dados: **não remover antes de conferir o catálogo em `dgt_kititem`** (verificação 7). |
| 1 – `dgt_setor`, `dgt_documentosetor`, `dgt_grupotrilha`, `dgt_funcaotrilha` | Vazias, sem fluxos | Sem risco de dados. Ficam (módulos protegidos e roadmap). |
| 2 – PMO | `dgt_projeto` 1 linha, `dgt_projetoatividade` 307 linhas, gravadas pela conta "Processos, Automação" em 27/10/2026; medição e progresso vazias | **Carga única**, sem atualização desde então. O painel grava em `dgt_implregistro` (coleções `atividades` e `faturamentos`). Dashboards com a fonte `projetos.atividades` mostram dados parados em 27/10. |
| 3 – Certificados externos | Sem linhas no relatório | Erro do script (lista vazia era descartada), corrigido. Provavelmente não há registros ativos: confirmar na próxima execução. |
| 4 – Pessoa externa | Sem linhas no relatório | Mesmo erro. Provavelmente `dgt_fornecedorcolaborador` ainda está vazia (recurso publicado na 1.4.28): confirmar. |
| 5 – Área em texto | `SUPORTE` e `INTELIGÊNCIA` existem em `dgt_area` (3 registros) | A área de terceiros e certificações **é a área da empresa**: lookup confirmado. |
| 5 – Fabricante em texto | Intelbras, Hikvision, Dahua, TP-Link e NHS sem correspondente (82 registros em `dgt_bom_ro`, 1 em `dgt_declaracaofabricante`) | Falta cadastrar esses 5 fabricantes em `dgt_fabricante`. |
| 6 – `dgt_documentoprocesso` | 50 coerentes, 0 divergentes, 14 sem processo de negócio | Cache íntegro. Nada a corrigir. |

#### Resultado da segunda execução (19/11/2026)

A segunda execução teve um erro de contagem nas verificações 1, 2 e 5, corrigido no script. A terceira execução (10:59), já com a correção, reproduziu exatamente os números da primeira nessas verificações e os da segunda nas demais.

| Verificação | Resultado | Leitura |
|---|---|---|
| 3 – Certificados externos | Nenhum registro ativo | Fase 2 vira só a regra do formulário: **não há o que migrar**. |
| 4 – Pessoa externa | 0 terceiros ativos (1 inativo), 2 colaboradores de fornecedor ativos, nenhuma coincidência | Não há duplicação hoje. Decidir a fase 5 agora custa quase nada. |
| 7 – Catálogo de servidores | `dgt_kititem`: 43 linhas de servidor e 4 fichas de software, alteradas em 06/11/2026 | Catálogo completo (as 43 combinações da especificação). As tabelas antigas têm só 21 linhas, de um teste em 09/11. **Fase 1 liberada.** |
| 8 – Fabricantes | Um cadastro: "DASHUA" | Erro de digitação de "Dahua". **Atualização:** o registro está desativado (a tela de Fabricantes mostra "Nenhum fabricante cadastrado"), então não há o que corrigir: a migração cadastra os cinco fabricantes. O diagnóstico passou a separar ativos e inativos. |
| 9 – PMO | Nenhum dashboard usa `projetos.atividades`. `dgt_implregistro`: 7.568 atividades de 27 projetos (alteradas em 18/11), 45 faturamentos, 28 projetos | Confirmado: o dado vivo está em `dgt_implregistro`. Remover `dgt_projeto*` **não afeta nenhuma tela nem dashboard**. |

### Fase 1 – Remover `dgt_servidorcatalogo` e `dgt_servidoralerta`

**Pré-condição:** sem fluxos e sem dependências (confirmado) **e** verificação 7 mostrando o catálogo de servidores presente em `dgt_kititem`. As 21 linhas das tabelas antigas vieram de uma versão alternativa do seletor (arquivo `servidores.patch`, que não foi incorporado ao código); o portal atual não as lê.

1. Exportar a solução e as 21 linhas em CSV.
2. Conferir os 11 alertas exportados com os alertas das 4 fichas de software em **Kits → Servidores**. Algum texto que só exista na tabela antiga é cadastrado na ficha correspondente.
3. Remover `servidores.patch` do repositório.
4. Retirar as tabelas da solução e excluí-las no Power Apps.
5. Remover `criar-tabelas-servidores.ps1` do repositório (ou marcá-lo como obsoleto) e tirar as tabelas da seção 6 do README.

Impacto no portal: nenhum (o código não usa essas tabelas). Reversão: importar a solução exportada.

### Fase 2 – Certificados do RH

**Regra daqui em diante:** `dgt_certificadoexterno` guarda formação, cursos e NRs; `dgt_certificacaofabricante` guarda certificações de fabricante e registros profissionais (CREA/CFT). `dgt_certificado` (treinamentos) não muda.

Não há certificados externos ativos (verificação 3), então **não há migração**.

1. **Portal:** o formulário de certificado externo deixa de oferecer o tipo "Certificação de fabricante" e orienta o RH para a aba Fabricantes e terceiros.
2. Atualizar a descrição da tabela `dgt_certificadoexterno` com a regra.

Impacto: RH – Pessoas. O arquivo no SharePoint não é movido; o novo registro aponta para a mesma URL.

### Fase 3 – Referências em texto → lookup

**Situação: implementada no código; aguardando implantação.**

| Tabela | Coluna de texto (mantida) | Coluna nova (lookup) |
|---|---|---|
| `dgt_declaracaofabricante` | `dgt_fabricante` | `dgt_FabricanteCadastro` → `dgt_fabricante` |
| `dgt_certificacaofabricante` | `dgt_emissor` (só na categoria "Certificação de fabricante") | `dgt_FabricanteCadastro` → `dgt_fabricante` |
| `dgt_certificacaofabricante` | `dgt_area` | `dgt_AreaCadastro` → `dgt_area` |
| `dgt_terceiro` | `dgt_area` | `dgt_AreaCadastro` → `dgt_area` |
| `dgt_bom_ro` | `dgt_bom_fabricante` | `dgt_bom_FabricanteCadastro` → `dgt_fabricante` |

A certificação de fabricante entrou na lista durante a implementação: o fabricante dela fica em `dgt_emissor` e é o mesmo cadastro. No registro profissional o emissor é um órgão (CREA, CFT) e não ganha vínculo.

**Como o portal grava** (`services/cadastros/ReferenciasCadastroService.ts`):

- O texto continua sendo gravado e lido como antes. Telas, filtros, exportações, Power BI e prazos de validade dos ROs não mudam.
- O lookup é gravado **depois** do registro, numa chamada separada, a partir do texto (mesma correspondência por nome ou sigla). Se a coluna ainda não existir ou faltar privilégio, o registro já está salvo e o erro vai só para o console.
- Mudanças visíveis: a lista de áreas passa a vir do cadastro `dgt_area`; o RO passa a oferecer também os fabricantes do cadastro; um aviso aparece quando o fabricante digitado não está cadastrado.

### Fase 5 – Opção A: vínculo terceiro ↔ colaborador de fornecedor

**Situação: decidida (opção A); implementada no código; aguardando implantação.**

- `dgt_terceiro` ganha os lookups `dgt_FornecedorColaborador` e `dgt_Fornecedor`.
- No cadastro do terceiro (RH e Pessoas → Fabricantes e terceiros) aparece o campo opcional **Colaborador de fornecedor**. Ao escolher, nome, empresa e função são sugeridos (só se estiverem vazios). Um colaborador só pode estar vinculado a um terceiro.
- O RH lê apenas nome, função e fornecedor do colaborador. **O CPF nunca é lido** e ASO, NR e CPF continuam só em Fornecedores.
- O campo só aparece quando as colunas existem e o perfil do RH pode ler `dgt_fornecedorcolaborador`.

### Implantação das fases 3 e 5

| Passo | O que fazer | Impacto se parar aqui |
|---|---|---|
| 1 | Rodar `scripts/dataverse/criar-colunas-alinhamento.ps1` (só acrescenta colunas) | Nenhum |
| 2 | Ajustar os perfis de segurança (lista no fim do script) | Nenhum |
| 3 | ~~Corrigir "DASHUA"~~ **Dispensado**: o registro está desativado (não aparece no portal nem na migração). A migração cadastra "Dahua" | — |
| 4 | `migrar-referencias-alinhamento.ps1 -CadastrarFabricantesFaltantes` (simulação) e conferir o CSV | Nenhum (só leitura) |
| 5 | Rodar de novo com `-Aplicar` | Vínculos preenchidos; textos intactos |
| 6 | Gerar a versão (`Gerar-Versao.ps1`) e publicar o portal | Portal passa a gravar os vínculos |
| 7 | Testes da tabela abaixo | — |

A ordem 1–5 e 6 pode ser invertida: o portal funciona igual antes e depois das colunas existirem.

**Testes após a publicação**

| Teste | Esperado |
|---|---|
| RH: nova certificação de fabricante com um fabricante cadastrado | Salva; o registro fica com `dgt_FabricanteCadastro` preenchido |
| RH: certificação com fabricante fora do cadastro | Salva com o aviso; lookup vazio |
| RH: novo terceiro vinculado a um colaborador de fornecedor | Selo "Colaborador de fornecedor" na lista; o colaborador fica indisponível para outro terceiro |
| Arquitetura: novo RO | Salva; `dgt_bom_FabricanteCadastro` preenchido; validade calculada como antes |
| Usuário sem o privilégio Acrescentar | Continua salvando normalmente (vínculo vazio, aviso só no console) |
| Rodar o diagnóstico de novo | Verificação 5 sem "sem correspondente" para os fabricantes cadastrados |

**Contração** (depois de um ciclo de 30 dias): avaliar se os campos de texto viram apenas cópia do nome do cadastro. Até lá, nada muda nas colunas de texto.

### Fase 4 – Projetos (PMO)

**Decisão:** a fonte única é `dgt_implregistro`. As tabelas `dgt_projeto*` receberam uma carga única em 27/10/2026 e não são atualizadas.

Nenhum dashboard usa a fonte `projetos.atividades` (verificação 9), então a remoção não tem impacto no portal.

1. **Confirmar que não há rotina** gravando nelas: a conta "Processos, Automação" pode ter fluxos que o seu usuário não vê. Sem gravação desde 27/10, o risco é baixo, mas um administrador deve conferir os fluxos dessa conta.
2. **Trocar a fonte `projetos.atividades`** para ler a coleção `atividades` de `dgt_implregistro`, com o mesmo `id` e os mesmos campos, para que ela mostre dados atuais quando alguém criar um dashboard com ela. Publicar uma versão do portal.
3. Exportar as linhas (1 projeto e 307 atividades) e remover as quatro tabelas `dgt_projeto*` na mesma janela de manutenção.

### Fase 5 – Registro da decisão

Opções avaliadas em 19/11/2026: **A – vincular** (escolhida) e B – fundir as tabelas (descartada: juntaria CPF com e-mail e telefone e exigiria nova avaliação de LGPD). Na data havia 2 colaboradores de fornecedor ativos e nenhum terceiro ativo, sem coincidências.

---

## 4. Acompanhamento

| Fase | Situação | Versão do portal | Observações |
|---|---|---|---|
| 0 – Diagnóstico | **Concluída** (19/11/2026; a 3ª execução, com o script corrigido, confirmou todos os números) | — | |
| 1 – Tabelas de servidor | **Liberada** | | Exportar 21 linhas e conferir os 11 alertas |
| 2 – Certificados do RH | **Liberada** (sem migração) | | Só a regra do formulário |
| 3 – Referências em texto | **Código pronto**; implantação pendente (passos 1 a 7) | próxima versão | Inclui a certificação de fabricante |
| 4 – PMO | **Liberada**; falta conferir fluxos da conta "Processos, Automação" | | Nenhum dashboard afetado |
| 5 – Pessoa externa | **Opção A decidida**; código pronto; implantação junto com a fase 3 | próxima versão | Sem migração de dados |
