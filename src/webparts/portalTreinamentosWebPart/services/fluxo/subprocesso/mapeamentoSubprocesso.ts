import {
  IColunaTabela,
  IConfigSubprocesso,
  IFluxoMetadado,
  IMapeamentoSubprocesso
} from '../../../models/Fluxo';

import {
  lerValorUsuario
} from '../valorUsuario';

import {
  lerValorArea
} from '../valorArea';

import {
  gravarValorDocumentos,
  lerValorDocumentos
} from '../valorDocumento';

import {
  PREFIXO_CAMPO,
  PREFIXO_COLUNA
} from './regrasSubprocesso';

// ============================================================
// MAPEAMENTO PAI → FILHO (subprocesso)
//
// Os fluxos têm metadados próprios; o mapeamento liga um valor do pai
// (campo, coluna da linha ou dados do documento) a um campo do filho.
//   compatibilidade()  → editor e publicação: ok / aviso / incompatível
//   adaptarValor()     → criação do filho: ajusta o valor ao tipo do
//                        campo de destino (ou descarta, sem gravar lixo)
//   sugerirMapeamentos → "Mapear automaticamente": mesma chave, ou mesmo
//                        nome, com tipo compatível
// "Criar no filho" usa a MESMA chave do pai — se um dia os metadados
// forem compartilhados entre processos, a unificação é pela chave.
// ============================================================

export interface ITipoOrigem {
  tipo: string;
  opcoes?: string[];
  rotulo: string;
}

export type NivelCompatibilidade = 'ok' | 'aviso' | 'incompativel';

export interface ICompatibilidade {
  nivel: NivelCompatibilidade;
  mensagem: string;
}

const TEXTUAIS = ['texto', 'textoLongo'];
const CONVERTIVEIS_EM_TEXTO = ['texto', 'textoLongo', 'numero', 'data', 'lista', 'simNao', 'usuario', 'area', 'documento', 'documentos'];

const normalizar = (texto: string): string =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Tipo do valor de origem.
export const tipoDaOrigem = (
  origem: string,
  config: IConfigSubprocesso,
  metadadosPai: IFluxoMetadado[]
): ITipoOrigem | undefined => {
  if (origem.indexOf(PREFIXO_CAMPO) === 0) {
    const meta = metadadosPai.find(item => item.chave === origem.substring(PREFIXO_CAMPO.length));
    return meta ? { tipo: meta.tipo, opcoes: meta.opcoes, rotulo: meta.rotulo } : undefined;
  }
  if (origem.indexOf(PREFIXO_COLUNA) === 0) {
    const tabela = metadadosPai.find(item => item.chave === config.campoTabela);
    const coluna = tabela ? (tabela.colunas || []).find((item: IColunaTabela) => item.chave === origem.substring(PREFIXO_COLUNA.length)) : undefined;
    return coluna ? { tipo: coluna.tipo, opcoes: coluna.opcoes, rotulo: coluna.rotulo } : undefined;
  }
  if (origem === 'pai:referencia') {
    return { tipo: 'documento', rotulo: 'Documento de origem' };
  }
  if (origem === 'pai:codigo' || origem === 'pai:titulo') {
    return { tipo: 'texto', rotulo: origem === 'pai:codigo' ? 'Código do pai' : 'Título do pai' };
  }
  return undefined;
};

