import {
  IFluxoDefinicao,
  IFluxoInstancia
} from '../../models/Fluxo';

import {
  assinaturaPendente
} from '../fluxo/FluxoEngine';

import {
  IConfigAssinatura,
  ISignatarioPedido,
  SITUACOES_FINAIS,
  SituacaoAssinatura,
  liberaComSituacao,
  resolverSignatarios,
  valoresDaSituacao
} from '../fluxo/assinaturaFluxo';

// ============================================================
// CONFERÊNCIA DA ASSINATURA (pura: documentos e ambientes usam)
//
//   1. fluxo parado em "Assinatura digital"? senão, nada a fazer
//   2. pedido com a chave da parada existe? senão, cria (arquivos e
//      signatários com e-mail) — idempotente pela chave
//   3. situação final que libera? aplica os campos e segue o fluxo
// ============================================================

export interface IArquivoAssinatura {
  nome: string;
  url: string;
}

export interface IPedidoAssinatura {
  id: string;
  chave: string;
  titulo: string;
  provedor: string;
  situacao: SituacaoAssinatura;
  origem: 'documento' | 'ambiente';
  alvoId: string;
  codigo: string;
  arquivos: IArquivoAssinatura[];
  signatarios: ISignatarioPedido[];
  ordemSequencial: boolean;
  prazo: string;
  mensagem: string;
  idExterno: string;
  linkAcompanhamento: string;
  arquivoAssinado: string;
  erro: string;
  solicitadoPor: string;
  concluidoEm: string;
}

export interface IRepositorioAssinatura {
  ler(chave: string): Promise<IPedidoAssinatura | undefined>;
  criar(pedido: Omit<IPedidoAssinatura, 'id'>): Promise<IPedidoAssinatura>;
}

export interface IAlvoAssinatura {
  origem: 'documento' | 'ambiente';
  alvoId: string;
  codigo: string;
  titulo: string;
  solicitante: string;
  // Arquivos a assinar, conforme a configuração da etapa.
  arquivos: (config: IConfigAssinatura) => Promise<{ arquivos: IArquivoAssinatura[]; erro?: string }>;
}

export interface IResultadoConferencia {
  pedido?: IPedidoAssinatura;
  config?: IConfigAssinatura;
  liberado: boolean;
  erros: string[];
}

export const conferirAssinatura = async (params: {
  definicao?: IFluxoDefinicao;
  instancia?: IFluxoInstancia;
  alvo: IAlvoAssinatura;
  usuarios: () => Promise<Array<{ id: string; nome: string; email: string }>>;
  repositorio: IRepositorioAssinatura;
  // Libera o fluxo (FluxoService.concluirAssinatura); devolve erros.
  concluir: (chave: string, situacao: SituacaoAssinatura, valores: Record<string, string>) => Promise<string[]>;
  agora?: Date;
}): Promise<IResultadoConferencia> => {

  const pendente = assinaturaPendente(params.definicao, params.instancia);
  if (!pendente || !params.instancia) {
    return { liberado: false, erros: [] };
  }
  const config = pendente.elemento.assinatura;
  if (!config) {
    return { liberado: false, erros: ['A tarefa de assinatura não está configurada.'] };
  }

  let pedido = await params.repositorio.ler(pendente.chave);

  if (!pedido) {
    const { arquivos, erro } = await params.alvo.arquivos(config);
    if (erro || arquivos.length === 0) {
      return { config, liberado: false, erros: [erro || 'Não há arquivo para assinar.'] };
    }
    const { signatarios, erros } = resolverSignatarios(config, params.instancia.valores, await params.usuarios());
    if (erros.length > 0 || signatarios.length === 0) {
      return { config, liberado: false, erros: erros.length > 0 ? erros : ['Nenhum signatário encontrado.'] };
    }
    const agora = params.agora || new Date();
    const prazo = new Date(agora.getTime() + config.prazoDias * 86400000);
    pedido = await params.repositorio.criar({
      chave: pendente.chave,
      titulo: `${params.alvo.codigo} — ${params.alvo.titulo}`.substring(0, 200),
      provedor: config.provedor,
      situacao: 'pendente',
      origem: params.alvo.origem,
      alvoId: params.alvo.alvoId,
      codigo: params.alvo.codigo,
      arquivos,
      signatarios,
      ordemSequencial: config.ordemSequencial,
      prazo: prazo.toISOString(),
      mensagem: config.mensagem || '',
      idExterno: '',
      linkAcompanhamento: '',
      arquivoAssinado: '',
      erro: '',
      solicitadoPor: params.alvo.solicitante,
      concluidoEm: ''
    });
  }

  if (SITUACOES_FINAIS.indexOf(pedido.situacao) >= 0 && liberaComSituacao(config, pedido.situacao)) {
    const erros = await params.concluir(pendente.chave, pedido.situacao, valoresDaSituacao(config, pedido.situacao, pedido.arquivoAssinado));
    return { pedido, config, liberado: erros.length === 0, erros };
  }

  return { pedido, config, liberado: false, erros: [] };
};
