import {
  IFluxoDefinicao
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  FLUXO_MODELOS
} from './definicoes/fluxoPopProcedimento';

import {
  gravarJson,
  lerJson,
  PREFIXO_ARMAZENAMENTO_TESTE
} from '../../utils/armazenamentoLocal';

// ============================================================
// CATÁLOGO DE FLUXOS POR PROCESSO (modo de teste)
//
// Cada processo tem UM fluxo, com várias versões:
//   - no máximo uma "publicado"  (a que vale para revisões novas)
//   - no máximo uma "rascunho"   (a que está sendo editada)
//   - as demais "arquivado"      (continuam valendo para as
//                                 revisões que começaram nelas)
//
// Futuro: dgt_fluxo (+ etapas, ações e transições) no Dataverse.
// Hoje: localStorage do navegador. Nada é gravado no Dataverse.
// ============================================================

export interface IResultadoCatalogo {
  ok: boolean;
  erros: string[];
  definicao?: IFluxoDefinicao;
}

export interface IFluxoCatalogo {
  readonly local: boolean;

  listarVersoes(processoId: string): Promise<IFluxoDefinicao[]>;

  versaoPublicada(processoId: string): Promise<IFluxoDefinicao | undefined>;

  obterVersao(fluxoId: string, versao: number): Promise<IFluxoDefinicao | undefined>;

  criarAPartirDoModelo(processo: IProcesso, modeloId: string): Promise<IResultadoCatalogo>;

  salvarRascunho(definicao: IFluxoDefinicao): Promise<IResultadoCatalogo>;

  publicarRascunho(processoId: string): Promise<IResultadoCatalogo>;

  criarNovaVersao(processoId: string): Promise<IResultadoCatalogo>;

  descartarRascunho(processoId: string): Promise<IResultadoCatalogo>;
}

const PREFIXO_FLUXOS =
  `${PREFIXO_ARMAZENAMENTO_TESTE}fluxos-processo:`;

const PREFIXO_ID_FLUXO =
  'processo-';

export const idFluxoDoProcesso = (
  processoId: string
): string =>
  `${PREFIXO_ID_FLUXO}${processoId}`;

const processoDoFluxo = (
  fluxoId: string
): string | undefined =>
  fluxoId.indexOf(PREFIXO_ID_FLUXO) === 0
    ? fluxoId.slice(PREFIXO_ID_FLUXO.length)
    : undefined;

const copiar = (
  definicao: IFluxoDefinicao
): IFluxoDefinicao =>
  JSON.parse(JSON.stringify(definicao)) as IFluxoDefinicao;

const ler = (
  processoId: string
): IFluxoDefinicao[] =>
  lerJson<IFluxoDefinicao[]>(
    PREFIXO_FLUXOS + processoId,
    []
  );

const gravar = (
  processoId: string,
  versoes: IFluxoDefinicao[]
): void => {
  gravarJson(
    PREFIXO_FLUXOS + processoId,
    versoes
  );
};

const ordenar = (
  versoes: IFluxoDefinicao[]
): IFluxoDefinicao[] =>
  versoes
    .slice()
    .sort((a, b) => b.versao - a.versao);

// Regras mínimas para publicar um fluxo.
export const validarDefinicao = (
  definicao: IFluxoDefinicao
): string[] => {

  const erros: string[] = [];

  definicao.elementos
    .filter(elemento => elemento.tipo === 'tarefaHumana')
    .forEach(
      elemento => {

        if (elemento.responsaveis.length === 0) {
          erros.push(`A etapa "${elemento.nome}" não tem responsável.`);
        }

        elemento.responsaveis.forEach(
          responsavel => {
            if (!(responsavel.descricao || '').trim()) {
              erros.push(`Descreva o responsável da etapa "${elemento.nome}".`);
            }
          }
        );

        if (elemento.acoes.length === 0) {
          erros.push(`A etapa "${elemento.nome}" não tem ações.`);
        }

        elemento.acoes.forEach(
          acao => {
            if (!(acao.rotulo || '').trim()) {
              erros.push(`Há uma ação sem nome na etapa "${elemento.nome}".`);
            }
          }
        );

        if (
          elemento.prazoDiasUteis !== undefined &&
          (elemento.prazoDiasUteis < 0 || elemento.prazoDiasUteis > 365)
        ) {
          erros.push(`O prazo da etapa "${elemento.nome}" deve ficar entre 0 e 365 dias úteis.`);
        }
      }
    );

  return erros;
};

