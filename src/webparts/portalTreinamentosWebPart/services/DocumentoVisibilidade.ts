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
// Administrador        → vê todas as áreas e todos os documentos.
//
// Membro de uma área   → vê TODOS os documentos da área, em qualquer
//                        situação (vigente, elaboração, aprovação...),
//                        independente de ser o responsável.
//                        Vínculo: Gestão → Áreas e acessos.
//
// Responsável          → vê sempre o documento pelo qual responde,
//                        mesmo que não seja membro da área:
//                          • responsável do documento (dgt_responsavel);
//                          • responsável por uma etapa do fluxo que está
//                            aguardando ele (Minhas pendências).
//
// Documento sem área   → vigente: todos veem.
// (corporativo)          não publicado: só quem participa do fluxo.
//
// Ver o documento não dá direito de agir: quem executa cada etapa
// continua sendo definido pelo fluxo do processo (FluxoRevisaoTab).
//
// IMPORTANTE: isto organiza a TELA. A proteção real dos dados deve
// estar também nas Security Roles do Dataverse — se a role só permite
// ler os registros do próprio usuário, o documento nem chega à tela.
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
  usuariosAreas: IUsuarioAreaAdmin[],
  // Documentos com etapa do fluxo aguardando o usuário
  // (ids vindos de "Minhas pendências").
  idsDocumentosComPendencia: string[] = []
): IDocumento[] => {

  // Sem contexto carregado ainda: não esconde nada (comportamento
  // anterior), para a tela não "piscar" vazia.
  if (!contexto) {
    return documentos;
  }

  if (ehAdministrador(contexto)) {
    return documentos;
  }

  const meuId =
    guid(contexto.usuarioId);

  const idsAreas =
    areasVisiveis.map(
      area => guid(area.id)
    );

  const idsPendentes =
    idsDocumentosComPendencia.map(
      id => guid(id)
    );

  const meusVinculos =
    obterMeusVinculos(
      contexto,
      usuariosAreas
    );

  return documentos.filter(
    documento => {

      // 1. Responsável pelo documento ou por uma etapa pendente:
      //    sempre vê, mesmo fora da sua área.
      const souResponsavel =
        (!!meuId && guid(documento.responsavelId) === meuId) ||
        idsPendentes.indexOf(guid(documento.id)) >= 0;

      if (souResponsavel) {
        return true;
      }

      const areaDoc =
        guid(documento.areaId);

      // 2. Documento de uma área: todos os membros da área veem
      //    todos os documentos dela, em qualquer situação.
      if (areaDoc) {
        return idsAreas.indexOf(areaDoc) >= 0;
      }

      // 3. Documento corporativo (sem área): vigente para todos;
      //    em revisão, só para quem participa do fluxo.
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
