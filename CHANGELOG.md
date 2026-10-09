# Histórico de versões do Portal DGT

Anote as mudanças em "Não publicado" enquanto desenvolve, uma por linha,
começando por "- Novo:", "- Melhoria:" ou "- Correção:". No próximo
`.\Gerar-Versao.ps1` elas passam para a nova versão e aparecem em "Novidades".

## [Não publicado]

## [1.4.2] - 2026-10-09

- Melhoria: ajustes e correções internas.

## [1.4.1] - 2026-10-09

- Novo: revisão de treinamento (Rev.01, Rev.02…) com motivo, alterações e opção de retreinar quem já concluiu, sem apagar conclusões anteriores.
- Novo: histórico de revisões do treinamento na Gestão e revisão atual ao lado do código.
- Novo: "Adicionar usuários" em Usuários e acessos, que cadastra no portal com um clique as pessoas já liberadas no ambiente, com opção de vincular à área.
- Novo: parecer "Participar / Não participar" com justificativa e histórico nas licitações, no cartão da busca e na pré-visualização do edital.
- Novo: filtro por parecer na lista de licitações (sem parecer, participar, não participar).
- Novo: módulos concluídos podem ser revisados e as verificações refeitas a qualquer momento, sem alterar a conclusão, a nota ou o certificado.
- Melhoria: certificados em cards com prévia do PDF, selo de validade, filtros, busca e visualização dentro do portal.
- Melhoria: a tela Certificados mostra o número, a revisão do treinamento em que o colaborador foi treinado e abre/baixa o PDF gerado pelo fluxo.
- Melhoria: o código do treinamento aparece nos cards de Meus treinamentos.
- Melhoria: a tela Novidades mostra 5 itens por versão, com "Ver mais".
- Correção: "Concluir módulo" grava a conclusão e o progresso do treinamento é calculado pelos módulos concluídos (antes ficava fixo em 50% na tela inicial).
- Correção: o módulo só pode ser concluído dentro dele, depois de responder corretamente as perguntas obrigatórias.
- Correção: a avaliação é liberada ao concluir os módulos obrigatórios, abre a avaliação ativa que tem questões e mostra o motivo real quando não pode ser aberta.
- Correção: atribuir um treinamento que o usuário já possui (por outra trilha ou individualmente) não cria mais duplicidade.

## [1.4.0] - 2026-10-08

- Novo: tela Registros de Oportunidade no módulo Arquitetura de Soluções, centralizando as oportunidades vinculadas aos B.O.M.
- Novo: integração com registros de oportunidade (R.O.) para carregar e utilizar dados da demanda no fluxo de Arquitetura de Soluções.
- Melhoria: Matriz Go/No-Go atualizada para utilizar as informações da oportunidade e apoiar a avaliação da demanda.
- Melhoria: navegação do módulo Arquitetura de Soluções ampliada com novas rotas e acesso aos Registros de Oportunidade.
- Melhoria: controle de acesso ao módulo Arquitetura ajustado nas telas Usuários e acessos, menus e permissões de rota.
- Melhoria: interface e ícones do módulo Arquitetura atualizados para manter o padrão visual do Portal DGT.
- Novo: integração dos Indicadores com o ClickUp, com sincronização de dados para acompanhamento das iniciativas e resultados no portal.
- Novo: plugin de sincronização com o ClickUp e documentação técnica da integração dos Indicadores.
- Novo: configuração avançada da Pergunta rápida nos módulos, com modal próprio para definir e editar as opções da atividade.
- Melhoria: gestão de módulos e avaliações aprimorada, com ações reorganizadas e edição de conteúdos mais consistente.
- Melhoria: controle de acesso aos Indicadores refinado, respeitando perfil do usuário, permissões por módulo e papéis por área.
- Melhoria: tela Usuários e acessos atualizada para facilitar a administração das permissões dos módulos do portal.
- Melhoria: navegação e permissões das rotas ajustadas para refletir corretamente os módulos disponíveis para cada usuário.
- Novo: script para adicionar o papel de Editor de Área no Dataverse, permitindo ampliar a configuração de permissões por área.
- Correção: Indicadores (dados sensíveis) liberados por padrão só para Gestores e Administradores; Colaboradores e Editores acessam apenas com o módulo marcado em Usuários e acessos.
- Novo: módulo Arquitetura de Soluções, com a Visão geral dos B.O.M., Novo B.O.M., Dados da demanda e Matriz Go/No-Go (seleção de kit e cálculo de HH em definição).
- Novo: colunas "Criado em" e "Vencimento" na lista de documentos e no detalhe; o documento deve ser revisado 1 ano após a criação ou a última publicação, com aviso nos últimos 30 dias e quando vencido.
- Correção: a publicação pelo fluxo do processo passa a definir o prazo da próxima revisão (periodicidade de 12 meses).

