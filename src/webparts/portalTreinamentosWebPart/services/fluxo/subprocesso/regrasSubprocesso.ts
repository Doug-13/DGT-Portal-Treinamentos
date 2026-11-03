import {
  IFiltroLinhasSubprocesso,
  IConfigSubprocesso,
  IFluxoElemento,
  IFluxoMetadado,
  ISubprocessoSolicitado
} from '../../../models/Fluxo';

import {
  LinhaTabela,
  lerLinhasTabela,
  linhasPreenchidas
} from '../valoresTabela';

import {
  IValorDocumento,
  gravarValorDocumentos
} from '../valorDocumento';

import {
  lerValorUsuario
} from '../valorUsuario';

// ============================================================
// REGRAS DO SUBPROCESSO (sem Dataverse — testáveis)
//
// Subprocesso = etapa automática (Call Activity no desenho) que cria
// documentos que seguem OUTRO fluxo. Exemplo — auditoria:
//
//   Fluxo "Auditoria" (pai)
//     Etapa "Registrar constatações" → tabela Ações (O quê, Responsável, Prazo)
//     Subprocesso "Abrir planos de ação"
//        → cria um documento PDA por linha, no fluxo "Plano de Ação"
//        → grava os PDAs criados no campo "Ações abertas" do pai
//          (tipo Documentos referenciados) — a aba Referências dos dois
//          documentos mostra a ligação.
// ============================================================

export const PREFIXO_COLUNA = 'coluna:';
export const PREFIXO_CAMPO = 'campo:';

// ------------------------------------------------------------
// Validação (publicação do fluxo)
// ------------------------------------------------------------

export const validarConfigSubprocesso = (
  elemento: IFluxoElemento,
  metadados: IFluxoMetadado[],
  processoAtualId?: string
): string[] => {

  const erros: string[] = [];
  const nome = elemento.nome;
  const config = elemento.subprocesso;

  if (!config) {
    return [`Configure o subprocesso "${nome}" (duplo clique nele).`];
  }

  if (!config.fluxoId) {
    erros.push(`Escolha o fluxo que os documentos do subprocesso "${nome}" vão seguir.`);
  } else if (processoAtualId && config.fluxoId === processoAtualId) {
    erros.push(`O subprocesso "${nome}" não pode criar documentos no mesmo fluxo em que está (evita repetição sem fim).`);
  }

  const metadado = (chave?: string): IFluxoMetadado | undefined =>
    chave ? metadados.find(item => item.chave === chave) : undefined;

  const referencias = metadado(config.campoReferencias);

  if (!config.campoReferencias) {
    erros.push(`Escolha no subprocesso "${nome}" o campo (tipo Documentos referenciados) que vai guardar os documentos criados.`);
  } else if (!referencias) {
    erros.push(`O subprocesso "${nome}" usa um campo que não existe mais (${config.campoReferencias}).`);
  } else if (referencias.tipo !== 'documentos') {
    erros.push(`O campo "${referencias.rotulo}" do subprocesso "${nome}" precisa ser do tipo "Documentos referenciados (vários)".`);
  }

  let tabela: IFluxoMetadado | undefined;

  if (config.origem === 'tabela') {
    tabela = metadado(config.campoTabela);
    if (!config.campoTabela) {
      erros.push(`Escolha a tabela de origem do subprocesso "${nome}" (cada linha vira um documento).`);
    } else if (!tabela) {
      erros.push(`O subprocesso "${nome}" usa uma tabela que não existe mais (${config.campoTabela}).`);
    } else if (tabela.tipo !== 'tabela') {
      erros.push(`O campo "${tabela.rotulo}" do subprocesso "${nome}" precisa ser do tipo Tabela.`);
    }
  }

  const colunaExiste = (chave: string): boolean =>
    !!tabela && (tabela.colunas || []).some(coluna => coluna.chave === chave);

  if (config.origem === 'tabela' && config.filtroLinhas && tabela) {
    const coluna = (tabela.colunas || []).find(item => item.chave === config.filtroLinhas?.coluna);
    if (!coluna) {
      erros.push(`O filtro de linhas do subprocesso "${nome}" usa uma coluna que não existe na tabela de origem.`);
    } else if (coluna.tipo !== 'lista' && coluna.tipo !== 'simNao') {
      erros.push(`O filtro de linhas do subprocesso "${nome}" precisa usar uma coluna do tipo Lista ou Sim/Não ("${coluna.rotulo}" é de outro tipo).`);
    } else if ((config.filtroLinhas.valores || []).length === 0) {
      erros.push(`Marque ao menos um valor no filtro de linhas do subprocesso "${nome}" (coluna "${coluna.rotulo}").`);
    }
  }

  if (!(config.tipoDocumento || '').trim()) {
    erros.push(`Escolha o tipo dos documentos criados pelo subprocesso "${nome}".`);
  }

  if (!(config.titulo || '').trim()) {
    erros.push(`Informe o título dos documentos criados pelo subprocesso "${nome}".`);
  }

  if ((config.autor || '').indexOf(PREFIXO_COLUNA) === 0) {
    const chave = config.autor.substring(PREFIXO_COLUNA.length);
    const coluna = tabela ? (tabela.colunas || []).find(item => item.chave === chave) : undefined;
    if (config.origem !== 'tabela' || !coluna) {
      erros.push(`O autor dos documentos do subprocesso "${nome}" usa uma coluna que não existe na tabela de origem.`);
    } else if (coluna.tipo !== 'usuario') {
      erros.push(`A coluna "${coluna.rotulo}" (autor do subprocesso "${nome}") precisa ser do tipo Usuário.`);
    }
  }

  (config.mapeamentos || []).forEach(item => {
    if (!item.destino) {
      erros.push(`Há um valor sem campo de destino no subprocesso "${nome}".`);
    }
    if (item.origem.indexOf(PREFIXO_COLUNA) === 0 && !colunaExiste(item.origem.substring(PREFIXO_COLUNA.length))) {
      erros.push(`O subprocesso "${nome}" copia uma coluna que não existe na tabela de origem (${item.origem.substring(PREFIXO_COLUNA.length)}).`);
    }
    if (item.origem.indexOf(PREFIXO_CAMPO) === 0 && !metadado(item.origem.substring(PREFIXO_CAMPO.length))) {
      erros.push(`O subprocesso "${nome}" copia um campo que não existe mais (${item.origem.substring(PREFIXO_CAMPO.length)}).`);
    }
  });

  return erros;
};

