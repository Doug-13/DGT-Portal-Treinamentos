import {
  IFluxoDefinicao,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  definicaoParaBpmnXml
} from './bpmn/bpmnConversao';

// ============================================================
// COPIAR O FLUXO DE OUTRO PROCESSO
//
// Reaproveita o DESENHO e a configuração (etapas, botões, caminhos,
// campos, eventos de revisão) de um fluxo pronto. A cópia vira um
// RASCUNHO no processo de destino: nada é publicado sozinho e o
// fluxo de origem não é alterado.
//
// Responsáveis — o que costuma mudar de um processo para outro:
//   manter      → copia todos
//   automaticos → mantém só "Autor da revisão" e "Gestor da área"
//                 (valem para qualquer processo); remove área,
//                 usuário, grupo, função e setor específicos
//   limpar      → nenhuma etapa fica com responsável
// ============================================================

export type OpcaoResponsaveisCopia =
  | 'manter'
  | 'automaticos'
  | 'limpar';

export const DESCRICAO_OPCAO_RESPONSAVEIS: Record<OpcaoResponsaveisCopia, string> = {
  automaticos: 'Manter só os automáticos (Autor da revisão e Gestor da área) e limpar os específicos',
  manter: 'Manter todos os responsáveis do fluxo de origem',
  limpar: 'Limpar todos os responsáveis (definir do zero)'
};

export const prepararCopiaFluxo = (
  origem: IFluxoDefinicao,
  processo: IProcesso,
  versao: number,
  opcao: OpcaoResponsaveisCopia
): IFluxoDefinicao => {

  const copia =
    JSON.parse(JSON.stringify(origem)) as IFluxoDefinicao;

  copia.elementos.forEach(elemento => {
    if (opcao === 'limpar') {
      elemento.responsaveis = [];
    } else if (opcao === 'automaticos') {
      elemento.responsaveis = (elemento.responsaveis || []).filter(
        r => r.tipo === 'autorRevisao' || r.tipo === 'gestorArea'
      );
    }
  });

  const nova: IFluxoDefinicao = {
    ...copia,
    id: `processo-${processo.id}`,
    nome: `${processo.codigo ? `${processo.codigo} — ` : ''}${processo.nome}`,
    versao,
    status: 'rascunho',
    processoId: processo.id,
    registroId: undefined,
    modeloId: `copia:${origem.processoId || ''}:v${origem.versao}`,
    criadoEm: new Date().toISOString(),
    publicadoEm: undefined,
    arquivadoEm: undefined
  };

  // O desenho é o mesmo (ids iguais); se faltar, é gerado.
  nova.bpmnXml = origem.bpmnXml || definicaoParaBpmnXml(nova);

  return nova;
};

// Metadados da origem que ainda não existem no destino (pela chave),
// sem o id (que pertence ao processo de origem).
export const metadadosParaCopiar = (
  daOrigem: IFluxoMetadado[],
  doDestino: IFluxoMetadado[]
): IFluxoMetadado[] =>
  daOrigem
    .filter(item => !doDestino.some(atual => atual.chave === item.chave))
    .map(item => {
      const copia = JSON.parse(JSON.stringify(item)) as IFluxoMetadado;
      delete copia.id;
      return copia;
    });