## [1.3.0] - 2026-10-06

- Melhoria: histórico único na aba Histórico, no formato da tramitação, com quem executou cada ação e quem disparou os passos automáticos.
- Melhoria: o primeiro evento do histórico aparece como "Documento criado".
- Melhoria: ao criar um documento, ele abre direto na primeira etapa do fluxo, e a lista de documentos já mostra o novo documento.
- Melhoria: no Novo documento, o campo Aprovador passou a ser "Gestor da área"; quem executa cada etapa é definido no fluxo do processo.
- Melhoria: a aba Fluxo de revisão mostra o desenho do fluxo; a etapa atual, os metadados e os botões ficam na aba Revisão.
- Melhoria: a aba Fluxo de revisão sempre mostra o fluxo; sem revisão em andamento, exibe o caminho percorrido pela última revisão.
- Melhoria: a caixa de responsável mostra quem responde pela etapa atual — o criador, o usuário, a área (todos da área podem executar) ou o gestor da área.
- Correção: os metadados preenchidos em uma etapa seguem para as próximas etapas.
- Correção: o novo documento é vinculado ao processo antes de abrir, e a aba Revisão já mostra a etapa do fluxo.
- Correção: a publicação do fluxo é bloqueada quando uma etapa "Vigente" leva a outra etapa "Vigente".

## [1.2.0] - 2026-10-05

- Melhoria: ajustes e correções internas.

## [1.1.0] - 2026-10-05

