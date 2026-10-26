import {
  IUsuarioAreaAdmin
} from '../AreaAdminService';

import {
  cadeiaDaArea,
  cargoDoNivel
} from './hierarquiaArea';

import {
  descreverResolvido,
  resolverResponsavel,
  resolverResponsaveis,
  usuarioAtende,
  usuariosElegiveis
} from './ResolvedorResponsaveis';

// ============================================================
// TESTES — hierarquia por área (cargos) nos fluxos
//
// Áreas de exemplo:
//   PRO: Coordenador (ana) → Head (hugo) → Diretor (dora)
//   COM: Gerente (gil)     → Head (hugo) → Diretor (dora)
//   ADM: Gestor (gui)      → Gerente (gil) → Diretor (dora)
//   OPS: Coordenador (caio) → Diretor (dora)          (sem Head)
// Hugo é Head de duas áreas; Gil é Gerente de duas; Dora é Diretora
// de todas (Diretoria que agrupa as áreas).
// Rodam no "heft test" (parte do npm run build).
// ============================================================

const vinculo = (usuarioId: string, areaId: string, cargo?: string, ativo = true): IUsuarioAreaAdmin => ({
  id: `${usuarioId}-${areaId}`,
  usuarioId,
  usuarioNome: usuarioId,
  usuarioEmail: '',
  areaId,
  areaNome: areaId.toUpperCase(),
  areaSigla: areaId.toUpperCase(),
  perfil: 'Membro',
  ativo,
  cargo
});

const VINCULOS: IUsuarioAreaAdmin[] = [
  vinculo('ana', 'pro', 'Coordenador'),
  vinculo('hugo', 'pro', 'Head'),
  vinculo('dora', 'pro', 'Diretor'),
  vinculo('gil', 'com', 'Gerente'),
  vinculo('hugo', 'com', 'Head'),
  vinculo('dora', 'com', 'Diretor'),
  vinculo('gui', 'adm', 'Gestor'),
  vinculo('gil', 'adm', 'Gerente'),
  vinculo('dora', 'adm', 'Diretor'),
  vinculo('caio', 'ops', 'Coordenador'),
  vinculo('dora', 'ops', 'Diretor'),
  vinculo('ex', 'ops', 'Head', false),
  vinculo('membro', 'pro')
];

const nivel = (n: number, area: string): ReturnType<typeof resolverResponsavel> =>
  resolverResponsavel(
    { tipo: 'nivelHierarquico', nivel: n, descricao: 'nível', papelTeste: `nivel:${n}` },
    { documentoAreaId: area }
  );

describe('Hierarquia por área', () => {

  it('monta a cadeia de cada área na ordem dos cargos', () => {
    expect(cadeiaDaArea('pro', VINCULOS)).toEqual(['Coordenador', 'Head', 'Diretor']);
    expect(cadeiaDaArea('com', VINCULOS)).toEqual(['Gerente', 'Head', 'Diretor']);
    expect(cadeiaDaArea('adm', VINCULOS)).toEqual(['Gestor', 'Gerente', 'Diretor']);
    // Vínculo inativo não conta.
    expect(cadeiaDaArea('ops', VINCULOS)).toEqual(['Coordenador', 'Diretor']);
  });

  it('nível que falta na área sobe para o topo', () => {
    expect(cargoDoNivel('ops', 2, VINCULOS)).toBe('Diretor');
    expect(cargoDoNivel('ops', 3, VINCULOS)).toBe('Diretor');
    expect(cargoDoNivel('pro', 0, VINCULOS)).toBe('Diretor');
  });

  it('"Diretor da área" encontra a Diretora em qualquer área', () => {
    const diretor = resolverResponsavel(
      { tipo: 'cargoArea', cargo: 'Diretor', descricao: 'Diretor da área', papelTeste: 'cargo:diretor' },
      { documentoAreaId: 'com' }
    );
    expect(usuarioAtende(diretor, 'dora', VINCULOS)).toBe(true);
    expect(usuarioAtende(diretor, 'hugo', VINCULOS)).toBe(false);
    expect(descreverResolvido(diretor, VINCULOS)).toBe('Diretor da área COM: dora');
  });

  it('um mesmo fluxo atende as três cadeias pelo nível', () => {
    expect(usuarioAtende(nivel(1, 'pro'), 'ana', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(2, 'pro'), 'hugo', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(1, 'com'), 'gil', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(2, 'com'), 'hugo', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(1, 'adm'), 'gui', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(2, 'adm'), 'gil', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel(3, 'adm'), 'dora', VINCULOS)).toBe(true);
    // Head de PRO não aprova o 2º nível de ADM.
    expect(usuarioAtende(nivel(2, 'adm'), 'hugo', VINCULOS)).toBe(false);
  });

  it('cargo não depende do perfil de acesso (membro sem cargo não aprova)', () => {
    expect(usuarioAtende(nivel(1, 'pro'), 'membro', VINCULOS)).toBe(false);
  });

  it('lista quem pode executar a etapa por nível', () => {
    const elegiveis = usuariosElegiveis(
      [{ tipo: 'nivelHierarquico', nivel: 2, descricao: 'nível 2', papelTeste: 'n2' }],
      { documentoAreaId: 'adm' },
      VINCULOS
    );
    expect(elegiveis.map(item => item.usuarioId)).toEqual(['gil']);
  });

  it('Head da área de QUEM CRIOU: criador de PRO → Hugo; de ADM → ninguém com Head', () => {
    const headDoAutor = (autor: string, areaDoc?: string): ReturnType<typeof resolverResponsavel> =>
      resolverResponsavel(
        { tipo: 'cargoArea', cargo: 'Head', origemArea: 'autor', descricao: 'Head', papelTeste: 'head' },
        { revisaoResponsavelId: autor, documentoAreaId: areaDoc }
      );
    expect(usuarioAtende(headDoAutor('ana'), 'hugo', VINCULOS)).toBe(true);
    expect(descreverResolvido(headDoAutor('ana'), VINCULOS)).toBe('Head da área de quem criou (PRO): hugo');
    // Gui (ADM) não tem Head na área: ninguém atende.
    expect(usuarioAtende(headDoAutor('gui'), 'hugo', VINCULOS)).toBe(false);
  });

  it('criador de duas áreas: vale a área do documento quando ele é dela', () => {
    // Gil é Gerente de COM e de ADM.
    const nivel2DoAutor = resolverResponsavel(
      { tipo: 'nivelHierarquico', nivel: 2, origemArea: 'autor', descricao: 'n2', papelTeste: 'n2' },
      { revisaoResponsavelId: 'gil', documentoAreaId: 'com' }
    );
    expect(usuarioAtende(nivel2DoAutor, 'hugo', VINCULOS)).toBe(true);
    expect(usuarioAtende(nivel2DoAutor, 'gil', VINCULOS)).toBe(false);
  });

  it('a pendência já sai com as pessoas certas (avisos)', () => {
    const [resolvido] = resolverResponsaveis(
      [{ tipo: 'cargoArea', cargo: 'Head', origemArea: 'autor', descricao: 'Head', papelTeste: 'head' }],
      { revisaoResponsavelId: 'ana' },
      VINCULOS
    );
    expect(resolvido.usuariosIds).toEqual(['hugo']);
  });

  it('área sem cargos não tem aprovador', () => {
    expect(usuarioAtende(nivel(1, 'vazia'), 'dora', VINCULOS)).toBe(false);
    expect(descreverResolvido(nivel(1, 'vazia'), VINCULOS)).toContain('ninguém cadastrado');
  });
});