// ------------------------------------------------------------
// Linhas → documentos
// ------------------------------------------------------------

export interface ILinhaSubprocesso {
  // 1, 2, 3... (posição entre as linhas preenchidas)
  numero: number;
  linha: LinhaTabela;
  assinatura: string;
}

// Identifica uma linha pelo conteúdo (as linhas não têm id). Se o
// fluxo passar de novo pelo subprocesso, linhas iguais às que já
// viraram documento não são recriadas.
export const assinaturaLinha = (
  linha: LinhaTabela
): string =>
  JSON.stringify(
    Object.keys(linha)
      .filter(chave => (linha[chave] || '').trim() !== '')
      .sort()
      .map(chave => [chave, (linha[chave] || '').trim()])
  );

export const ASSINATURA_UNICO = 'unico';

// A linha passa no filtro? (sem filtro = sim). Comparação sem
// diferenciar maiúsculas/minúsculas nem espaços nas pontas.
export const linhaAtendeFiltro = (
  linha: LinhaTabela,
  filtro?: IFiltroLinhasSubprocesso
): boolean => {
  if (!filtro || !filtro.coluna) {
    return true;
  }
  const valor = (linha[filtro.coluna] || '').trim().toLowerCase();
  return (filtro.valores || []).some(item => (item || '').trim().toLowerCase() === valor);
};

export const linhasDoSubprocesso = (
  config: IConfigSubprocesso,
  valores: Record<string, string>
): ILinhaSubprocesso[] => {

  if (config.origem !== 'tabela') {
    return [{ numero: 1, linha: {}, assinatura: ASSINATURA_UNICO }];
  }

  // O número ({n}) é a posição da linha na tabela (entre as
  // preenchidas), mesmo que linhas anteriores fiquem fora do filtro —
  // assim "Ação 3" é a 3ª linha que o usuário vê.
  return linhasPreenchidas(lerLinhasTabela(valores[config.campoTabela || '']))
    .map((linha, indice) => ({
      numero: indice + 1,
      linha,
      assinatura: assinaturaLinha(linha)
    }))
    .filter(item => linhaAtendeFiltro(item.linha, config.filtroLinhas));
};

// Assinaturas já transformadas em documento por ESTE elemento (em
// qualquer passagem anterior).
export const assinaturasCriadas = (
  pedidos: ISubprocessoSolicitado[] | undefined,
  elementoId: string
): string[] =>
  (pedidos || [])
    .filter(item => item.elementoId === elementoId)
    .reduce((lista: string[], item) => lista.concat(item.filhos.map(filho => filho.assinatura)), []);

// ------------------------------------------------------------
// Título e valores do documento filho
// ------------------------------------------------------------

export interface IDadosPai {
  id: string;
  codigo: string;
  titulo: string;
}

