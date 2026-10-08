import {
  Pagina
} from './routes';

export type ModuloIntranet =
  | 'inicio'
  | 'treinamentos'
  | 'documentos'
  | 'processos'
  | 'licitacoes'
  | 'arquitetura'
  | 'outro';

const paginasTreinamentos:
  Pagina[] = [
    'treinamentosVisaoGeral',
    'treinamentos',
    'trilhas',
    'historico',
    'certificados',
    'executarTreinamento',
    'executarModulo',
    'avaliacao',
    'equipe',
    'gestao',
    'novoTreinamento',
    'atribuirTreinamento',
    'gestaoTrilhas',
    'gestaoModulos',
    'gestaoAvaliacoes',
    'gestaoAreas',
    'gestaoConformidade',
    'catalogoTreinamentos',
    'testeTreinamento'
  ];

const paginasDocumentos:
  Pagina[] = [
    'documentos',
    'documentoDetalhe',
    'novoDocumento',
    'gestaoDocumentos'
  ];

const paginasLicitacoes:
  Pagina[] = [
    'licitacoes',
    'licitacoesTeste'
  ];

export const obterModuloPagina =
  (
    pagina:
      Pagina
  ):
    ModuloIntranet => {

    if (
      pagina ===
      'inicio'
    ) {
      return 'inicio';
    }

    if (
      pagina ===
      'processos'
    ) {
      return 'processos';
    }

    if (
      paginasTreinamentos
        .indexOf(
          pagina
        ) >=
      0
    ) {
      return 'treinamentos';
    }

    if (
      paginasDocumentos
        .indexOf(
          pagina
        ) >=
      0
    ) {
      return 'documentos';
    }

    if (
      paginasLicitacoes
        .indexOf(
          pagina
        ) >=
      0
    ) {
      return 'licitacoes';
    }

    if (pagina === 'arquitetura') {
      return 'arquitetura';
    }

    return 'outro';
  };

export const paginaEhTreinamentos =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'treinamentos';

export const paginaEhProcessos =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'processos';

export const paginaEhDocumentos =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'documentos';

export const paginaEhLicitacoes =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'licitacoes';

export const paginaEhArquitetura =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'arquitetura';
