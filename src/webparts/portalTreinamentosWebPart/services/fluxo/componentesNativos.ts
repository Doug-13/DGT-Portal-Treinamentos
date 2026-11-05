// ============================================================
// COMPONENTES NATIVOS disponíveis para o campo "Componente"
//
// Só a descrição (sem React), para validação, editor e pacote JSON.
// A tela de cada um fica em components/fluxo/componentes/.
// ============================================================

export interface IParametroComponenteNativo {
  chave: string;
  rotulo: string;
  ajuda?: string;
  // 'campo' = escolher um metadado do processo; 'texto' = valor livre.
  tipo: 'campo' | 'texto';
}

export interface IComponenteNativo {
  chave: string;
  nome: string;
  descricao: string;
  parametros: IParametroComponenteNativo[];
}

export const COMPONENTES_NATIVOS: IComponenteNativo[] = [
  {
    chave: 'montadorBom',
    nome: 'Montador de B.O.M. (Seleção de kit)',
    descricao:
      'A tela de Seleção de kit da Arquitetura de Soluções: pontos, estrutura, câmeras, switch e soluções; ' +
      'gera a lista de itens (código CIGAM e quantidade) com as regras e o catálogo da aba Kits.',
    parametros: [
      { chave: 'campoCanal', rotulo: 'Campo com o canal (Público/Privado)', tipo: 'campo', ajuda: 'Opcional: mostrado no cabeçalho do projeto.' },
      { chave: 'canal', rotulo: 'Canal fixo (se não houver campo)', tipo: 'texto' }
    ]
  }
];

export const CHAVES_NATIVOS = COMPONENTES_NATIVOS.map(item => item.chave);
