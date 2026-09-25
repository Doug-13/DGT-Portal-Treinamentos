import {
  IDocumento
} from '../models/Documento';

import {
  IContextoAcesso
} from './AutorizacaoService';

import {
  IAreaAdmin,
  IUsuarioAreaAdmin
} from './AreaAdminService';

// ============================================================
// VISIBILIDADE DE DOCUMENTOS NA TELA "DOCUMENTOS"
//
// Administrador → vê todas as áreas e todos os documentos.
// Demais perfis → vê apenas as áreas às quais está vinculado
//                 (Gestão → Áreas e acessos) e os documentos sem
//                 área (corporativos).
// Documentos ainda não publicados (Elaboração / Aprovação) só
// aparecem para quem participa do fluxo: responsável, Gestor da área
// ou quem gerencia documentos.
//
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados deve
// estar também nas Security Roles do Dataverse.
// ============================================================

const guid = (
  valor?: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const normalizar = (
  valor?: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const ehAdministrador = (
  contexto?: IContextoAcesso
): boolean =>
  contexto?.perfil === 'Administrador';

// Vínculos ativos do usuário logado (por id do dgt_usuario ou e-mail).
export const obterMeusVinculos = (
  contexto: IContextoAcesso | undefined,
  usuariosAreas: IUsuarioAreaAdmin[]
): IUsuarioAreaAdmin[] => {

  if (!contexto) {
    return [];
  }

  const meuId =
    guid(contexto.usuarioId);

  const meuEmail =
    normalizar(contexto.email);

  return usuariosAreas.filter(
    vinculo =>
      vinculo.ativo &&
      (
        (!!meuId && guid(vinculo.usuarioId) === meuId) ||
        (!!meuEmail && normalizar(vinculo.usuarioEmail) === meuEmail)
      )
  );
};

// Áreas que aparecem nos cartões e no filtro.
export const obterAreasVisiveis = (
  contexto: IContextoAcesso | undefined,
  areas: IAreaAdmin[],
  usuariosAreas: IUsuarioAreaAdmin[]
): IAreaAdmin[] => {

  const ativas =
    areas
      .filter(area => area.ativa)
      .sort(
        (a, b) =>
          a.nome.localeCompare(b.nome, 'pt-BR')
      );

  if (ehAdministrador(contexto)) {
    return ativas;
  }

  const minhas =
    obterMeusVinculos(
      contexto,
      usuariosAreas
    ).map(
      vinculo => guid(vinculo.areaId)
    );

  return ativas.filter(
    area => minhas.indexOf(guid(area.id)) >= 0
  );
};

// Pode ver documentos ainda não publicados desta área?
export const participaDoFluxo = (
  documento: IDocumento,
  contexto: IContextoAcesso | undefined,
  meusVinculos: IUsuarioAreaAdmin[]
): boolean => {

  if (!contexto) {
    return false;
  }

  if (
    ehAdministrador(contexto) ||
    contexto.podeGerenciarDocumentos
  ) {
    return true;
  }

  if (
    !!documento.responsavelId &&
    guid(documento.responsavelId) === guid(contexto.usuarioId)
  ) {
    return true;
  }

  return meusVinculos.some(
    vinculo =>
      guid(vinculo.areaId) === guid(documento.areaId) &&
      (
        vinculo.perfil === 'Gestor' ||
        vinculo.perfil === 'Administrador da área'
      )
  );
};

export const documentoPublicado = (
  documento: IDocumento
): boolean =>
  normalizar(documento.status) === 'vigente';

export const filtrarDocumentosVisiveis = (
  documentos: IDocumento[],
  contexto: IContextoAcesso | undefined,
  areasVisiveis: IAreaAdmin[],
  usuariosAreas: IUsuarioAreaAdmin[]
): IDocumento[] => {

  // Sem contexto carregado ainda: não esconde nada (comportamento
  // anterior), para a tela não "piscar" vazia.
  if (!contexto) {
    return documentos;
  }

  const admin =
    ehAdministrador(contexto);

  const idsAreas =
    areasVisiveis.map(
      area => guid(area.id)
    );

  const meusVinculos =
    obterMeusVinculos(
      contexto,
      usuariosAreas
    );

  return documentos.filter(
    documento => {

      const areaDoc =
        guid(documento.areaId);

      const areaPermitida =
        admin ||
        !areaDoc ||
        idsAreas.indexOf(areaDoc) >= 0 ||
        // O responsável sempre enxerga o próprio documento.
        guid(documento.responsavelId) === guid(contexto.usuarioId);

      if (!areaPermitida) {
        return false;
      }

      return (
        documentoPublicado(documento) ||
        participaDoFluxo(
          documento,
          contexto,
          meusVinculos
        )
      );
    }
  );
};
