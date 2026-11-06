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
  // 'campo'   = escolher um metadado do processo
  // 'texto'   = valor livre
  // 'escolha' = uma das opções
  tipo: 'campo' | 'texto' | 'escolha';
  // tipo 'campo': tipos de metadado aceitos (padrão: texto, lista, simNao).
  tiposCampo?: string[];
  // tipo 'campo' com componente: só componentes deste nativo.
  nativoDoCampo?: string;
  // tipo 'escolha'
  opcoes?: Array<{ valor: string; rotulo: string }>;
  obrigatorio?: boolean;
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
  },
  {
    chave: 'calculoHH',
    nome: 'Cálculo de HH (sobre a Seleção de kit)',
    descricao:
      'Aplica o HH da versão VIGENTE de cada área (menu Cálculo de HH) aos pontos da Seleção de kit do registro: ' +
      'HH dos pontos e alocação de Analista de Projetos e Suprimentos sobre o custo total. ' +
      'Grava o resultado e qual versão de HH foi usada (auditoria).',
    parametros: [
      {
        chave: 'campoKit',
        rotulo: 'Campo com a Seleção de kit',
        tipo: 'campo',
        tiposCampo: ['componente'],
        nativoDoCampo: 'montadorBom',
        obrigatorio: true,
        ajuda: 'O campo do tipo Componente (Montador de B.O.M.) de uma etapa anterior.'
      },
      {
        chave: 'campoCusto',
        rotulo: 'Campo com o custo total do projeto (R$)',
        tipo: 'campo',
        tiposCampo: ['numero'],
        ajuda: 'Opcional. Sem ele, o custo é digitado nesta tela e gravado junto.'
      },
      {
        chave: 'exigirCusto',
        rotulo: 'Custo total obrigatório para concluir?',
        tipo: 'escolha',
        opcoes: [{ valor: 'nao', rotulo: 'Não (só o HH dos pontos)' }, { valor: 'sim', rotulo: 'Sim (exige a alocação de horas)' }]
      }
    ]
  }
];

export const CHAVES_NATIVOS = COMPONENTES_NATIVOS.map(item => item.chave);

// Parâmetros obrigatórios/opções do nativo escolhido.
export const validarParametrosNativo = (
  rotulo: string,
  config?: { tipo: string; nativo?: string; parametros?: Record<string, string> },
  metadados?: Array<{ chave: string; tipo: string; componente?: { tipo: string; nativo?: string } }>
): string[] => {
  if (!config || config.tipo !== 'nativo') {
    return [];
  }
  const nativo = COMPONENTES_NATIVOS.find(item => item.chave === config.nativo);
  if (!nativo) {
    return [];
  }
  const erros: string[] = [];
  const parametros = config.parametros || {};
  nativo.parametros.forEach(parametro => {
    const valor = (parametros[parametro.chave] || '').trim();
    if (parametro.obrigatorio && !valor) {
      erros.push(`Componente "${rotulo}": informe "${parametro.rotulo}".`);
      return;
    }
    if (!valor) {
      return;
    }
    if (parametro.tipo === 'escolha' && parametro.opcoes && !parametro.opcoes.some(opcao => opcao.valor === valor)) {
      erros.push(`Componente "${rotulo}": "${parametro.rotulo}" deve ser ${parametro.opcoes.map(opcao => opcao.valor).join(' ou ')}.`);
    }
    if (parametro.tipo === 'campo' && metadados) {
      const campo = metadados.find(item => item.chave === valor);
      const tipos = parametro.tiposCampo || ['texto', 'lista', 'simNao'];
      if (!campo) {
        erros.push(`Componente "${rotulo}": o campo "${valor}" (${parametro.rotulo}) não existe no processo.`);
      } else if (tipos.indexOf(campo.tipo) < 0) {
        erros.push(`Componente "${rotulo}": "${parametro.rotulo}" precisa ser um campo do tipo ${tipos.join(' ou ')}.`);
      } else if (parametro.nativoDoCampo && !(campo.componente && campo.componente.nativo === parametro.nativoDoCampo)) {
        erros.push(`Componente "${rotulo}": "${parametro.rotulo}" precisa ser um componente "${parametro.nativoDoCampo}".`);
      }
    }
  });
  return erros;
};