export class FluxoCatalogoLocal
  implements IFluxoCatalogo {

  public readonly local: boolean =
    true;

  public async listarVersoes(
    processoId: string
  ): Promise<IFluxoDefinicao[]> {

    return ordenar(
      ler(processoId)
    );
  }

  public async versaoPublicada(
    processoId: string
  ): Promise<IFluxoDefinicao | undefined> {

    return ler(processoId).find(
      definicao => definicao.status === 'publicado'
    );
  }

  public async obterVersao(
    fluxoId: string,
    versao: number
  ): Promise<IFluxoDefinicao | undefined> {

    const processoId =
      processoDoFluxo(fluxoId);

    if (processoId) {
      return ler(processoId).find(
        definicao => definicao.versao === versao
      );
    }

    // Simulações antigas (antes do fluxo pertencer ao processo)
    // usavam a definição do modelo diretamente.
    const modelo =
      FLUXO_MODELOS.find(
        item =>
          item.definicao.id === fluxoId &&
          item.definicao.versao === versao
      );

    return modelo
      ? modelo.definicao
      : undefined;
  }

  public async criarAPartirDoModelo(
    processo: IProcesso,
    modeloId: string
  ): Promise<IResultadoCatalogo> {

    if (ler(processo.id).length > 0) {
      return {
        ok: false,
        erros: ['Este processo já possui fluxo. Crie uma nova versão em vez de outro fluxo.']
      };
    }

    const modelo =
      FLUXO_MODELOS.find(
        item => item.id === modeloId
      );

    if (!modelo) {
      return {
        ok: false,
        erros: ['Modelo de fluxo não encontrado.']
      };
    }

    const definicao: IFluxoDefinicao = {
      ...copiar(modelo.definicao),
      id: idFluxoDoProcesso(processo.id),
      nome: `${processo.codigo ? `${processo.codigo} — ` : ''}${processo.nome}`,
      versao: 1,
      status: 'rascunho',
      processoId: processo.id,
      modeloId: modelo.id,
      criadoEm: new Date().toISOString(),
      publicadoEm: undefined,
      arquivadoEm: undefined
    };

    gravar(processo.id, [definicao]);

    return {
      ok: true,
      erros: [],
      definicao
    };
  }

  public async salvarRascunho(
    definicao: IFluxoDefinicao
  ): Promise<IResultadoCatalogo> {

    if (!definicao.processoId) {
      return { ok: false, erros: ['Fluxo sem processo.'] };
    }

    const versoes =
      ler(definicao.processoId);

    const indice =
      versoes.findIndex(
        item =>
          item.versao === definicao.versao &&
          item.status === 'rascunho'
      );

    if (indice < 0) {
      return {
        ok: false,
        erros: ['Somente versões em rascunho podem ser alteradas. Crie uma nova versão.']
      };
    }

    versoes[indice] =
      copiar(definicao);

    gravar(definicao.processoId, versoes);

    return {
      ok: true,
      erros: [],
      definicao: versoes[indice]
    };
  }

  public async publicarRascunho(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const versoes =
      ler(processoId);

    const rascunho =
      versoes.find(
        item => item.status === 'rascunho'
      );

    if (!rascunho) {
      return { ok: false, erros: ['Não há rascunho para publicar.'] };
    }

    const erros =
      validarDefinicao(rascunho);

    if (erros.length > 0) {
      return { ok: false, erros };
    }

    const agora =
      new Date().toISOString();

    versoes.forEach(
      item => {
        if (item.status === 'publicado') {
          item.status = 'arquivado';
          item.arquivadoEm = agora;
        }
      }
    );

    rascunho.status = 'publicado';
    rascunho.publicadoEm = agora;

    gravar(processoId, versoes);

    return {
      ok: true,
      erros: [],
      definicao: rascunho
    };
  }

  public async criarNovaVersao(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const versoes =
      ler(processoId);

    if (versoes.some(item => item.status === 'rascunho')) {
      return {
        ok: false,
        erros: ['Já existe um rascunho. Publique ou descarte antes de criar outra versão.']
      };
    }

    const base =
      versoes.find(item => item.status === 'publicado') ||
      ordenar(versoes)[0];

    if (!base) {
      return { ok: false, erros: ['Este processo ainda não tem fluxo.'] };
    }

    const maiorVersao =
      versoes.reduce(
        (maior, item) => Math.max(maior, item.versao),
        0
      );

    const nova: IFluxoDefinicao = {
      ...copiar(base),
      versao: maiorVersao + 1,
      status: 'rascunho',
      criadoEm: new Date().toISOString(),
      publicadoEm: undefined,
      arquivadoEm: undefined
    };

    versoes.push(nova);

    gravar(processoId, versoes);

    return {
      ok: true,
      erros: [],
      definicao: nova
    };
  }

  public async descartarRascunho(
    processoId: string
  ): Promise<IResultadoCatalogo> {

    const versoes =
      ler(processoId);

    const restantes =
      versoes.filter(
        item => item.status !== 'rascunho'
      );

    if (restantes.length === versoes.length) {
      return { ok: false, erros: ['Não há rascunho para descartar.'] };
    }

    gravar(processoId, restantes);

    return { ok: true, erros: [] };
  }
}

// Instância única compartilhada pelas telas.
export const fluxoCatalogo: IFluxoCatalogo =
  new FluxoCatalogoLocal();
