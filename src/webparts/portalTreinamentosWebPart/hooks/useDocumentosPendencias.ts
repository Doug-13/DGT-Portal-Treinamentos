import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../services/DataverseService';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../services/AreaAdminService';

import {
  IDocumento
} from '../models/Documento';

import {
  ehAdministrador,
  obterMeusVinculos
} from '../services/DocumentoVisibilidade';

// ============================================================
// MINHAS PENDÊNCIAS DE DOCUMENTOS
//
//   Para elaborar → revisão em Elaboração de um documento pelo qual
//                   eu sou o responsável (ou da própria revisão).
//   Para aprovar  → revisão em Aprovação de um documento de uma área
//                   em que eu sou Gestor (ou sou Administrador).
// ============================================================

export type TipoPendenciaDocumento =
  | 'elaborar'
  | 'aprovar';

export interface IPendenciaDocumento {
  id: string;
  tipo: TipoPendenciaDocumento;
  documento: IDocumento;
  revisao: string;
  status: string;
  desde: string;
  diasParado: number;
}

export interface IUseDocumentosPendencias {
  pendencias: IPendenciaDocumento[];
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
}

const guid = (
  valor?: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor);
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const diasDesde = (
  data: string
): number => {

  const inicio =
    new Date(data).getTime();

  if (!inicio) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - inicio) / 86400000
    )
  );
};

export const useDocumentosPendencias = (
  dataverse: DataverseService | undefined,
  documentos: IDocumento[],
  contexto: IContextoAcesso | undefined,
  usuariosAreas: IUsuarioAreaAdmin[]
): IUseDocumentosPendencias => {

  const [registros, setRegistros] =
    React.useState<IDataverseRecord[]>([]);

  const [carregando, setCarregando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!dataverse || !contexto) {
          setRegistros([]);
          return;
        }

        setCarregando(true);
        setErro('');

        try {
          setRegistros(
            await dataverse.getDocumentoRevisoesEmAndamento()
          );
        } catch (e) {
          console.error(e);
          setErro(
            'Não foi possível carregar suas pendências de documentos.'
          );
        } finally {
          setCarregando(false);
        }
      },
      [
        dataverse,
        contexto
      ]
    );

  // Recarrega também quando a lista de documentos muda (ex.: depois
  // de voltar do detalhe onde uma revisão foi enviada/aprovada).
  React.useEffect(
    () => {
      recarregar()
        .catch(
          (error: unknown) =>
            console.error(error)
        );
    },
    [
      recarregar,
      documentos
    ]
  );

  const pendencias =
    React.useMemo(
      (): IPendenciaDocumento[] => {

        if (!contexto) {
          return [];
        }

        const meuId =
          guid(contexto.usuarioId);

        const admin =
          ehAdministrador(contexto);

        const areasOndeSouGestor =
          obterMeusVinculos(
            contexto,
            usuariosAreas
          )
            .filter(
              vinculo =>
                vinculo.perfil === 'Gestor' ||
                vinculo.perfil === 'Administrador da área'
            )
            .map(
              vinculo => guid(vinculo.areaId)
            );

        const lista: IPendenciaDocumento[] = [];

        registros.forEach(
          registro => {

            const documento =
              documentos.find(
                item =>
                  guid(item.id) ===
                  guid(texto(registro, '_dgt_documento_value'))
              );

            if (!documento) {
              return;
            }

            const status =
              texto(
                registro,
                'dgt_status@OData.Community.Display.V1.FormattedValue'
              ) || 'Elaboração';

            const estagio =
              normalizar(status);

            const desde =
              texto(registro, 'modifiedon') ||
              texto(registro, 'createdon');

            const base = {
              id: guid(texto(registro, 'dgt_documentorevisaoid')),
              documento,
              revisao: texto(registro, 'dgt_revisao'),
              status,
              desde,
              diasParado: diasDesde(desde)
            };

            if (estagio === 'aprovacao') {

              if (
                admin ||
                areasOndeSouGestor.indexOf(guid(documento.areaId)) >= 0
              ) {
                lista.push({
                  ...base,
                  tipo: 'aprovar'
                });
              }

              return;
            }

            const souResponsavel =
              !!meuId &&
              (
                guid(documento.responsavelId) === meuId ||
                guid(texto(registro, '_dgt_responsavel_value')) === meuId
              );

            if (souResponsavel) {
              lista.push({
                ...base,
                tipo: 'elaborar'
              });
            }
          }
        );

        // Mais antigas primeiro — são as mais urgentes.
        return lista.sort(
          (a, b) => b.diasParado - a.diasParado
        );
      },
      [
        registros,
        documentos,
        contexto,
        usuariosAreas
      ]
    );

  return {
    pendencias,
    carregando,
    erro,
    recarregar
  };
};
