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

export const VERSAO_PORTAL = "1.0.4";

export const VERSAO_SOLUCAO = "1.0.4.0";

export const DATA_BUILD = "2026-10-05T20:41:29.566Z";

export const COMMIT_BUILD = "3d348e8";

export const NOVIDADES: INovidadeVersao[] = [];

// Itens de "## [Não publicado]" (próxima versão, em preparação).
export const NOVIDADES_PENDENTES: INovidadeItem[] = [
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
    "texto": "metadados do processo, inclusive o tipo Tabela, exibidos nas etapas na ordem definida no processo."
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
    "tipo": "Melhoria",
    "texto": "\"Minhas pendências\" mostra as etapas do fluxo que aguardam o usuário."
  },
  {
    "tipo": "Melhoria",
    "texto": "o card \"Responsável\" do documento mostra quem está com a etapa atual do fluxo."
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
];