export const compatibilidade = (
  origem: ITipoOrigem,
  destino: IFluxoMetadado
): ICompatibilidade => {
  const de = origem.tipo;
  const para = destino.tipo;

  if (para === 'componente' || de === 'componente') {
    return { nivel: 'incompativel', mensagem: 'Componentes não são copiados entre fluxos.' };
  }
  if (de === para) {
    if (para === 'lista') {
      const faltam = (origem.opcoes || []).filter(opcao => (destino.opcoes || []).map(normalizar).indexOf(normalizar(opcao)) < 0);
      return faltam.length > 0
        ? { nivel: 'aviso', mensagem: `Opções que não existem no filho ficam em branco: ${faltam.join(', ')}.` }
        : { nivel: 'ok', mensagem: 'Mesmo tipo e opções.' };
    }
    if (para === 'tabela') {
      return { nivel: 'aviso', mensagem: 'Tabela copiada linha a linha: só as colunas com a mesma chave aparecem no filho.' };
    }
    if (para === 'avaliacao') {
      return { nivel: 'aviso', mensagem: 'Avaliação copiada: as notas só valem se os critérios tiverem as mesmas chaves.' };
    }
    return { nivel: 'ok', mensagem: 'Mesmo tipo.' };
  }
  if (TEXTUAIS.indexOf(para) >= 0 && CONVERTIVEIS_EM_TEXTO.indexOf(de) >= 0) {
    return { nivel: 'ok', mensagem: 'Gravado como texto no filho.' };
  }
  if (para === 'documentos' && de === 'documento') {
    return { nivel: 'ok', mensagem: 'O documento entra na lista do filho.' };
  }
  if (para === 'documento' && de === 'documentos') {
    return { nivel: 'aviso', mensagem: 'O filho aceita um documento: só o primeiro é levado.' };
  }
  if (TEXTUAIS.indexOf(de) >= 0 && ['lista', 'simNao', 'numero', 'data'].indexOf(para) >= 0) {
    return { nivel: 'aviso', mensagem: 'Só é levado quando o texto for um valor válido no filho (senão fica em branco).' };
  }
  return { nivel: 'incompativel', mensagem: `Tipos diferentes (${de} → ${para}): o valor não pode ser levado.` };
};

// Ajusta um valor ao tipo do campo de destino. undefined = descartar.
export const adaptarValor = (
  valor: string,
  destino: IFluxoMetadado
): string | undefined => {
  const texto = (valor || '').trim();
  if (!texto) {
    return undefined;
  }
  switch (destino.tipo) {
    case 'texto':
    case 'textoLongo': {
      // Área e Usuário têm { id, nome }; a sigla identifica a Área.
      const area = /"sigla"\s*:/.test(texto) ? lerValorArea(texto) : undefined;
      if (area) { return area.sigla ? `${area.sigla} — ${area.nome}` : area.nome; }
      const usuario = lerValorUsuario(texto);
      if (usuario) { return usuario.nome; }
      const documentos = lerValorDocumentos(texto);
      if (documentos.length > 0) { return documentos.map(item => item.codigo).join(', '); }
      if (texto === 'sim' || texto === 'nao') { return texto === 'sim' ? 'Sim' : 'Não'; }
      return texto;
    }
    case 'usuario':
      return lerValorUsuario(texto) ? texto : undefined;
    case 'area':
      return lerValorArea(texto) ? texto : undefined;
    case 'documento': {
      const documentos = lerValorDocumentos(texto);
      return documentos.length > 0 ? gravarValorDocumentos([documentos[0]]) : undefined;
    }
    case 'documentos':
      return lerValorDocumentos(texto).length > 0 ? texto : undefined;
    case 'lista': {
      const opcao = (destino.opcoes || []).find(item => normalizar(item) === normalizar(texto));
      return opcao;
    }
    case 'simNao': {
      const v = normalizar(texto);
      return ['sim', 's', 'true', 'yes'].indexOf(v) >= 0 ? 'sim' : ['nao', 'n', 'false', 'no'].indexOf(v) >= 0 ? 'nao' : undefined;
    }
    case 'numero': {
      const numero = Number(texto.indexOf(',') >= 0 ? texto.replace(/\./g, '').replace(',', '.') : texto);
      return isFinite(numero) ? String(numero) : undefined;
    }
    case 'data': {
      if (/^\d{4}-\d{2}-\d{2}/.test(texto)) { return texto.substring(0, 10); }
      const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
      return br ? `${br[3]}-${br[2]}-${br[1]}` : undefined;
    }
    case 'tabela':
    case 'avaliacao':
      return texto.charAt(0) === '{' || texto.charAt(0) === '[' ? texto : undefined;
    default:
      return undefined;
  }
};

