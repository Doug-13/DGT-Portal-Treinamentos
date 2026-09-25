import {
  Pagina
} from './routes';

export type ModuloIntranet =
  | 'inicio'
  | 'treinamentos'
  | 'documentos'
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
    'gestaoConformidade'
  ];

const paginasDocumentos:
  Pagina[] = [
    'documentos',
    'documentoDetalhe',
    'novoDocumento',
    'gestaoDocumentos'
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

export const paginaEhDocumentos =
  (
    pagina:
      Pagina
  ): boolean =>
    obterModuloPagina(
      pagina
    ) ===
    'documentos';
