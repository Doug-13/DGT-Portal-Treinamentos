import {
  IDocumentoColaborador,
  ITipoDocumentoFornecedor,
  mesmoNomeDeTipo,
  tipoExigeNorma
} from './modeloFornecedores';

import {
  EstadoDocumento,
  estadoPeloVencimento
} from './situacaoDocumental';

// ============================================================
// FORNECEDORES — COLABORADORES DO PRESTADOR (cálculo puro, testável)
//
// Documentos de cada colaborador: tipos CADASTRADOS em Tipos de
// documento (aplica-se a Colaborador), cada um "obrigatório para todos
// os colaboradores" ou opcional. Um vigente por tipo; no "NR aplicável",
// um vigente por norma (texto livre: NR-10, NR-35...).
// O CPF é só identificação: valida o dígito e nunca vai para texto
// livre, histórico ou e-mail.
// ============================================================

export const normalizarCpf = (valor: string): string => (valor || '').replace(/\D/g, '').substring(0, 11);

export const cpfValido = (valor: string): boolean => {
  const cpf = normalizarCpf(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }
  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base.charAt(i)) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.substring(0, 9), 10);
  const d2 = digito(cpf.substring(0, 10), 11);
  return d1 === Number(cpf.charAt(9)) && d2 === Number(cpf.charAt(10));
};

export const formatarCpf = (valor: string): string => {
  const d = normalizarCpf(valor);
  return d.length === 11 ? `${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6, 9)}-${d.substring(9)}` : d;
};

// "***.***.789-01" — só os últimos dígitos, até a pessoa pedir para ver.
export const mascararCpf = (valor: string): string => {
  const d = normalizarCpf(valor);
  return d.length === 11 ? `***.***.${d.substring(6, 9)}-${d.substring(9)}` : (d ? '***' : '');
};

// Mesma norma escrita de jeitos diferentes ("NR 10", "nr-10") = mesma chave.
export const chaveNorma = (norma: string): string =>
  (norma || '').toUpperCase().replace(/\s+/g, '').replace(/^NR-?/, 'NR-');

// Tipo cadastrado do documento: pelo id (dgt_TipoDocumento) ou, nos
// registros antigos sem o lookup, pelo nome gravado (dgt_tipo).
export const tipoDoDocumento = (
  d: Pick<IDocumentoColaborador, 'tipoId' | 'tipo'>,
  tipos: ITipoDocumentoFornecedor[]
): ITipoDocumentoFornecedor | undefined =>
  (d.tipoId ? tipos.filter(t => t.id === d.tipoId)[0] : undefined) ||
  tipos.filter(t => mesmoNomeDeTipo(t.nome, d.tipo))[0];

// "Nova versão do mesmo tipo deixa a anterior Substituída": a chave é o
// id do tipo (mais a norma, no "NR aplicável"). Sem tipo cadastrado,
// vale o nome gravado.
export const chaveDocumento = (
  d: Pick<IDocumentoColaborador, 'tipoId' | 'tipo' | 'norma'>,
  tipos: ITipoDocumentoFornecedor[]
): string => {
  const tipo = tipoDoDocumento(d, tipos);
  const base = tipo ? tipo.id : `nome:${(d.tipo || '').trim().toLowerCase()}`;
  return tipoExigeNorma(tipo ? tipo.nome : d.tipo) ? `${base}|${chaveNorma(d.norma)}` : base;
};

export interface IItemColaborador {
  chave: string;
  rotulo: string;
  obrigatorio: boolean;
  tipo?: ITipoDocumentoFornecedor;
  documento?: IDocumentoColaborador;
  estado: EstadoDocumento;
  dias?: number;
}

export interface ISituacaoColaborador {
  // Obrigatórios primeiro (registrados ou não), depois os demais
  // documentos vigentes registrados.
  itens: IItemColaborador[];
  faltandoObrigatorios: string[];
  // Obrigatório faltando ou vencido, ou qualquer documento vencido.
  pendente: boolean;
}

// Vigente mais recente por chave.
export const vigentesDoColaborador = (
  documentos: IDocumentoColaborador[],
  tipos: ITipoDocumentoFornecedor[]
): Record<string, IDocumentoColaborador> => {
  const mapa: Record<string, IDocumentoColaborador> = {};
  documentos
    .filter(d => d.situacao === 'Vigente')
    .forEach(d => {
      const chave = chaveDocumento(d, tipos);
      const atual = mapa[chave];
      if (!atual || `${d.emissao}|${d.criadoEm}` > `${atual.emissao}|${atual.criadoEm}`) {
        mapa[chave] = d;
      }
    });
  return mapa;
};

// Tipos de colaborador cadastrados (ativos), obrigatórios primeiro.
export const tiposDeColaborador = (tipos: ITipoDocumentoFornecedor[]): ITipoDocumentoFornecedor[] =>
  tipos
    .filter(t => t.aplicaA === 'Colaborador' && t.ativo)
    .sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

// Pendência do colaborador:
//   tipo OBRIGATÓRIO sem documento vigente, ou com o documento vencido;
//   tipo OPCIONAL só quando o documento registrado vence.
// Tipo opcional nunca registrado não gera pendência.
export const situacaoColaborador = (
  documentos: IDocumentoColaborador[],
  tipos: ITipoDocumentoFornecedor[],
  hoje: Date = new Date()
): ISituacaoColaborador => {
  const deColaborador = tiposDeColaborador(tipos);
  const vigentes = vigentesDoColaborador(documentos, tipos);

  const item = (chave: string, rotulo: string, obrigatorio: boolean, tipo?: ITipoDocumentoFornecedor, documento?: IDocumentoColaborador): IItemColaborador => {
    if (!documento) {
      return { chave, rotulo, obrigatorio, tipo, estado: 'Faltando' };
    }
    const { estado, dias } = estadoPeloVencimento(documento.vencimento, hoje);
    return { chave, rotulo, obrigatorio, tipo, documento, estado, dias };
  };

  const usadas: string[] = [];
  const itens: IItemColaborador[] = [];

  // Obrigatórios: um item por tipo (no "NR aplicável" obrigatório, basta
  // ter alguma norma vigente; cada norma aparece abaixo).
  deColaborador.filter(t => t.obrigatorio).forEach(tipo => {
    if (tipoExigeNorma(tipo.nome)) {
      const chaves = Object.keys(vigentes).filter(k => k.indexOf(`${tipo.id}|`) === 0);
      if (chaves.length === 0) {
        itens.push(item(tipo.id, tipo.nome, true, tipo));
      }
      return;
    }
    usadas.push(tipo.id);
    itens.push(item(tipo.id, tipo.nome, true, tipo, vigentes[tipo.id]));
  });

  // Demais documentos vigentes (opcionais, normas, tipos desativados).
  Object.keys(vigentes)
    .filter(k => usadas.indexOf(k) < 0)
    .forEach(k => {
      const documento = vigentes[k];
      const tipo = tipoDoDocumento(documento, tipos);
      const nome = tipo ? tipo.nome : documento.tipo;
      const rotulo = tipoExigeNorma(nome) ? (documento.norma || nome) : nome;
      itens.push(item(k, rotulo, !!tipo && tipo.obrigatorio && tipo.ativo, tipo, documento));
    });

  const lista = itens
    .sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio) || a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));

  const faltandoObrigatorios = lista.filter(i => i.obrigatorio && i.estado === 'Faltando').map(i => i.rotulo);

  return {
    itens: lista,
    faltandoObrigatorios,
    pendente: lista.some(i => (i.obrigatorio && i.estado === 'Faltando') || (!!i.documento && i.estado === 'Vencido'))
  };
};
