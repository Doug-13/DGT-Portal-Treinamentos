import {
  DataverseService
} from '../DataverseService';

import {
  AreaAdminService,
  IUsuarioAreaAdmin,
  IUsuarioDisponivelArea
} from '../AreaAdminService';

import {
  guid,
  texto
} from './dataverse/esquemaFluxo';

// ============================================================
// AUTOR DA REVISÃO
//
// Regra do fluxo: o "Autor da revisão" é QUEM CRIOU a revisão
// (createdby da dgt_documentorevisao), localizado em dgt_usuario
// pelo e-mail. Se não for possível identificar, usa o Responsável
// cadastrado na revisão (dgt_responsavel).
// ============================================================

const cacheUsuarios: Array<{ dataverse: DataverseService; usuarios: Promise<IUsuarioDisponivelArea[]> }> = [];

const cacheAutores: Record<string, Promise<string | undefined>> = {};

export const carregarUsuariosPortal = (
  dataverse?: DataverseService
): Promise<IUsuarioDisponivelArea[]> => {

  if (!dataverse) {
    return Promise.resolve([]);
  }

  const existente =
    cacheUsuarios.find(item => item.dataverse === dataverse);

  if (existente) {
    return existente.usuarios;
  }

  const usuarios =
    new AreaAdminService(dataverse)
      .listarUsuarios()
      .catch(
        (error: unknown) => {
          console.error(error);
          return [] as IUsuarioDisponivelArea[];
        }
      );

  cacheUsuarios.push({ dataverse, usuarios });

  return usuarios;
};

const minusculo = (
  valor: unknown
): string =>
  String(valor || '').trim().toLowerCase();

export const obterAutorDaRevisao = (
  dataverse: DataverseService | undefined,
  revisaoId: string | undefined
): Promise<string | undefined> => {

  const id =
    guid(revisaoId);

  if (!dataverse || !id) {
    return Promise.resolve(undefined);
  }

  if (Object.prototype.hasOwnProperty.call(cacheAutores, id)) {
    return cacheAutores[id];
  }

  const buscar = async (): Promise<string | undefined> => {

    const revisao =
      await dataverse.obterRegistro(
        'dgt_documentorevisao',
        id,
        ['_createdby_value', '_dgt_responsavel_value']
      );

    if (!revisao) {
      return undefined;
    }

    const responsavelCadastrado =
      guid(revisao.registro._dgt_responsavel_value) || undefined;

    const criadorId =
      guid(revisao.registro._createdby_value);

    if (!criadorId) {
      return responsavelCadastrado;
    }

    try {

      const [criador, usuarios] =
        await Promise.all([
          dataverse.obterRegistro('systemuser', criadorId, ['internalemailaddress', 'domainname', 'fullname']),
          carregarUsuariosPortal(dataverse)
        ]);

      if (!criador) {
        return responsavelCadastrado;
      }

      const emails = [
        minusculo(criador.registro.internalemailaddress),
        minusculo(criador.registro.domainname)
      ].filter(item => !!item);

      const usuario =
        usuarios.find(item => emails.indexOf(minusculo(item.email)) >= 0) ||
        usuarios.find(item => minusculo(item.nome) === minusculo(texto(criador.registro, 'fullname')));

      return usuario ? guid(usuario.id) : responsavelCadastrado;

    } catch (error) {
      console.error(error);
      return responsavelCadastrado;
    }
  };

  cacheAutores[id] =
    buscar().catch(
      (error: unknown) => {
        console.error(error);
        delete cacheAutores[id];
        return undefined;
      }
    );

  return cacheAutores[id];
};

const cacheVinculos: Array<{ dataverse: DataverseService; vinculos: Promise<IUsuarioAreaAdmin[]> }> = [];

// Vínculos usuário × área (membros e gestores), lidos uma vez.
export const carregarVinculosPortal = (
  dataverse?: DataverseService
): Promise<IUsuarioAreaAdmin[]> => {

  if (!dataverse) {
    return Promise.resolve([]);
  }

  const existente =
    cacheVinculos.find(item => item.dataverse === dataverse);

  if (existente) {
    return existente.vinculos;
  }

  const vinculos =
    new AreaAdminService(dataverse)
      .listarUsuariosArea()
      .catch(
        (error: unknown) => {
          console.error(error);
          return [] as IUsuarioAreaAdmin[];
        }
      );

  cacheVinculos.push({ dataverse, vinculos });

  return vinculos;
};