- Novo: menu do usuário (clique no nome, no topo) com Meu perfil, Usuários e acessos e Áreas e acessos.
- Novo: tela Meu perfil, com as áreas, o papel em cada área e o que o usuário acessa no portal.
- Novo: tela Usuários e acessos para administradores (todos os usuários) e gestores (somente as pessoas das suas áreas), com perfil no portal, papéis por área e módulos.
- Novo: papel por área — a mesma pessoa pode ser Membro em uma área e Gestor em outra; ser Gestor de uma área libera equipe, atribuição, aprovação e gestão de pessoas somente naquela área.
- Novo: módulos liberados por usuário (Treinamentos, Documentos, Processos, Licitações e Indicadores); módulos não liberados somem do menu.
- Novo: script scripts/dataverse/criar-coluna-modulos-acesso.ps1, que cria a coluna "Módulos de acesso" na tabela Usuário.
- Novo: módulo Licitações, com busca de oportunidades no PNCP por assunto, UF, período, modalidades, palavras, valor e score de aderência.
- Novo: teste de conexão com o PNCP na aba Licitações, com diagnóstico de rede e CORS.
- Novo: pré-visualização do edital com resumo, ficha técnica, itens, documentos e o edital aberto dentro do portal.
- Novo: "Copiar resumo" e "Imprimir ficha" do edital, e relatório da busca para salvar em PDF.
- Novo: módulo Processos no menu, com área, metadados e documentos vinculados a cada processo.
- Novo: editor visual do fluxo de revisão de cada processo, com etapas, decisões, caminhos, responsáveis, prazos e botões configuráveis.
- Novo: versões do fluxo do processo (rascunho, publicada e arquivada); revisões em andamento continuam na versão em que começaram.
- Novo: consulta da configuração de cada etapa, decisão e evento nas versões publicadas e arquivadas do fluxo (somente leitura).
- Novo: metadados do processo, inclusive o tipo Tabela, exibidos nas etapas na ordem definida no processo.
- Novo: evento de revisão no fluxo (círculo com "R"), com os tipos Sub-revisão, Revisão, Nova revisão e Fechar revisão.
- Novo: numeração de revisão e sub-revisão — o documento nasce Rev.00A, cada ajuste gera a próxima letra (00B, 00C) e a aprovação fecha no número (Rev.00); a revisão seguinte nasce Rev.01A.
- Novo: status "Vigente" na etapa do fluxo: ao chegar nela a revisão é publicada e o fluxo da revisão termina.
- Novo: o retreinamento na publicação é decidido pelo caminho do fluxo (ex.: passar por "Revisar Treinamento").
- Novo: confirmação ao clicar em uma ação do fluxo, mostrando a próxima atividade, o responsável, o prazo, a mudança de número da revisão e o que o sistema fará automaticamente, com o comentário.
- Novo: no Novo documento é possível escolher o processo, e o Aprovador passa a ser o responsável da etapa de aprovação do fluxo.
- Novo: revisões de documentos vinculados a um processo seguem as etapas do fluxo, com as ações da etapa direto na aba Revisão.
- Novo: aba "Fluxo de revisão" no documento, com o desenho do fluxo, a etapa atual e o histórico da tramitação.
- Novo: a publicação da revisão é feita pelo fluxo, com ou sem retreinamento, e o status do documento acompanha cada etapa.
- Novo: setas ‹ › para navegar entre as revisões do documento e lista dos números anteriores da revisão.
- Novo: a aba Histórico do documento mostra todos os passos do fluxo, com o número da revisão de cada momento.
- Melhoria: cores no histórico — verde para aprovação, vermelho para reprovação, laranja para sub-revisão, índigo para revisão e verde escuro para publicação.
- Melhoria: tela de detalhe do documento mais limpa, sem informações repetidas e com campos exibidos só quando têm valor.
- Melhoria: os caminhos de uma decisão mostram o percurso depois dos eventos (ex.: "→ Revisão → Elaboração"), evitando confundir destinos com o mesmo nome.
- Melhoria: membros da área veem todos os documentos da área, e quem responde por uma etapa vê o documento mesmo fora da sua área.
- Melhoria: "Minhas pendências" mostra as etapas do fluxo que aguardam o usuário.
- Melhoria: a barra de resumo do documento mostra o responsável pelo documento, e o responsável da etapa aparece no quadro do fluxo.
- Correção: uma reprovação nunca conclui, publica ou avança o documento; o fluxo é bloqueado na publicação da versão e na execução.
- Correção: a aprovação nunca pula número de revisão (Rev.00A → Rev.00, e não Rev.01).
- Correção: a revisão publicada nunca fica com letra (Rev.01B é publicada como Rev.01).
- Correção: a gravação do fluxo não é mais recusada como conflito depois das tarefas automáticas.
- Correção: "Criar treinamento" sempre abre um cadastro em branco, e não o último treinamento editado.
- Correção: a pré-visualização do edital não fica mais cortada nem atrás da barra do SharePoint.
- Correção: Licitações aparece no menu somente para quem tem o módulo liberado, igual ao que mostra o perfil.
- Correção: o "Autor da revisão" é quem criou a revisão, e somente os responsáveis da etapa veem os botões de ação.
- Correção: as pendências de revisões com fluxo vão para os responsáveis da etapa, e não para o aprovador do cadastro.
- Correção: o Novo documento não falha mais quando sobrou um arquivo de uma tentativa anterior, nem cria documento sem revisão se o envio do arquivo falhar.
- Melhoria: ações secundárias agrupadas no menu ⋮ (módulos: Desativar e Remover; treinamentos: Histórico, Desativar e Remover).
- Novo: remover módulo (somente administradores, para módulos que nenhum colaborador iniciou).
- Novo: arrastar e soltar os módulos para mudar a ordem.
- Correção: a numeração dos módulos segue a posição e nunca se repete.
- Novo: controle de versão do portal, com número visível e tela de Novidades.
- Novo: botão Remover treinamento (somente administradores, para treinamentos nunca atribuídos).
- Novo: capa do treinamento na lista da Gestão e descrição com "Ver mais".
- Melhoria: áreas da tela Documentos em formato compacto, com busca e "Mostrar todas".
- Novo: aba Catálogo e modo de teste do treinamento (visão do colaborador, sem registros).
- Correção: editar um treinamento não cria mais uma cópia.
- Correção: validação do tamanho e conversão automática do link da imagem do SharePoint.

