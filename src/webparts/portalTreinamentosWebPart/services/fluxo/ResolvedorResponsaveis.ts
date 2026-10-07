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
// nesta revisão. Só quem é responsável — o perfil Administrador do
// portal NÃO passa por cima do fluxo.
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

// Quem responde pela etapa, do jeito que aparece nas telas:
//
//   Criador da revisão   → "Maria Silva (criador)"
//   Usuário específico   → "João Souza"
//   Área (todos)         → "Área PROCESSOS (todos da área)"
//   Gestor da área       → "Gestor da área PROCESSOS: Anaelise Cunha"
//
// Na área, QUALQUER membro ativo pode executar a etapa (ver
// usuarioAtende); no gestor, só Gestor/Administrador da área.
export const descreverResolvido = (
  resolvido: IResponsavelResolvido,
  vinculos: IUsuarioAreaAdmin[],
  usuarios: Array<{ id: string; nome: string }> = []
): string => {

  const ehCriador =
    (resolvido.papelTeste || '').indexOf('autorRevisao') === 0 ||
    /autor|criador/i.test(resolvido.descricao || '');

  if (resolvido.usuarioId) {
    const usuario =
      usuarios.find(item => guid(item.id) === guid(resolvido.usuarioId));

    const vinculo =
      vinculos.find(item => guid(item.usuarioId) === guid(resolvido.usuarioId));

    const nome =
      usuario ? usuario.nome : vinculo ? vinculo.usuarioNome : '';

    if (!nome) {
      return `${resolvido.descricao} (não identificado)`;
    }

    return ehCriador ? `${nome} (criador)` : nome;
  }

  if (!resolvido.areaId && ehCriador) {
    return `${resolvido.descricao} (não identificado)`;
  }

  if (resolvido.areaId) {

    const daArea =
      vinculos.filter(
        vinculo =>
          vinculo.ativo &&
          guid(vinculo.areaId) === guid(resolvido.areaId)
      );

    const nomeArea =
      (daArea[0] && daArea[0].areaNome) ||
      (vinculos.find(vinculo => guid(vinculo.areaId) === guid(resolvido.areaId)) || { areaNome: '' }).areaNome ||
      resolvido.descricao;

    if (!resolvido.somenteGestores) {
      return `Área ${nomeArea} (todos da área)`;
    }

    const gestores =
      daArea
        .filter(vinculo => vinculo.perfil === 'Gestor' || vinculo.perfil === 'Administrador da área')
        .map(vinculo => vinculo.usuarioNome)
        .filter((nome, indice, lista) => !!nome && lista.indexOf(nome) === indice);

    return gestores.length > 0
      ? `Gestor da área ${nomeArea}: ${gestores.slice(0, 4).join(', ')}${gestores.length > 4 ? ` e mais ${gestores.length - 4}` : ''}`
      : `Gestor da área ${nomeArea} (ninguém cadastrado)`;
  }

  return resolvido.descricao;
};

// ------------------------------------------------------------
// Etapa de aprovação do fluxo e quem pode aprová-la
// ------------------------------------------------------------

// A etapa que "aprova" o documento:
//   1. a etapa marcada com status do documento "Aprovação"
//      (se houver mais de uma, a última pelo caminho do fluxo);
//   2. senão, a última etapa com responsável antes de uma tarefa
//      de sistema de publicação;
//   3. senão, a última etapa com responsável do fluxo.
export const etapaDeAprovacao = (
  definicao: IFluxoDefinicao
): IFluxoDefinicao['elementos'][0] | undefined => {

  // Ordem pelo caminho a partir do início (busca em largura).
  const inicio =
    definicao.elementos.find(item => item.tipo === 'inicio');

  const ordem: string[] = [];

  if (inicio) {
    const fila: string[] = [inicio.id];

    while (fila.length > 0) {
      const atual = fila.shift() as string;

      if (ordem.indexOf(atual) >= 0) {
        continue;
      }

      ordem.push(atual);

      definicao.transicoes
        .filter(transicao => transicao.origemId === atual && !transicao.excecao)
        .forEach(transicao => fila.push(transicao.destinoId));
    }
  }

  const humanas =
    ordem
      .map(id => definicao.elementos.find(item => item.id === id))
      .filter((item): item is IFluxoDefinicao['elementos'][0] => !!item && item.tipo === 'tarefaHumana');

  const marcadas =
    humanas.filter(item => item.statusDocumento === 'Aprovação');

  if (marcadas.length > 0) {
    return marcadas[marcadas.length - 1];
  }

  // Etapa humana que leva (direto ou por decisões) a uma publicação.
  const levaAPublicacao = (
    id: string,
    visitados: string[]
  ): boolean => {

    if (visitados.indexOf(id) >= 0) {
      return false;
    }

    return definicao.transicoes
      .filter(transicao => transicao.origemId === id && !transicao.excecao)
      .some(
        transicao => {
          const destino = definicao.elementos.find(item => item.id === transicao.destinoId);

          if (!destino) {
            return false;
          }

          if (destino.tipo === 'tarefaSistema' && !!destino.acaoSistema) {
            return true;
          }

          return destino.tipo === 'gateway'
            ? levaAPublicacao(destino.id, visitados.concat(id))
            : false;
        }
      );
  };

  const antesDaPublicacao =
    humanas.filter(item => levaAPublicacao(item.id, []));

  if (antesDaPublicacao.length > 0) {
    return antesDaPublicacao[antesDaPublicacao.length - 1];
  }

  return humanas.length > 0
    ? humanas[humanas.length - 1]
    : undefined;
};

// Usuários (vínculos usuário × área) que atendem aos responsáveis.
// "Autor da revisão" não vira pessoa aqui: depende de quem criar a revisão.
export const usuariosElegiveis = (
  responsaveis: IFluxoResponsavel[],
  dados: IDadosRevisaoResponsaveis,
  vinculos: IUsuarioAreaAdmin[]
): IUsuarioAreaAdmin[] => {

  const lista: IUsuarioAreaAdmin[] = [];

  resolverResponsaveis(responsaveis, dados).forEach(
    resolvido => {

      if (!resolvido.usuarioId && !resolvido.areaId) {
        return;
      }

      vinculos
        .filter(vinculo => vinculo.ativo && usuarioAtende(resolvido, vinculo.usuarioId, [vinculo]))
        .forEach(
          vinculo => {
            if (!lista.some(item => guid(item.usuarioId) === guid(vinculo.usuarioId))) {
              lista.push(vinculo);
            }
          }
        );

      // Usuário específico sem vínculo de área: ainda entra pela
      // primeira ocorrência dele em qualquer vínculo.
      if (resolvido.usuarioId && !lista.some(item => guid(item.usuarioId) === guid(resolvido.usuarioId))) {
        const qualquer = vinculos.find(item => guid(item.usuarioId) === guid(resolvido.usuarioId));
        if (qualquer) {
          lista.push(qualquer);
        }
      }
    }
  );

  return lista;
};
