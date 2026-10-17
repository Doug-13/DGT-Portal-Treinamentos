// ============================================================
// HIERARQUIA POR ÁREA (cargos)
//
// Cada pessoa pode ter um CARGO em cada área em que tem vínculo
// (dgt_usuarioarea.dgt_cargo), cadastrado em RH e Pessoas →
// Estrutura por área. Diretorias e Heads que agrupam várias áreas, e
// gerentes que respondem por duas, têm o cargo em cada uma delas.
//
// A CADEIA de uma área é a lista dos cargos que existem nela, do
// menor para o maior, na ordem de CARGOS_HIERARQUIA:
//   Coordenador → Head → Diretor
//   Gerente → Head → Diretor
//   Gestor → Gerente → Diretor
//
// O cargo é diferente do perfil de acesso (Membro, Editor, Gestor da
// área): o perfil diz o que a pessoa pode fazer no portal; o cargo,
// quem ela é na hierarquia (usado pelos fluxos de aprovação).
// ============================================================

// Do menor para o maior. Para incluir um cargo, acrescente aqui na
// posição certa (não precisa mudar o Dataverse: o cargo é texto).
export const CARGOS_HIERARQUIA: string[] = [
  'Coordenador',
  'Gestor',
  'Gerente',
  'Head',
  'Diretor'
];

// Vínculo mínimo usado pelas regras (IUsuarioAreaAdmin atende).
export interface IVinculoCargo {
  usuarioId: string;
  areaId: string;
  ativo: boolean;
  cargo?: string;
}

const guid = (valor?: string): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const posicaoDoCargo = (cargo?: string): number =>
  CARGOS_HIERARQUIA.indexOf(cargo || '');

// Cargos existentes na área, do menor para o maior.
export const cadeiaDaArea = (
  areaId: string,
  vinculos: IVinculoCargo[]
): string[] => {
  const area = guid(areaId);
  const presentes: string[] = [];
  vinculos.forEach(vinculo => {
    if (
      vinculo.ativo &&
      guid(vinculo.areaId) === area &&
      posicaoDoCargo(vinculo.cargo) >= 0 &&
      presentes.indexOf(vinculo.cargo as string) < 0
    ) {
      presentes.push(vinculo.cargo as string);
    }
  });
  return presentes.sort((a, b) => posicaoDoCargo(a) - posicaoDoCargo(b));
};

// Cargo que responde pelo nível N da área (0 = topo). Se a cadeia da
// área tem menos níveis, usa o último (o topo): ninguém fica sem
// aprovador por falta de um nível intermediário.
export const cargoDoNivel = (
  areaId: string,
  nivel: number,
  vinculos: IVinculoCargo[]
): string | undefined => {
  const cadeia = cadeiaDaArea(areaId, vinculos);
  if (cadeia.length === 0) {
    return undefined;
  }
  if (!nivel || nivel <= 0) {
    return cadeia[cadeia.length - 1];
  }
  return cadeia[Math.min(nivel, cadeia.length) - 1];
};

// Pessoas com o cargo na área.
export const pessoasComCargo = <T extends IVinculoCargo>(
  areaId: string,
  cargo: string,
  vinculos: T[]
): T[] =>
  vinculos.filter(vinculo =>
    vinculo.ativo &&
    guid(vinculo.areaId) === guid(areaId) &&
    (vinculo.cargo || '') === cargo
  );

export const rotuloNivel = (nivel?: number): string =>
  !nivel || nivel <= 0 ? 'Topo da hierarquia' : `${nivel}º nível da hierarquia`;

// ------------------------------------------------------------
// Alvo de um responsável por hierarquia
// ------------------------------------------------------------

export interface IAlvoHierarquia {
  areaId?: string;
  // Área de quem criou (usada quando areaId está vazio).
  autorId?: string;
  areaPreferidaId?: string;
  cargo?: string;
  nivel?: number;
}

export interface IAlvoResolvido {
  areaId: string;
  cargo: string;
}

// Áreas consideradas: a fixa/do documento; ou as áreas do autor (se o
// autor é da área do documento, só ela; senão, todas as dele).
export const areasDoAlvo = (
  alvo: IAlvoHierarquia,
  vinculos: IVinculoCargo[]
): string[] => {
  if (alvo.areaId) {
    return [guid(alvo.areaId)];
  }
  if (!alvo.autorId) {
    return [];
  }
  const doAutor: string[] = [];
  vinculos.forEach(vinculo => {
    const area = guid(vinculo.areaId);
    if (vinculo.ativo && guid(vinculo.usuarioId) === guid(alvo.autorId) && area && doAutor.indexOf(area) < 0) {
      doAutor.push(area);
    }
  });
  const preferida = guid(alvo.areaPreferidaId);
  return preferida && doAutor.indexOf(preferida) >= 0 ? [preferida] : doAutor;
};

// (área, cargo) que respondem pelo responsável — com os cargos atuais.
export const alvosDaHierarquia = (
  alvo: IAlvoHierarquia,
  vinculos: IVinculoCargo[]
): IAlvoResolvido[] =>
  areasDoAlvo(alvo, vinculos)
    .map(areaId => ({
      areaId,
      cargo: alvo.cargo || (alvo.nivel !== undefined ? cargoDoNivel(areaId, alvo.nivel, vinculos) || '' : '')
    }))
    .filter(item => !!item.cargo);
