import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../services/AreaAdminService';

import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

import {
  IControleTreinamento
} from '../services/TreinamentoDocumentoControleService';

import {
  obterRevisaoEmAndamento,
  obterRevisaoVigente
} from '../services/DocumentoRevisaoFluxoService';

import {
  revisaoInteira
} from '../utils/numeracaoRevisao';

import {
  IEtapaFluxoTreinamento,
  useEtapasFluxoTreinamentos
} from './useEtapasFluxoTreinamentos';

// ============================================================
// ONDE ESTÁ CADA DOCUMENTO NO FLUXO (lista de Documentos)
//
// Para cada documento com revisão em andamento: revisão real (ex.:
// Rev.00 depois da renumeração), etapa atual do fluxo e o responsável
// pela etapa. Reaproveita a leitura de etapas dos treinamentos
// (tarefas pendentes do fluxo ou 1ª etapa do fluxo publicado).
// ============================================================

export interface ISituacaoFluxoDocumento {
  revisao: string;
  emAndamento: boolean;
  etapa?: IEtapaFluxoTreinamento;
}

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const formatado = (r: Record<string, unknown>, campo: string): string => {
  const v = r[`${campo}@OData.Community.Display.V1.FormattedValue`];
  return v === undefined || v === null ? '' : String(v);
};

export const useEtapasFluxoDocumentos = (
  dataverse: DataverseService | undefined,
  documentos: IDocumento[],
  contexto: IContextoAcesso | undefined,
  usuariosAreas: IUsuarioAreaAdmin[]
): {
  situacoes: Record<string, ISituacaoFluxoDocumento>;
  recarregar: () => Promise<void>;
} => {

  const [controles, setControles] =
    React.useState<Record<string, IControleTreinamento>>({});

  const chave =
    documentos.map(d => guid(d.id)).sort().join('|');

  const carregarRevisoes =
    React.useCallback(
      async (): Promise<void> => {

        if (!dataverse || documentos.length === 0) {
          setControles({});
          return;
        }

        const ids = documentos.map(d => guid(d.id)).filter(id => !!id);
        const porDocumento: Record<string, IDocumentoRevisao[]> = {};

        for (let i = 0; i < ids.length; i += 20) {
          const lote = ids.slice(i, i + 20);
          const registros =
            await dataverse.listarRegistros(
              'dgt_documentorevisao',
              '$select=dgt_documentorevisaoid,dgt_revisao,dgt_status,dgt_ativa,_dgt_documento_value' +
              '&$filter=' + lote.map(id => `_dgt_documento_value eq ${id}`).join(' or ')
            );

          registros.forEach(r => {
            const documentoId = guid(String(r._dgt_documento_value || ''));
            (porDocumento[documentoId] = porDocumento[documentoId] || []).push({
              id: guid(String(r.dgt_documentorevisaoid || '')),
              documentoId,
              nome: '',
              revisao: String(r.dgt_revisao || ''),
              status: formatado(r, 'dgt_status'),
              ativa: r.dgt_ativa === true,
              requerRetreinamento: false
            });
          });
        }

        const mapa: Record<string, IControleTreinamento> = {};

        documentos.forEach(documento => {
          const id = guid(documento.id);
          const revisoes = porDocumento[id] || [];
          const andamento = obterRevisaoEmAndamento(revisoes);
          const vigente = obterRevisaoVigente(revisoes);

          mapa[id] = {
            treinamentoId: id,
            documentoId: id,
            codigo: documento.codigo,
            statusDocumento: documento.status,
            revisaoVigente: vigente ? revisaoInteira(vigente.revisao) : '',
            revisaoEmAndamento: andamento
              ? { id: andamento.id, revisao: andamento.revisao, status: andamento.status || 'Elaboração' }
              : undefined,
            vigente: !!vigente
          };
        });

        setControles(mapa);
      },
      [dataverse, chave]
    );

  React.useEffect(
    () => {
      carregarRevisoes().catch(erro => console.error('Revisões dos documentos não lidas:', erro));
    },
    [carregarRevisoes]
  );

  const areaPorDocumento =
    React.useMemo(
      () => {
        const mapa: Record<string, string> = {};
        documentos.forEach(d => { mapa[guid(d.id)] = d.areaId || ''; });
        return mapa;
      },
      [chave]
    );

  const etapas =
    useEtapasFluxoTreinamentos(
      dataverse,
      controles,
      contexto,
      usuariosAreas,
      areaPorDocumento
    );

  const situacoes =
    React.useMemo(
      () => {
        const mapa: Record<string, ISituacaoFluxoDocumento> = {};
        Object.keys(controles).forEach(id => {
          const controle = controles[id];
          mapa[id] = {
            revisao: controle.revisaoEmAndamento ? controle.revisaoEmAndamento.revisao : controle.revisaoVigente,
            emAndamento: !!controle.revisaoEmAndamento,
            etapa: etapas.etapas[id]
          };
        });
        return mapa;
      },
      [controles, etapas.etapas]
    );

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {
        await carregarRevisoes();
        await etapas.recarregar();
      },
      [carregarRevisoes, etapas]
    );

  return { situacoes, recarregar };
};
