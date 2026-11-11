import {
  IconeChave
} from '../components/common/Icones';

// ============================================================
// AMBIENTES DINÂMICOS
//
// Um ambiente é uma área de trabalho criada pelo Administrador no
// próprio portal (botão "+ Adicionar ambiente"), sem código novo:
// ex.: Processo, Licitações, Compras, Jurídico...
//
//   IAmbiente          → dgt_ambiente
//   IAmbienteRegistro  → dgt_ambienteregistro
//
// Cada ambiente:
//   - aparece no menu lateral para quem tem o módulo "amb:<chave>"
//     liberado (Usuários e acessos — igual aos módulos fixos);
//   - tem um PROCESSO próprio (dgt_processo, código AMB-<CHAVE>),
//     criado junto com o ambiente. O fluxo é desenhado e publicado na
//     tela Processos → Fluxos, com o mesmo editor dos documentos;
//   - cada registro do ambiente (solicitação, processo licitatório,
//     pedido...) percorre esse fluxo: etapas, responsáveis, campos,
//     prazos e ações vêm do desenho publicado.
//
// Regra do projeto: nada é apagado. Ambientes são desativados e
// registros são cancelados; o histórico do fluxo fica no registro.
// ============================================================

export interface IAmbiente {
  id: string;

  // Identificador permanente (minúsculas, números e hífen). Fica
  // gravado nas liberações dos usuários: NÃO muda depois de criado.
  chave: string;

  nome: string;

  descricao: string;

  // Frase curta do cabeçalho do ambiente.
  subtitulo: string;

  icone: IconeChave;

  ordem: number;

  ativo: boolean;

  // Liberado para todos os usuários sem lista própria de módulos.
  liberadoParaTodos: boolean;

  // Perfis que recebem o ambiente sem liberação explícita
  // (ex.: ['Gestor', 'Administrador']).
  perfisPadrao: string[];

  // Processo (dgt_processo) cujo fluxo os registros seguem.
  processoId: string;

  processoNome: string;

  // Prefixo do código dos registros (ex.: "LIC" → LIC-2026-0001).
  prefixoCodigo: string;

  // Como cada registro é chamado na tela (ex.: "Solicitação").
  rotuloRegistro: string;

  // Configuração das telas (visões, colunas, etapas) em JSON — ver
  // services/ambientes/layoutAmbiente.ts. Vazio = gerada do fluxo.
  layoutJson: string;

  // Anexos dos registros (SharePoint) — ver AnexosAmbienteService.
  permiteAnexos?: boolean;
  bibliotecaAnexos?: string;

  // Tela do registro: mostrar a sequência de atividades no topo.
  // undefined (ambiente antigo, sem a configuração) = mostra.
  mostrarSequencia?: boolean;
}

export type SituacaoRegistroAmbiente =
  | 'emAndamento'
  | 'concluido'
  | 'cancelado';

export interface IAmbienteRegistro {
  id: string;

  ambienteId: string;

  codigo: string;

  titulo: string;

  descricao: string;

  // Área do registro (responsável "Gestor da área" do fluxo).
  areaId: string;

  areaNome: string;

  // Quem abriu (responsável "Autor da revisão" do fluxo).
  solicitanteId: string;

  solicitanteNome: string;

  situacao: SituacaoRegistroAmbiente;

  etapaAtual: string;

  // Id do elemento do fluxo da etapa atual (filtros por etapa).
  etapaAtualId: string;

  // Valores dos campos do fluxo (colunas e filtros da visão geral).
  valores: Record<string, string>;

  prazoEtapa: string;

  criadoEm: string;

  concluidoEm: string;
}

export interface INovoAmbiente {
  // Fluxo do ambiente:
  //   vazio → o portal cria um processo novo (AMB-<CHAVE>);
  //   id    → usa um fluxo já existente em Processos → Fluxos.
  // Na edição, um id diferente do atual TROCA o fluxo do ambiente
  // (registros em andamento terminam no fluxo em que começaram).
  processoId?: string;
  nome: string;
  chave: string;
  descricao: string;
  subtitulo: string;
  icone: IconeChave;
  ordem: number;
  liberadoParaTodos: boolean;
  perfisPadrao: string[];
  prefixoCodigo: string;
  rotuloRegistro: string;
  // Anexos dos registros (SharePoint). O que cada etapa permite vem da
  // configuração "Anexo de arquivo" da etapa no fluxo.
  permiteAnexos?: boolean;
  // Caminho da biblioteca no site do portal (vazio = Documentos).
  bibliotecaAnexos?: string;
  // Tela do registro: sequência de atividades no topo (padrão: sim).
  mostrarSequencia?: boolean;
}

export interface IEdicaoAmbiente extends INovoAmbiente {
  ativo: boolean;
}

export interface INovoRegistroAmbiente {
  titulo: string;
  descricao: string;
  areaId: string;
}

// Ícones que o Administrador pode escolher para um ambiente.
export const ICONES_AMBIENTE: Array<{ chave: IconeChave; nome: string }> = [
  { chave: 'workflow', nome: 'Fluxo' },
  { chave: 'gavel', nome: 'Martelo (jurídico/licitação)' },
  { chave: 'fileText', nome: 'Documento' },
  { chave: 'folder', nome: 'Pasta' },
  { chave: 'building', nome: 'Prédio' },
  { chave: 'package', nome: 'Pacote' },
  { chave: 'wallet', nome: 'Carteira' },
  { chave: 'users', nome: 'Pessoas' },
  { chave: 'checkCircle', nome: 'Verificação' },
  { chave: 'barChart', nome: 'Gráfico' },
  { chave: 'grid', nome: 'Grade' },
  { chave: 'layers', nome: 'Camadas' },
  { chave: 'settings', nome: 'Engrenagem' },
  { chave: 'search', nome: 'Lupa' },
  { chave: 'megaphone', nome: 'Megafone' },
  { chave: 'activity', nome: 'Atividade' }
];

// Fluxo (dgt_processo) que pode ser escolhido para um ambiente.
export interface IFluxoOpcaoAmbiente {
  id: string;
  codigo: string;
  nome: string;
  // Tem versão publicada (sem ela o ambiente não aceita registros).
  publicado: boolean;
  // Quantos ambientes já usam este fluxo.
  ambientes: string[];
}
