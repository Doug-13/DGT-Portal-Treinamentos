// ============================================================
// ARQUIVO GERADO AUTOMATICAMENTE por scripts/versao.js
// Não edite à mão: anote as mudanças em CHANGELOG.md
// ("## [Não publicado]") e rode npm run build.
// ============================================================

export type TipoNovidade = 'Novo' | 'Melhoria' | 'Correção';

export interface INovidadeItem {
  tipo: TipoNovidade;
  texto: string;
}

export interface INovidadeVersao {
  versao: string;
  data: string;
  itens: INovidadeItem[];
}

export const VERSAO_PORTAL = "1.4.1";

export const VERSAO_SOLUCAO = "1.4.1.0";

export const DATA_BUILD = "2026-10-09T16:48:13.419Z";

export const COMMIT_BUILD = "a05343f";

export const NOVIDADES: INovidadeVersao[] = [
  {
    "versao": "1.4.1",
    "data": "2026-10-09",
    "itens": [
      {
        "tipo": "Novo",
        "texto": "revisão de treinamento (Rev.01, Rev.02…) com motivo, alterações e opção de retreinar quem já concluiu, sem apagar conclusões anteriores."
      },
      {
        "tipo": "Novo",
        "texto": "histórico de revisões do treinamento na Gestão e revisão atual ao lado do código."
      },
      {
        "tipo": "Novo",
        "texto": "\"Adicionar usuários\" em Usuários e acessos, que cadastra no portal com um clique as pessoas já liberadas no ambiente, com opção de vincular à área."
      },
      {
        "tipo": "Novo",
        "texto": "parecer \"Participar / Não participar\" com justificativa e histórico nas licitações, no cartão da busca e na pré-visualização do edital."
      },
      {
        "tipo": "Novo",
        "texto": "filtro por parecer na lista de licitações (sem parecer, participar, não participar)."
      },
      {
        "tipo": "Novo",
        "texto": "módulos concluídos podem ser revisados e as verificações refeitas a qualquer momento, sem alterar a conclusão, a nota ou o certificado."
      },
      {
        "tipo": "Melhoria",
        "texto": "certificados em cards com prévia do PDF, selo de validade, filtros, busca e visualização dentro do portal."
      },
      {
        "tipo": "Melhoria",
        "texto": "a tela Certificados mostra o número, a revisão do treinamento em que o colaborador foi treinado e abre/baixa o PDF gerado pelo fluxo."
      },
      {
        "tipo": "Melhoria",
        "texto": "o código do treinamento aparece nos cards de Meus treinamentos."
      },
      {
        "tipo": "Melhoria",
        "texto": "a tela Novidades mostra 5 itens por versão, com \"Ver mais\"."
      },
      {
        "tipo": "Correção",
        "texto": "\"Concluir módulo\" grava a conclusão e o progresso do treinamento é calculado pelos módulos concluídos (antes ficava fixo em 50% na tela inicial)."
      },
      {
        "tipo": "Correção",
        "texto": "o módulo só pode ser concluído dentro dele, depois de responder corretamente as perguntas obrigatórias."
      },
      {
        "tipo": "Correção",
        "texto": "a avaliação é liberada ao concluir os módulos obrigatórios, abre a avaliação ativa que tem questões e mostra o motivo real quando não pode ser aberta."
      },
      {
        "tipo": "Correção",
        "texto": "atribuir um treinamento que o usuário já possui (por outra trilha ou individualmente) não cria mais duplicidade."
      }
    ]
  },
  {
    "versao": "1.4.0",
    "data": "2026-10-08",
    "itens": [
      {
        "tipo": "Novo",
        "texto": "tela Registros de Oportunidade no módulo Arquitetura de Soluções, centralizando as oportunidades vinculadas aos B.O.M."
      },
      {
        "tipo": "Novo",
        "texto": "integração com registros de oportunidade (R.O.) para carregar e utilizar dados da demanda no fluxo de Arquitetura de Soluções."
      },
      {
        "tipo": "Melhoria",
        "texto": "Matriz Go/No-Go atualizada para utilizar as informações da oportunidade e apoiar a avaliação da demanda."
      },
      {
        "tipo": "Melhoria",
        "texto": "navegação do módulo Arquitetura de Soluções ampliada com novas rotas e acesso aos Registros de Oportunidade."
      },
      {
        "tipo": "Melhoria",
        "texto": "controle de acesso ao módulo Arquitetura ajustado nas telas Usuários e acessos, menus e permissões de rota."
      },
      {
        "tipo": "Melhoria",
        "texto": "interface e ícones do módulo Arquitetura atualizados para manter o padrão visual do Portal DGT."
      },
      {
        "tipo": "Novo",
        "texto": "integração dos Indicadores com o ClickUp, com sincronização de dados para acompanhamento das iniciativas e resultados no portal."
      },
      {
        "tipo": "Novo",
        "texto": "plugin de sincronização com o ClickUp e documentação técnica da integração dos Indicadores."
      },
      {
        "tipo": "Novo",
        "texto": "configuração avançada da Pergunta rápida nos módulos, com modal próprio para definir e editar as opções da atividade."
      },
      {
        "tipo": "Melhoria",
        "texto": "gestão de módulos e avaliações aprimorada, com ações reorganizadas e edição de conteúdos mais consistente."
      },
      {
        "tipo": "Melhoria",
        "texto": "controle de acesso aos Indicadores refinado, respeitando perfil do usuário, permissões por módulo e papéis por área."
      },
      {
        "tipo": "Melhoria",
        "texto": "tela Usuários e acessos atualizada para facilitar a administração das permissões dos módulos do portal."
      },
      {
        "tipo": "Melhoria",
        "texto": "navegação e permissões das rotas ajustadas para refletir corretamente os módulos disponíveis para cada usuário."
      },
      {
        "tipo": "Novo",
        "texto": "script para adicionar o papel de Editor de Área no Dataverse, permitindo ampliar a configuração de permissões por área."
      },
      {
        "tipo": "Correção",
        "texto": "Indicadores (dados sensíveis) liberados por padrão só para Gestores e Administradores; Colaboradores e Editores acessam apenas com o módulo marcado em Usuários e acessos."
      },
      {
        "tipo": "Novo",
        "texto": "módulo Arquitetura de Soluções, com a Visão geral dos B.O.M., Novo B.O.M., Dados da demanda e Matriz Go/No-Go (seleção de kit e cálculo de HH em definição)."
      },
      {
        "tipo": "Novo",
        "texto": "colunas \"Criado em\" e \"Vencimento\" na lista de documentos e no detalhe; o documento deve ser revisado 1 ano após a criação ou a última publicação, com aviso nos últimos 30 dias e quando vencido."
      },
      {
        "tipo": "Correção",
        "texto": "a publicação pelo fluxo do processo passa a definir o prazo da próxima revisão (periodicidade de 12 meses)."
      }
    ]
  },
  {
    "versao": "1.3.0",
    "data": "2026-10-06",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "histórico único na aba Histórico, no formato da tramitação, com quem executou cada ação e quem disparou os passos automáticos."
      },
      {
        "tipo": "Melhoria",
        "texto": "o primeiro evento do histórico aparece como \"Documento criado\"."
      },
      {
        "tipo": "Melhoria",
        "texto": "ao criar um documento, ele abre direto na primeira etapa do fluxo, e a lista de documentos já mostra o novo documento."
      },
      {
        "tipo": "Melhoria",
        "texto": "no Novo documento, o campo Aprovador passou a ser \"Gestor da área\"; quem executa cada etapa é definido no fluxo do processo."
      },
      {
        "tipo": "Melhoria",
        "texto": "a aba Fluxo de revisão mostra o desenho do fluxo; a etapa atual, os metadados e os botões ficam na aba Revisão."
      },
      {
        "tipo": "Melhoria",
        "texto": "a aba Fluxo de revisão sempre mostra o fluxo; sem revisão em andamento, exibe o caminho percorrido pela última revisão."
      },
      {
        "tipo": "Melhoria",
        "texto": "a caixa de responsável mostra quem responde pela etapa atual — o criador, o usuário, a área (todos da área podem executar) ou o gestor da área."
      },
      {
        "tipo": "Correção",
        "texto": "os metadados preenchidos em uma etapa seguem para as próximas etapas."
      },
      {
        "tipo": "Correção",
        "texto": "o novo documento é vinculado ao processo antes de abrir, e a aba Revisão já mostra a etapa do fluxo."
      },
      {
        "tipo": "Correção",
        "texto": "a publicação do fluxo é bloqueada quando uma etapa \"Vigente\" leva a outra etapa \"Vigente\"."
      }
    ]
  },
  {
    "versao": "1.2.0",
    "data": "2026-10-05",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.1.0",
    "data": "2026-10-05",
    "itens": [
      {
        "tipo": "Novo",
        "texto": "menu do usuário (clique no nome, no topo) com Meu perfil, Usuários e acessos e Áreas e acessos."
      },
      {
        "tipo": "Novo",
        "texto": "tela Meu perfil, com as áreas, o papel em cada área e o que o usuário acessa no portal."
      },
      {
        "tipo": "Novo",
        "texto": "tela Usuários e acessos para administradores (todos os usuários) e gestores (somente as pessoas das suas áreas), com perfil no portal, papéis por área e módulos."
      },
      {
        "tipo": "Novo",
        "texto": "papel por área — a mesma pessoa pode ser Membro em uma área e Gestor em outra; ser Gestor de uma área libera equipe, atribuição, aprovação e gestão de pessoas somente naquela área."
      },
      {
        "tipo": "Novo",
        "texto": "módulos liberados por usuário (Treinamentos, Documentos, Processos, Licitações e Indicadores); módulos não liberados somem do menu."
      },
      {
        "tipo": "Novo",
        "texto": "script scripts/dataverse/criar-coluna-modulos-acesso.ps1, que cria a coluna \"Módulos de acesso\" na tabela Usuário."
      },
      {
        "tipo": "Novo",
        "texto": "módulo Licitações, com busca de oportunidades no PNCP por assunto, UF, período, modalidades, palavras, valor e score de aderência."
      },
      {
        "tipo": "Novo",
        "texto": "teste de conexão com o PNCP na aba Licitações, com diagnóstico de rede e CORS."
      },
      {
        "tipo": "Novo",
        "texto": "pré-visualização do edital com resumo, ficha técnica, itens, documentos e o edital aberto dentro do portal."
      },
      {
        "tipo": "Novo",
        "texto": "\"Copiar resumo\" e \"Imprimir ficha\" do edital, e relatório da busca para salvar em PDF."
      },
      {
        "tipo": "Novo",
        "texto": "módulo Processos no menu, com área, metadados e documentos vinculados a cada processo."
      },
      {
        "tipo": "Novo",
        "texto": "editor visual do fluxo de revisão de cada processo, com etapas, decisões, caminhos, responsáveis, prazos e botões configuráveis."
      },
      {
        "tipo": "Novo",
        "texto": "versões do fluxo do processo (rascunho, publicada e arquivada); revisões em andamento continuam na versão em que começaram."
      },
      {
        "tipo": "Novo",
        "texto": "consulta da configuração de cada etapa, decisão e evento nas versões publicadas e arquivadas do fluxo (somente leitura)."
      },
      {
        "tipo": "Novo",
        "texto": "metadados do processo, inclusive o tipo Tabela, exibidos nas etapas na ordem definida no processo."
      },
      {
        "tipo": "Novo",
        "texto": "evento de revisão no fluxo (círculo com \"R\"), com os tipos Sub-revisão, Revisão, Nova revisão e Fechar revisão."
      },
      {
        "tipo": "Novo",
        "texto": "numeração de revisão e sub-revisão — o documento nasce Rev.00A, cada ajuste gera a próxima letra (00B, 00C) e a aprovação fecha no número (Rev.00); a revisão seguinte nasce Rev.01A."
      },
      {
        "tipo": "Novo",
        "texto": "status \"Vigente\" na etapa do fluxo: ao chegar nela a revisão é publicada e o fluxo da revisão termina."
      },
      {
        "tipo": "Novo",
        "texto": "o retreinamento na publicação é decidido pelo caminho do fluxo (ex.: passar por \"Revisar Treinamento\")."
      },
      {
        "tipo": "Novo",
        "texto": "confirmação ao clicar em uma ação do fluxo, mostrando a próxima atividade, o responsável, o prazo, a mudança de número da revisão e o que o sistema fará automaticamente, com o comentário."
      },
      {
        "tipo": "Novo",
        "texto": "no Novo documento é possível escolher o processo, e o Aprovador passa a ser o responsável da etapa de aprovação do fluxo."
      },
      {
        "tipo": "Novo",
        "texto": "revisões de documentos vinculados a um processo seguem as etapas do fluxo, com as ações da etapa direto na aba Revisão."
      },
      {
        "tipo": "Novo",
        "texto": "aba \"Fluxo de revisão\" no documento, com o desenho do fluxo, a etapa atual e o histórico da tramitação."
      },
      {
        "tipo": "Novo",
        "texto": "a publicação da revisão é feita pelo fluxo, com ou sem retreinamento, e o status do documento acompanha cada etapa."
      },
      {
        "tipo": "Novo",
        "texto": "setas ‹ › para navegar entre as revisões do documento e lista dos números anteriores da revisão."
      },
      {
        "tipo": "Novo",
        "texto": "a aba Histórico do documento mostra todos os passos do fluxo, com o número da revisão de cada momento."
      },
      {
        "tipo": "Melhoria",
        "texto": "cores no histórico — verde para aprovação, vermelho para reprovação, laranja para sub-revisão, índigo para revisão e verde escuro para publicação."
      },
      {
        "tipo": "Melhoria",
        "texto": "tela de detalhe do documento mais limpa, sem informações repetidas e com campos exibidos só quando têm valor."
      },
      {
        "tipo": "Melhoria",
        "texto": "os caminhos de uma decisão mostram o percurso depois dos eventos (ex.: \"→ Revisão → Elaboração\"), evitando confundir destinos com o mesmo nome."
      },
      {
        "tipo": "Melhoria",
        "texto": "membros da área veem todos os documentos da área, e quem responde por uma etapa vê o documento mesmo fora da sua área."
      },
      {
        "tipo": "Melhoria",
        "texto": "\"Minhas pendências\" mostra as etapas do fluxo que aguardam o usuário."
      },
      {
        "tipo": "Melhoria",
        "texto": "a barra de resumo do documento mostra o responsável pelo documento, e o responsável da etapa aparece no quadro do fluxo."
      },
      {
        "tipo": "Correção",
        "texto": "uma reprovação nunca conclui, publica ou avança o documento; o fluxo é bloqueado na publicação da versão e na execução."
      },
      {
        "tipo": "Correção",
        "texto": "a aprovação nunca pula número de revisão (Rev.00A → Rev.00, e não Rev.01)."
      },
      {
        "tipo": "Correção",
        "texto": "a revisão publicada nunca fica com letra (Rev.01B é publicada como Rev.01)."
      },
      {
        "tipo": "Correção",
        "texto": "a gravação do fluxo não é mais recusada como conflito depois das tarefas automáticas."
      },
      {
        "tipo": "Correção",
        "texto": "\"Criar treinamento\" sempre abre um cadastro em branco, e não o último treinamento editado."
      },
      {
        "tipo": "Correção",
        "texto": "a pré-visualização do edital não fica mais cortada nem atrás da barra do SharePoint."
      },
      {
        "tipo": "Correção",
        "texto": "Licitações aparece no menu somente para quem tem o módulo liberado, igual ao que mostra o perfil."
      },
      {
        "tipo": "Correção",
        "texto": "o \"Autor da revisão\" é quem criou a revisão, e somente os responsáveis da etapa veem os botões de ação."
      },
      {
        "tipo": "Correção",
        "texto": "as pendências de revisões com fluxo vão para os responsáveis da etapa, e não para o aprovador do cadastro."
      },
      {
        "tipo": "Correção",
        "texto": "o Novo documento não falha mais quando sobrou um arquivo de uma tentativa anterior, nem cria documento sem revisão se o envio do arquivo falhar."
      },
      {
        "tipo": "Melhoria",
        "texto": "ações secundárias agrupadas no menu ⋮ (módulos: Desativar e Remover; treinamentos: Histórico, Desativar e Remover)."
      },
      {
        "tipo": "Novo",
        "texto": "remover módulo (somente administradores, para módulos que nenhum colaborador iniciou)."
      },
      {
        "tipo": "Novo",
        "texto": "arrastar e soltar os módulos para mudar a ordem."
      },
      {
        "tipo": "Correção",
        "texto": "a numeração dos módulos segue a posição e nunca se repete."
      },
      {
        "tipo": "Novo",
        "texto": "controle de versão do portal, com número visível e tela de Novidades."
      },
      {
        "tipo": "Novo",
        "texto": "botão Remover treinamento (somente administradores, para treinamentos nunca atribuídos)."
      },
      {
        "tipo": "Novo",
        "texto": "capa do treinamento na lista da Gestão e descrição com \"Ver mais\"."
      },
      {
        "tipo": "Melhoria",
        "texto": "áreas da tela Documentos em formato compacto, com busca e \"Mostrar todas\"."
      },
      {
        "tipo": "Novo",
        "texto": "aba Catálogo e modo de teste do treinamento (visão do colaborador, sem registros)."
      },
      {
        "tipo": "Correção",
        "texto": "editar um treinamento não cria mais uma cópia."
      },
      {
        "tipo": "Correção",
        "texto": "validação do tamanho e conversão automática do link da imagem do SharePoint."
      }
    ]
  }
];

// Itens de "## [Não publicado]" (próxima versão, em preparação).
export const NOVIDADES_PENDENTES: INovidadeItem[] = [];
