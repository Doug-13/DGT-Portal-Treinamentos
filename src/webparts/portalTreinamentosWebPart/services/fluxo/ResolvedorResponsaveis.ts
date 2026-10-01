import {
  IFluxoDefinicao,
  IFluxoResponsavel,
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  IContextoAcesso
} from '../AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../AreaAdminService';

// ============================================================
// RESPONSÁVEIS REAIS DAS ETAPAS
//
// Traduz o responsável configurado na etapa ("gestor da área",
// "membros da área X", "usuário Y", "autor da revisão") para pessoas
// reais, usando:
//   - dgt_documentorevisao.dgt_responsavel  (autor da revisão)
//   - dgt_documento.dgt_area                (área do documento)
//   - dgt_usuarioarea                       (membros e gestores)
// ============================================================

export interface IDadosRevisaoResponsaveis {
  // Responsável da revisão (dgt_usuario).
  revisaoResponsavelId?: string;

  // Área do documento (dgt_area).
  documentoAreaId?: string;
}

export const TIPOS_RESOLVIDOS: string[] = [
  'autorRevisao',
  'gestorArea',
  'area',
  'usuario'
];

export const tipoResolvido = (
  tipo: string
): boolean =>
  TIPOS_RESOLVIDOS.indexOf(tipo) >= 0;

const guid = (
  valor?: string
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

// Resolve UM responsável para uma revisão concreta.
export const resolverResponsavel = (
  responsavel: IFluxoResponsavel,
  dados: IDadosRevisaoResponsaveis
): IResponsavelResolvido => {

  const base: IResponsavelResolvido = {
    papelTeste: responsavel.papelTeste,
    descricao: responsavel.descricao
  };

  switch (responsavel.tipo) {

    case 'autorRevisao':
      return { ...base, usuarioId: guid(dados.revisaoResponsavelId) || undefined };

    case 'gestorArea':
      return { ...base, areaId: guid(dados.documentoAreaId) || undefined, somenteGestores: true };

    case 'area':
      return { ...base, areaId: guid(responsavel.referenciaId) || undefined, somenteGestores: !!responsavel.somenteGestores };

    case 'usuario':
      return { ...base, usuarioId: guid(responsavel.referenciaId) || undefined };

    default:
      // grupo, função, setor: ainda sem vínculo com usuários.
      return base;
  }
};

export const resolverResponsaveis = (
  responsaveis: IFluxoResponsavel[],
  dados: IDadosRevisaoResponsaveis
): IResponsavelResolvido[] =>
  responsaveis.map(responsavel => resolverResponsavel(responsavel, dados));

// O usuário atende a um responsável resolvido?
export const usuarioAtende = (
  resolvido: IResponsavelResolvido,
  usuarioId: string,
  vinculos: IUsuarioAreaAdmin[]
): boolean => {

  const eu =
    guid(usuarioId);

  if (!eu) {
    return false;
  }

  if (resolvido.usuarioId) {
    return guid(resolvido.usuarioId) === eu;
  }

  if (resolvido.areaId) {
    return vinculos.some(
      vinculo =>
        vinculo.ativo &&
        guid(vinculo.usuarioId) === eu &&
        guid(vinculo.areaId) === guid(resolvido.areaId) &&
        (!resolvido.somenteGestores || vinculo.perfil === 'Gestor' || vinculo.perfil === 'Administrador da área')
    );
  }

  return false;
};

// Papéis (papelTeste) do fluxo que o usuário REAL pode executar
// nesta revisão. Administrador do portal pode executar todos.
export const papeisDoUsuario = (
  definicao: IFluxoDefinicao,
  contexto: IContextoAcesso | undefined,
  dados: IDadosRevisaoResponsaveis,
  vinculos: IUsuarioAreaAdmin[]
): string[] => {

  if (!contexto) {
    return [];
  }

  const papeis: string[] = [];

  definicao.elementos.forEach(
    elemento => {
      elemento.responsaveis.forEach(
        responsavel => {

          if (papeis.indexOf(responsavel.papelTeste) >= 0) {
            return;
          }

          if (
            contexto.perfil === 'Administrador' ||
            usuarioAtende(resolverResponsavel(responsavel, dados), contexto.usuarioId, vinculos)
          ) {
            papeis.push(responsavel.papelTeste);
          }
        }
      );
    }
  );

  return papeis;
};

// Nomes legíveis de quem pode executar (para a tela).
export const descreverResolvido = (
  resolvido: IResponsavelResolvido,
  vinculos: IUsuarioAreaAdmin[]
): string => {

  if (resolvido.usuarioId) {
    const vinculo =
      vinculos.find(item => guid(item.usuarioId) === guid(resolvido.usuarioId));

    return vinculo
      ? `${resolvido.descricao} (${vinculo.usuarioNome})`
      : resolvido.descricao;
  }

  if (resolvido.areaId) {
    const pessoas =
      vinculos
        .filter(
          vinculo =>
            vinculo.ativo &&
            guid(vinculo.areaId) === guid(resolvido.areaId) &&
            (!resolvido.somenteGestores || vinculo.perfil === 'Gestor' || vinculo.perfil === 'Administrador da área')
        )
        .map(vinculo => vinculo.usuarioNome)
        .filter((nome, indice, lista) => !!nome && lista.indexOf(nome) === indice);

    return pessoas.length > 0
      ? `${resolvido.descricao} (${pessoas.slice(0, 4).join(', ')}${pessoas.length > 4 ? ` e mais ${pessoas.length - 4}` : ''})`
      : `${resolvido.descricao} (ninguém cadastrado)`;
  }

  return resolvido.descricao;
};