// Ajusta os valores iniciais aos metadados do filho.
export const adaptarValoresIniciais = (
  valores: Record<string, string>,
  metadadosFilho: IFluxoMetadado[]
): { valores: Record<string, string>; descartados: string[] } => {
  const resultado: Record<string, string> = {};
  const descartados: string[] = [];
  Object.keys(valores).forEach(chave => {
    const destino = metadadosFilho.find(item => item.chave === chave);
    if (!destino) {
      descartados.push(chave);
      return;
    }
    const adaptado = adaptarValor(valores[chave], destino);
    if (adaptado === undefined) {
      if ((valores[chave] || '').trim()) {
        descartados.push(destino.rotulo);
      }
      return;
    }
    resultado[chave] = adaptado;
  });
  return { valores: resultado, descartados };
};

// "Mapear automaticamente": cada campo do filho ainda sem origem recebe
// o campo do pai de mesma chave (ou, senão, de mesmo nome) com tipo
// compatível. Não mexe nos pares existentes.
export const sugerirMapeamentos = (
  config: IConfigSubprocesso,
  metadadosPai: IFluxoMetadado[],
  metadadosFilho: IFluxoMetadado[]
): IMapeamentoSubprocesso[] => {
  const existentes = config.mapeamentos || [];
  const sugestoes: IMapeamentoSubprocesso[] = [];
  metadadosFilho
    .filter(destino => !existentes.some(item => item.destino === destino.chave))
    .forEach(destino => {
      const candidatos = [
        metadadosPai.find(meta => meta.chave === destino.chave),
        metadadosPai.find(meta => normalizar(meta.rotulo) === normalizar(destino.rotulo))
      ];
      const escolhido = candidatos.find(meta =>
        !!meta && compatibilidade({ tipo: meta.tipo, opcoes: meta.opcoes, rotulo: meta.rotulo }, destino).nivel !== 'incompativel');
      if (escolhido) {
        sugestoes.push({ origem: `${PREFIXO_CAMPO}${escolhido.chave}`, destino: destino.chave });
      }
    });
  return sugestoes;
};

// Campos do pai que o filho não tem (candidatos a "Criar no filho").
export const camposAusentesNoFilho = (
  metadadosPai: IFluxoMetadado[],
  metadadosFilho: IFluxoMetadado[]
): IFluxoMetadado[] =>
  metadadosPai.filter(meta =>
    meta.tipo !== 'componente' &&
    !metadadosFilho.some(item => item.chave === meta.chave));

// Validação com os metadados do filho (editor, antes de publicar).
export const validarMapeamentos = (
  nome: string,
  config: IConfigSubprocesso,
  metadadosPai: IFluxoMetadado[],
  metadadosFilho: IFluxoMetadado[]
): string[] => {
  const erros: string[] = [];
  (config.mapeamentos || []).forEach(item => {
    if (!item.destino) {
      return;
    }
    const destino = metadadosFilho.find(meta => meta.chave === item.destino);
    if (!destino) {
      erros.push(`Subprocesso "${nome}": o campo "${item.destino}" não existe mais no processo filho.`);
      return;
    }
    const origem = tipoDaOrigem(item.origem, config, metadadosPai);
    if (!origem) {
      erros.push(`Subprocesso "${nome}": a origem do valor para "${destino.rotulo}" não existe mais.`);
      return;
    }
    const compat = compatibilidade(origem, destino);
    if (compat.nivel === 'incompativel') {
      erros.push(`Subprocesso "${nome}": "${origem.rotulo}" → "${destino.rotulo}": ${compat.mensagem}`);
    }
  });
  return erros;
};
