import { DataverseService } from '../DataverseService';

// ============================================================
// LANÇAMENTO DO B.O.M. NO CIGAM (Homologação · webhook MAAX)
//
// O portal NÃO chama o webhook: chama a Custom API
// dgt_EnviarBomCigam, cujo plugin lê a lista congelada do B.O.M.,
// monta o corpo e envia com o token guardado na Configuração
// segura do passo. Nenhuma credencial passa pelo navegador.
//
// Cada tentativa fica em dgt_bom_bom.dgt_bom_cigamenvio (JSON),
// criada por scripts/dataverse/criar-integracao-bom-cigam.ps1.
// ============================================================

export const COLUNA_ENVIO_CIGAM = 'dgt_bom_cigamenvio';

export type SituacaoEnvioCigam = 'recebido' | 'indeterminado' | 'recusado';

export interface IEnvioCigam {
  em: string;
  porId: string;
  ambiente: string;
  situacao: SituacaoEnvioCigam;
  http: number;
  mensagem: string;
  itens: number;
  valorTotal: number;
  representante: string;
  unidadeNegocio: string;
  controle: string;
  previsaoVenda: string;
  reenvio: boolean;
  justificativa?: string | null;
}

export interface IParametrosEnvioCigam {
  representante: string;
  unidadeNegocio: string;
  controle: string;
  previsaoVenda: string;   // AAAA-MM-DD
  reenviar?: boolean;
  justificativa?: string;
}

export interface IResultadoEnvioCigam {
  enviado: boolean;
  jaEnviado: boolean;
  ultimo?: IEnvioCigam;
  mensagem?: string;
  segundosEstimados?: number;
}

// undefined = coluna ainda não criada (script não executado).
export const lerEnviosCigam = async (
  dataverse: DataverseService,
  bomId: string
): Promise<IEnvioCigam[] | undefined> => {
  try {
    const lido = await dataverse.obterRegistro('dgt_bom_bom', bomId, [COLUNA_ENVIO_CIGAM]);
    const json = lido ? String(lido.registro[COLUNA_ENVIO_CIGAM] || '') : '';
    if (!json) {
      return [];
    }
    const lista = JSON.parse(json);
    return Array.isArray(lista) ? (lista as IEnvioCigam[]) : [];
  } catch (erro) {
    if (/dgt_bom_cigamenvio/i.test(erro instanceof Error ? erro.message : String(erro))) {
      return undefined;
    }
    throw erro;
  }
};

  export const lancarBomNoCigam = async (
    dataverse: DataverseService,
    bomId: string,
    p: IParametrosEnvioCigam
  ): Promise<IResultadoEnvioCigam> => {
    try {
      const r = await dataverse.chamarCustomApiJson('dgt_EnviarBomCigam', {

        bomId,
        representante: p.representante.trim(),
        unidadeNegocio: p.unidadeNegocio.trim(),
        controle: p.controle.trim().toUpperCase(),
        previsaoVenda: p.previsaoVenda,
        reenviar: !!p.reenviar,
        justificativa: (p.justificativa || '').trim()
      });
      if (!r || Object.keys(r).length === 0) {
        throw new Error(
          'A Custom API dgt_EnviarBomCigam respondeu vazio: o passo do plugin EnviarBomCigamPlugin não está registrado, está desativado ou é assíncrono. Nada foi enviado ao CIGAM.'
        );
      }
      return {
        enviado: r.enviado === true,
        jaEnviado: r.jaEnviado === true,
        ultimo: r.ultimo as IEnvioCigam | undefined,
        mensagem: typeof r.mensagem === 'string' ? r.mensagem : undefined,
        segundosEstimados: typeof r.segundosEstimados === 'number' ? r.segundosEstimados : undefined
      };
    } catch (erro) {
      const texto = erro instanceof Error ? erro.message : String(erro);
      if (/dgt_EnviarBomCigam/i.test(texto) && /not found|não encontrad|Resource not found|404/i.test(texto)) {
        throw new Error('A integração com o CIGAM ainda não foi instalada: execute scripts/dataverse/criar-integracao-bom-cigam.ps1 e registre o passo do plugin.');
      }
      throw erro;
    }
  };

// Andamento estimado de um envio: o webhook responde na hora e o CIGAM
// trabalha em segundo plano (~10 s por item + 10 s). Não há retorno da
// MAAX nesta versão, então o "concluído" é uma PREVISÃO.
export interface IAndamentoEnvio {
  terminoPrevisto: Date;
  emProcessamento: boolean;
  percentual: number;   // 0–100 (estimado)
}

export const segundosEstimadosEnvio = (envio: IEnvioCigam): number =>
  Math.max(20, (Number(envio.itens) || 0) * 10 + 10);

export const andamentoEnvio = (envio: IEnvioCigam, agora: Date = new Date()): IAndamentoEnvio => {
  const inicio = new Date(envio.em).getTime();
  const total = segundosEstimadosEnvio(envio) * 1000;
  const decorrido = Math.max(0, agora.getTime() - inicio);
  return {
    terminoPrevisto: new Date(inicio + total),
    emProcessamento: envio.situacao !== 'recusado' && decorrido < total,
    percentual: Math.min(100, Math.round((decorrido / total) * 100))
  };
};

export const horaCurta = (data: Date): string =>
  data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Envio aceito ou sem resposta: um novo lançamento duplica a oportunidade.
export const envioQueBloqueia = (envios: IEnvioCigam[]): IEnvioCigam | undefined =>
  envios.filter(e => e.situacao === 'recebido' || e.situacao === 'indeterminado').pop();
