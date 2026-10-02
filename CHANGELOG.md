# Histórico de versões do Portal DGT

Anote as mudanças em "Não publicado" enquanto desenvolve, uma por linha,
começando por "- Novo:", "- Melhoria:" ou "- Correção:". No próximo
`.\Gerar-Versao.ps1` elas passam para a nova versão e aparecem em "Novidades".

## [Não publicado]

- Novo: módulo Processos no menu, com área, metadados e documentos vinculados a cada processo.
- Novo: editor visual do fluxo de revisão de cada processo, com etapas, decisões, caminhos, responsáveis, prazos e botões configuráveis.
- Novo: versões do fluxo do processo (rascunho, publicada e arquivada); revisões em andamento continuam na versão em que começaram.
- Novo: metadados do processo, inclusive o tipo Tabela, exibidos nas etapas na ordem definida no processo.
- Novo: no Novo documento é possível escolher o processo, e o Aprovador passa a ser o responsável da etapa de aprovação do fluxo.
- Novo: revisões de documentos vinculados a um processo seguem as etapas do fluxo, com as ações da etapa direto na aba Revisão.
- Novo: aba "Fluxo de revisão" no documento, com o desenho do fluxo, a etapa atual e o histórico da tramitação.
- Novo: a publicação da revisão é feita pelo fluxo, com ou sem retreinamento, e o status do documento acompanha cada etapa.
- Melhoria: "Minhas pendências" mostra as etapas do fluxo que aguardam o usuário.
- Melhoria: o card "Responsável" do documento mostra quem está com a etapa atual do fluxo.
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