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

import {
  lerValorUsuario
} from './valorUsuario';

import {
  alvosDaHierarquia,
  pessoasComCargo,
  rotuloNivel
} from './hierarquiaArea';

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

  // Valores dos metadados já preenchidos na revisão (para o
  // responsável "Usuário do campo").
  valores?: Record<string, string>;
}

export const TIPOS_RESOLVIDOS: string[] = [
  'autorRevisao',
  'gestorArea',
  'area',
  'usuario',
  'cargoArea',
  'nivelHierarquico',
  'campoUsuario'
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

    case 'campoUsuario': {
      // Usuário escolhido no metadado. Se o campo ainda não foi
      // preenchido, a etapa vai para o autor da revisão (nunca fica
      // sem ninguém).
      const chave = responsavel.referenciaId || '';
      const escolhido = lerValorUsuario(dados.valores ? dados.valores[chave] : '');

      if (escolhido) {
        return { ...base, usuarioId: escolhido.id };
      }

      return {
        ...base,
        descricao: `${responsavel.descricao} — campo não preenchido, vai para o autor da revisão`,
        usuarioId: guid(dados.revisaoResponsavelId) || undefined
      };
    }

    case 'cargoArea':
    case 'nivelHierarquico': {
      const hierarquia: IResponsavelResolvido =
        responsavel.tipo === 'cargoArea'
          ? { ...base, cargo: responsavel.cargo || 'Diretor' }
          : { ...base, nivel: responsavel.nivel !== undefined ? responsavel.nivel : 1 };
      // Área fixa → área de quem criou → área do documento.
      if (guid(responsavel.referenciaId)) {
        return { ...hierarquia, areaId: guid(responsavel.referenciaId) };
      }
      if (responsavel.origemArea === 'autor') {
        return {
          ...hierarquia,
          autorId: guid(dados.revisaoResponsavelId) || undefined,
          areaPreferidaId: guid(dados.documentoAreaId) || undefined
        };
      }
      return { ...hierarquia, areaId: guid(dados.documentoAreaId) || undefined };
    }

    default:
      // grupo, função, setor: ainda sem vínculo com usuários.
      return base;
  }
};

// Responsável por hierarquia (cargo ou nível)?
export const ehHierarquico = (
  resolvido: IResponsavelResolvido
): boolean =>
  resolvido.cargo !== undefined || resolvido.nivel !== undefined;

// Vínculos das pessoas que respondem por um responsável hierárquico,
// com os cargos ATUAIS (trocar o Head vale para pendências abertas).
export const pessoasDaHierarquia = (
  resolvido: IResponsavelResolvido,
  vinculos: IUsuarioAreaAdmin[]
): IUsuarioAreaAdmin[] => {
  const lista: IUsuarioAreaAdmin[] = [];
  alvosDaHierarquia(resolvido, vinculos).forEach(alvo => {
    pessoasComCargo(alvo.areaId, alvo.cargo, vinculos).forEach(vinculo => {
      if (!lista.some(item => guid(item.usuarioId) === guid(vinculo.usuarioId))) {
        lista.push(vinculo);
      }
    });
  });
  return lista;
};

export const resolverResponsaveis = (
  responsaveis: IFluxoResponsavel[],
  dados: IDadosRevisaoResponsaveis,
  // Com os vínculos, os responsáveis por hierarquia já saem com as
  // pessoas do momento (usuariosIds) — usado nos avisos (Power
  // Automate). Quem pode agir continua sendo conferido na hora.
  vinculos?: IUsuarioAreaAdmin[]
): IResponsavelResolvido[] =>
  responsaveis.map(responsavel => {
    const resolvido = resolverResponsavel(responsavel, dados);
    return vinculos && ehHierarquico(resolvido)
      ? { ...resolvido, usuariosIds: pessoasDaHierarquia(resolvido, vinculos).map(vinculo => guid(vinculo.usuarioId)) }
      : resolvido;
  });

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

  // Hierarquia: tem o cargo (ou o cargo do nível) na área — da área
  // fixa, do documento ou de quem criou.
  if (ehHierarquico(resolvido)) {
    return pessoasDaHierarquia(resolvido, vinculos)
      .some(vinculo => guid(vinculo.usuarioId) === eu);
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
  resolvidoOriginal: IResponsavelResolvido,
  vinculos: IUsuarioAreaAdmin[],
  usuarios: Array<{ id: string; nome: string }> = []
): string => {

  const resolvido = resolvidoOriginal;

  // Hierarquia: "Head da área PROCESSOS: Hugo" /
  // "2º nível da hierarquia (Head) da área de quem criou (PROCESSOS): Hugo".
  if (ehHierarquico(resolvido)) {
    const nomeDe = (areaId: string): string =>
      (vinculos.find(vinculo => guid(vinculo.areaId) === guid(areaId)) || { areaNome: '' }).areaNome || 'Área';
    const deQuem = resolvido.autorId ? 'de quem criou' : resolvido.areaId ? '' : 'do documento';
    const alvos = alvosDaHierarquia(resolvido, vinculos);
    const titulo = (cargo?: string, areaId?: string): string => {
      const area = areaId ? (deQuem === 'de quem criou' ? `da área de quem criou (${nomeDe(areaId)})` : `da área ${nomeDe(areaId)}`) : `da área ${deQuem}`;
      return resolvido.nivel !== undefined && !resolvido.cargo
        ? `${rotuloNivel(resolvido.nivel)}${cargo ? ` (${cargo})` : ''} ${area}`
        : `${resolvido.cargo} ${area}`;
    };
    if (alvos.length === 0) {
      return `${titulo(undefined, resolvido.areaId)} (ninguém cadastrado em RH → Estrutura por área)`;
    }
    return alvos
      .map(alvo => {
        const nomes =
          pessoasComCargo(alvo.areaId, alvo.cargo, vinculos)
            .map(vinculo => vinculo.usuarioNome)
            .filter((nome, indice, lista) => !!nome && lista.indexOf(nome) === indice);
        return nomes.length > 0
          ? `${titulo(alvo.cargo, alvo.areaId)}: ${nomes.slice(0, 4).join(', ')}${nomes.length > 4 ? ` e mais ${nomes.length - 4}` : ''}`
          : `${titulo(alvo.cargo, alvo.areaId)} (ninguém cadastrado em RH → Estrutura por área)`;
      })
      .join(' · ');
  }

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
    resolvidoOriginal => {

      const resolvido = resolvidoOriginal;

      // Hierarquia: usa a lista COMPLETA de vínculos (cadeia da área).
      if (ehHierarquico(resolvido)) {
        pessoasDaHierarquia(resolvido, vinculos).forEach(vinculo => {
          if (!lista.some(item => guid(item.usuarioId) === guid(vinculo.usuarioId))) {
            lista.push(vinculo);
          }
        });
        return;
      }

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
