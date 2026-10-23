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

export const VERSAO_PORTAL = "1.4.13";

export const VERSAO_SOLUCAO = "1.4.13.0";

export const DATA_BUILD = "2026-10-23T17:38:42.941Z";

export const COMMIT_BUILD = "ba87c69";

export const NOVIDADES: INovidadeVersao[] = [
  {
    "versao": "1.4.13",
    "data": "2026-10-23",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.12",
    "data": "2026-10-22",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.11",
    "data": "2026-10-21",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.10",
    "data": "2026-10-21",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.9",
    "data": "2026-10-21",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.8",
    "data": "2026-10-21",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.7",
    "data": "2026-10-19",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.6",
    "data": "2026-10-19",
    "itens": [
      {
        "tipo": "Novo",
        "texto": "Planejamento orçamentário — cada gestor preenche a sua planilha anual (contas do plano de contas × janeiro a dezembro), podendo adicionar e remover linhas, e envia ao concluir."
      },
      {
        "tipo": "Novo",
        "texto": "visão \"Todas as planilhas\" para o Administrador, com consolidado por grupo, consulta de cada planilha, reabertura e exportação CSV no layout da planilha de orçamento."
      },
      {
        "tipo": "Novo",
        "texto": "aprovação das planilhas do Planejamento orçamentário pelo fluxo CONT-001, com a tela Aprovações e o painel do fluxo na planilha."
      },
      {
        "tipo": "Novo",
        "texto": "etapas do fluxo de aprovação exibidas no Planejamento orçamentário, mostrando em que ponto está cada planilha."
      },
      {
        "tipo": "Novo",
        "texto": "painel de Acompanhamento de licitações, com o registro das licitações acompanhadas e um retrato (snapshot) do edital no momento do acompanhamento."
      },
      {
        "tipo": "Novo",
        "texto": "aba Estrutura da área em RH e Pessoas, com a hierarquia das áreas e o cargo de cada pessoa na área."
      },
      {
        "tipo": "Novo",
        "texto": "scripts criar-tabelas-acompanhamento-licitacoes.ps1 e criar-coluna-cargo-area.ps1 para o Dataverse."
      },
      {
        "tipo": "Melhoria",
        "texto": "os responsáveis das etapas do fluxo passam a considerar a hierarquia das áreas."
      },
      {
        "tipo": "Melhoria",
        "texto": "análise por IA das licitações ajustada (provedores e montagem da análise)."
      },
      {
        "tipo": "Correção",
        "texto": "todo treinamento passa a nascer obrigatoriamente vinculado ao fluxo de treinamentos. Antes de criar, o portal confere o tipo TRN, o processo TRE-001 e o fluxo publicado; se o vínculo falhar, a criação é desfeita e nada fica gravado."
      },
      {
        "tipo": "Correção",
        "texto": "treinamento fora do fluxo não pode ser ativado nem editado: a lista mostra \"⚠ Fora do fluxo de treinamentos\" e o botão \"Vincular ao fluxo\" no lugar de Editar."
      },
      {
        "tipo": "Correção",
        "texto": "ajustes na remoção de treinamento na Gestão."
      }
    ]
  },
  {
    "versao": "1.4.4",
    "data": "2026-10-09",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.3",
    "data": "2026-10-09",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
  {
    "versao": "1.4.2",
    "data": "2026-10-09",
    "itens": [
      {
        "tipo": "Melhoria",
        "texto": "ajustes e correções internas."
      }
    ]
  },
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
  }
];

// Itens de "## [Não publicado]" (próxima versão, em preparação).
export const NOVIDADES_PENDENTES: INovidadeItem[] = [];