// Texto de exibição de um valor (usuário vira o nome; JSON de
// documentos vira os códigos).
const textoDoValor = (
  valor: string
): string => {
  const texto = (valor || '').trim();
  if (texto.charAt(0) === '{') {
    const usuario = lerValorUsuario(texto);
    if (usuario) {
      return usuario.nome;
    }
  }
  if (texto.charAt(0) === '[') {
    try {
      const lista = JSON.parse(texto) as Array<{ codigo?: string }>;
      if (Array.isArray(lista)) {
        return lista.map(item => (item && item.codigo) || '').filter(item => !!item).join(', ');
      }
    } catch {
      return texto;
    }
  }
  return texto;
};

// {pai.codigo} {pai.titulo} {n} {coluna:<chave>} {campo:<chave>}
export const montarTitulo = (
  modelo: string,
  pai: IDadosPai,
  numero: number,
  linha: LinhaTabela,
  valoresPai: Record<string, string>
): string =>
  (modelo || '{pai.codigo} — {n}')
    .replace(/\{([^}]+)\}/g, (_trecho: string, chave: string) => {
      const nome = chave.trim();
      if (nome === 'pai.codigo') return pai.codigo;
      if (nome === 'pai.titulo') return pai.titulo;
      if (nome === 'n') return String(numero);
      if (nome.indexOf(PREFIXO_COLUNA) === 0) return textoDoValor(linha[nome.substring(PREFIXO_COLUNA.length)] || '');
      if (nome.indexOf(PREFIXO_CAMPO) === 0) return textoDoValor(valoresPai[nome.substring(PREFIXO_CAMPO.length)] || '');
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);

// Valores iniciais do fluxo do filho, conforme o mapeamento.
export const valoresIniciaisDoFilho = (
  config: IConfigSubprocesso,
  pai: IDadosPai,
  linha: LinhaTabela,
  valoresPai: Record<string, string>
): Record<string, string> => {

  const valores: Record<string, string> = {};

  (config.mapeamentos || []).forEach(item => {
    if (!item.destino) {
      return;
    }
    let valor = '';
    if (item.origem.indexOf(PREFIXO_COLUNA) === 0) {
      valor = linha[item.origem.substring(PREFIXO_COLUNA.length)] || '';
    } else if (item.origem.indexOf(PREFIXO_CAMPO) === 0) {
      valor = valoresPai[item.origem.substring(PREFIXO_CAMPO.length)] || '';
    } else if (item.origem === 'pai:referencia') {
      valor = gravarValorDocumentos([{ id: pai.id, codigo: pai.codigo, titulo: pai.titulo }]);
    } else if (item.origem === 'pai:codigo') {
      valor = pai.codigo;
    } else if (item.origem === 'pai:titulo') {
      valor = pai.titulo;
    }
    if (valor) {
      valores[item.destino] = valor;
    }
  });

  return valores;
};

// Autor (dgt_usuario) da revisão do filho.
export const autorDoFilho = (
  config: IConfigSubprocesso,
  linha: LinhaTabela,
  executorId: string,
  autorPaiId: string
): string => {
  if ((config.autor || '').indexOf(PREFIXO_COLUNA) === 0) {
    const usuario = lerValorUsuario(linha[config.autor.substring(PREFIXO_COLUNA.length)] || '');
    if (usuario && usuario.id) {
      return usuario.id;
    }
  }
  if (config.autor === 'autorPai' && autorPaiId) {
    return autorPaiId;
  }
  return executorId || autorPaiId;
};

// Junta os documentos já referenciados com os novos (sem repetir).
export const juntarReferencias = (
  atuais: IValorDocumento[],
  novos: IValorDocumento[]
): IValorDocumento[] => {
  const lista = atuais.slice();
  novos.forEach(doc => {
    if (!lista.some(item => item.id === doc.id)) {
      lista.push(doc);
    }
  });
  return lista;
};

// Próximo código ÁREA-TIPO-NNN a partir dos códigos existentes.
export const proximoCodigoDocumento = (
  siglaArea: string,
  siglaTipo: string,
  existentes: string[]
): string => {
  const prefixo = `${(siglaArea || '').trim().toUpperCase()}-${(siglaTipo || '').trim().toUpperCase()}-`;
  const maior =
    existentes
      .map(codigo => (codigo || '').trim().toUpperCase())
      .filter(codigo => codigo.indexOf(prefixo) === 0)
      .map(codigo => parseInt(codigo.substring(prefixo.length), 10))
      .filter(numero => !isNaN(numero))
      .reduce((atual, numero) => Math.max(atual, numero), 0);
  const sequencial = `000${maior + 1}`;
  return `${prefixo}${sequencial.substring(sequencial.length - Math.max(3, String(maior + 1).length))}`;
};
