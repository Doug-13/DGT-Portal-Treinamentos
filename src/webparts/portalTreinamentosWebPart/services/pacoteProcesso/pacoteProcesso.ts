import {
  AcaoSistemaFluxo,
  AnexoArquivoEtapa,
  IColunaTabela,
  IConfigSubprocesso,
  IFluxoAcao,
  IFluxoCampo,
  IFluxoDefinicao,
  IFluxoElemento,
  IFluxoMetadado,
  IFluxoResponsavel,
  IFluxoTransicao,
  StatusDocumentoEtapa,
  TipoCampoFluxo,
  TipoColunaTabela,
  TipoElementoFluxo
} from '../../models/Fluxo';

// Tipo do evento de revisão (mesmo do campo IFluxoElemento.tipoRevisao).
type TipoEventoRevisao = NonNullable<IFluxoElemento['tipoRevisao']>;

import {
  IconeChave
} from '../../components/common/Icones';

import {
  corrigirLigacoesParaDecisao
} from '../fluxo/correcoesFluxo';

import {
  validarConfigAvaliacao
} from '../fluxo/valorAvaliacao';

import {
  validarConfigComponente
} from '../fluxo/valorComponente';

import {
  CHAVES_NATIVOS,
  validarParametrosNativo
} from '../fluxo/componentesNativos';

import {
  validarDefinicao
} from '../fluxo/FluxoValidacao';

import {
  IAmbienteLayout,
  IEtapaLayout,
  IVisaoAmbiente,
  layoutPadrao,
  normalizarLayout
} from '../ambientes/layoutAmbiente';

// ============================================================
// PACOTE DE PROCESSO (JSON) — formato "dgt-portal/pacote-processo@1"
//
// Um único JSON descreve um processo completo para o portal criar:
//   processo   → código, nome, área
//   metadados  → campos do processo (os mesmos de Processos → Metadados)
//   fluxo      → etapas, responsáveis, campos por etapa e caminhos
//   ambiente   → (opcional) ambiente no menu + telas configuráveis
//
// Pensado para ser GERADO POR IA (skill): nada de ids internos —
// áreas por SIGLA, pessoas por E-MAIL, outros fluxos por CÓDIGO,
// caminhos como { de, para, quando } e posições opcionais (o desenho
// é montado sozinho). Referência completa: docs/pacote-processo.md.
//
// Este módulo não acessa o Dataverse: interpreta e valida o JSON com
// as referências recebidas, e gera o JSON de exportação.
// ============================================================

export const FORMATO_PACOTE = 'dgt-portal/pacote-processo@1';

// ------------------------------------------------------------
// Formato de entrada (o que a IA escreve)
// ------------------------------------------------------------

export interface IPacoteResponsavel {
  tipo: string;
  // tipo 'area' | 'cargoArea' | 'nivelHierarquico': sigla da área
  area?: string;
  // tipo 'usuario': e-mail da pessoa
  email?: string;
  // tipo 'campoUsuario': chave do campo (Usuário) do processo
  campo?: string;
  cargo?: string;
  nivel?: number;
  somenteGestores?: boolean;
  origemArea?: 'documento' | 'autor';
  descricao?: string;
}

export interface IPacoteCampoEtapa {
  // Chave do metadado; rótulo/tipo/opções vêm dele quando omitidos.
  chave: string;
  rotulo?: string;
  tipo?: string;
  obrigatorio?: boolean;
  somenteLeitura?: boolean;
  opcoes?: string[];
  colunas?: IColunaTabela[];
  ajuda?: string;
  mostrarQuando?: { campo: string; valor: string };
  obrigatorioQuando?: { campo: string; valor: string };
  validarNosResultados?: string[];
}

export interface IPacoteElemento {
  id: string;
  tipo: string;
  nome: string;
  descricao?: string;
  instrucoes?: string;
  subtitulo?: string;
  prazoDiasUteis?: number;
  responsaveis?: IPacoteResponsavel[];
  acoes?: Array<Partial<IFluxoAcao> & { chave: string; rotulo: string; resultado: string }>;
  campos?: IPacoteCampoEtapa[];
  statusDocumento?: string;
  anexoArquivo?: string;
  permiteEditarDocumento?: boolean;
  acaoSistema?: string;
  tipoRevisao?: string;
  removerArquivo?: boolean;
  // subprocesso: "fluxo" = CÓDIGO do processo cujo fluxo os filhos seguem
  subprocesso?: Partial<IConfigSubprocesso> & { fluxo?: string; area?: string };
  posicao?: { x: number; y: number; largura?: number; altura?: number };
}

export interface IPacoteTransicao {
  de: string;
  para: string;
  rotulo?: string;
  // Sem "quando" = sempre. { resultado } = botão usado; { campo, valor } = valor de campo.
  quando?: { resultado?: string; campo?: string; valor?: string };
  padrao?: boolean;
  excecao?: boolean;
  pontos?: Array<{ x: number; y: number }>;
}

export interface IPacoteAmbiente {
  nome: string;
  chave?: string;
  descricao?: string;
  subtitulo?: string;
  icone?: string;
  ordem?: number;
  prefixoCodigo?: string;
  rotuloRegistro?: string;
  liberadoParaTodos?: boolean;
  perfisPadrao?: string[];
  // Pacote SEM "fluxo": código de um processo existente cujo fluxo o
  // ambiente vai usar. Omitido = escolher na tela de importação.
  fluxo?: string;
  telas?: {
    visoes?: Array<Omit<IVisaoAmbiente, 'id' | 'icone'> & { id?: string; icone?: string }>;
    colunas?: string[];
    etapas?: Array<{ id: string; rotulo?: string; visivel?: boolean }>;
    registro?: Partial<IAmbienteLayout['registro']>;
    lista?: Partial<IAmbienteLayout['lista']>;
  };
}

// Combinações aceitas:
//   processo + fluxo (+ ambiente)  → cria tudo
//   processo (sem fluxo) + ambiente → cria processo/campos; o ambiente usa
//                                     ambiente.fluxo ou o escolhido na tela
//   processo (sem fluxo)            → só processo e campos (desenhar depois)
//   ambiente (sem processo/fluxo)   → só o ambiente, com fluxo existente
export interface IPacoteProcesso {
  formato: string;
  processo?: { codigo: string; nome: string; descricao?: string; area?: string };
  metadados?: IFluxoMetadado[];
  fluxo?: { elementos: IPacoteElemento[]; transicoes: IPacoteTransicao[] };
  ambiente?: IPacoteAmbiente;
}

// ------------------------------------------------------------
// Referências do ambiente Dataverse (para resolver sigla/e-mail/código)
// ------------------------------------------------------------

export interface IReferenciasPacote {
  areas: Array<{ id: string; sigla?: string; nome: string }>;
  usuarios: Array<{ id: string; email: string; nome: string }>;
  processos: Array<{ id: string; codigo: string; nome: string }>;
}

// ------------------------------------------------------------
// Resultado da interpretação
// ------------------------------------------------------------

export interface IAmbienteDoPacote {
  nome: string;
  chave: string;
  descricao: string;
  subtitulo: string;
  icone: IconeChave;
  ordem: number;
  prefixoCodigo: string;
  rotuloRegistro: string;
  liberadoParaTodos: boolean;
  perfisPadrao: string[];
  // Layout já ajustado ao fluxo do pacote (undefined = padrão).
  layout?: IAmbienteLayout;
  // Fluxo existente indicado em "ambiente.fluxo" (pacote sem fluxo).
  processoExistenteId?: string;
  processoExistenteNome?: string;
}

export interface IPacoteInterpretado {
  // Ausente = pacote só de ambiente (usa um fluxo existente).
  processo?: { codigo: string; nome: string; descricao: string; areaId?: string; areaNome?: string };
  metadados: IFluxoMetadado[];
  // Definição SEM processo (processoId/id/versão são definidos na
  // importação). Ausente = pacote sem fluxo.
  definicao?: IFluxoDefinicao;
  ambiente?: IAmbienteDoPacote;
}

export interface IResultadoInterpretacao {
  // Erros que impedem a importação.
  erros: string[];
  // Pontos de atenção (importa, mas vale revisar).
  avisos: string[];
  // Problemas que impedem PUBLICAR o fluxo (validação do editor).
  errosPublicacao: string[];
  pacote?: IPacoteInterpretado;
}

// ------------------------------------------------------------
// Listas aceitas
// ------------------------------------------------------------

const TIPOS_CAMPO: TipoCampoFluxo[] = ['avaliacao', 'componente', 'simNao', 'texto', 'textoLongo', 'numero', 'data', 'lista', 'tabela', 'usuario', 'documento', 'documentos', 'area'];
const TIPOS_COLUNA: TipoColunaTabela[] = ['texto', 'textoLongo', 'numero', 'data', 'simNao', 'lista', 'usuario', 'documento', 'documentos', 'area'];
const TIPOS_ELEMENTO: TipoElementoFluxo[] = ['inicio', 'fim', 'tarefaHumana', 'tarefaSistema', 'gateway', 'eventoRevisao', 'subprocesso'];
const TIPOS_RESPONSAVEL = ['autorRevisao', 'gestorArea', 'area', 'cargoArea', 'nivelHierarquico', 'usuario', 'campoUsuario'];
const STATUS_DOCUMENTO: StatusDocumentoEtapa[] = ['Elaboração', 'Revisão', 'Aprovação', 'Vigente'];
const ACOES_SISTEMA: AcaoSistemaFluxo[] = ['publicarComRetreinamento', 'publicarSemRetreinamento', 'novaRevisao', 'novaSubRevisao', 'proximaRevisao', 'removerArquivoRevisao'];
const ANEXO: AnexoArquivoEtapa[] = ['nao', 'opcional', 'obrigatorio'];
const ICONES: string[] = ['workflow', 'gavel', 'fileText', 'folder', 'building', 'package', 'wallet', 'users', 'checkCircle', 'barChart', 'grid', 'layers', 'settings', 'search', 'megaphone', 'activity', 'bell', 'clock', 'alertTriangle'];

const DESCRICAO_RESPONSAVEL: Record<string, string> = {
  autorRevisao: 'Autor da revisão',
  gestorArea: 'Gestor da área do documento',
  area: 'Área',
  cargoArea: 'Cargo na área',
  nivelHierarquico: 'Nível hierárquico',
  usuario: 'Usuário',
  campoUsuario: 'Usuário de um campo'
};

const ACAO_PADRAO: IFluxoAcao = { chave: 'concluir', rotulo: 'Concluir', resultado: 'concluido', principal: true, exigeComentario: false };

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const guid = (valor?: string): string => String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();
const texto = (valor: unknown): string => (valor === undefined || valor === null ? '' : String(valor)).trim();

// Id de elemento válido no BPMN (começa com letra ou _).
export const idElementoValido = (id: string): string => {
  const limpo = texto(id).replace(/[^A-Za-z0-9_-]/g, '_');
  return /^[A-Za-z_]/.test(limpo) ? limpo : `e_${limpo}`;
};

const TAMANHOS: Record<string, { largura: number; altura: number }> = {
  inicio: { largura: 36, altura: 36 },
  fim: { largura: 36, altura: 36 },
  eventoRevisao: { largura: 36, altura: 36 },
  gateway: { largura: 50, altura: 50 },
  tarefaHumana: { largura: 140, altura: 80 },
  tarefaSistema: { largura: 140, altura: 80 },
  subprocesso: { largura: 140, altura: 80 }
};

// ------------------------------------------------------------
// Layout automático do desenho
// ------------------------------------------------------------

// Colunas por "nível" (caminho mais longo a partir do Início, ignorando
// caminhos de exceção/retorno); dentro de cada coluna, uma linha por
// elemento. Caminhos que voltam passam por baixo do desenho.
export const calcularLayout = (
  elementos: IFluxoElemento[],
  transicoes: IFluxoTransicao[]
): { larguraDiagrama: number; alturaDiagrama: number } => {

  const nivel: Record<string, number> = {};
  const inicio = elementos.find(item => item.tipo === 'inicio');
  const avancos = transicoes.filter(item => !item.excecao);

  // Bellman-Ford limitado (o fluxo é pequeno): caminho mais longo sem ciclos.
  elementos.forEach(item => { nivel[item.id] = item === inicio ? 0 : -1; });
  if (inicio) {
    for (let rodada = 0; rodada < elementos.length; rodada++) {
      let mudou = false;
      avancos.forEach(t => {
        if (nivel[t.origemId] >= 0 && nivel[t.origemId] + 1 > nivel[t.destinoId] && nivel[t.origemId] + 1 <= elementos.length) {
          nivel[t.destinoId] = nivel[t.origemId] + 1;
          mudou = true;
        }
      });
      if (!mudou) {
        break;
      }
    }
  }
  const maiorNivel = Math.max(0, ...elementos.map(item => nivel[item.id]));
  elementos.forEach(item => { if (nivel[item.id] < 0) { nivel[item.id] = maiorNivel + 1; } });

  const LARGURA_COLUNA = 200;
  const ALTURA_LINHA = 130;
  const MARGEM = 60;
  const porNivel: Record<number, IFluxoElemento[]> = {};
  elementos.forEach(item => { (porNivel[nivel[item.id]] = porNivel[nivel[item.id]] || []).push(item); });

  let alturaMaxima = 0;
  Object.keys(porNivel).forEach(chave => {
    const coluna = Number(chave);
    porNivel[coluna].forEach((item, linha) => {
      if (item.posicao && item.posicao.largura > 0 && (item.posicao.x !== 0 || item.posicao.y !== 0)) {
        alturaMaxima = Math.max(alturaMaxima, item.posicao.y + item.posicao.altura);
        return; // posição informada no JSON
      }
      const tamanho = TAMANHOS[item.tipo] || TAMANHOS.tarefaHumana;
      const centroX = MARGEM + coluna * LARGURA_COLUNA + 70;
      const centroY = MARGEM + linha * ALTURA_LINHA + 40;
      item.posicao = {
        x: Math.round(centroX - tamanho.largura / 2),
        y: Math.round(centroY - tamanho.altura / 2),
        largura: tamanho.largura,
        altura: tamanho.altura
      };
      alturaMaxima = Math.max(alturaMaxima, item.posicao.y + item.posicao.altura);
    });
  });

  // Pontos das ligações (quando não informados).
  const porId: Record<string, IFluxoElemento> = {};
  elementos.forEach(item => { porId[item.id] = item; });
  const faixaRetorno = alturaMaxima + 40;
  transicoes.forEach(t => {
    if (t.pontos && t.pontos.length >= 2) {
      return;
    }
    const a = porId[t.origemId].posicao;
    const b = porId[t.destinoId].posicao;
    const volta = b.x <= a.x;
    t.pontos = volta
      ? [
        { x: a.x + a.largura / 2, y: a.y + a.altura },
        { x: a.x + a.largura / 2, y: faixaRetorno },
        { x: b.x + b.largura / 2, y: faixaRetorno },
        { x: b.x + b.largura / 2, y: b.y + b.altura }
      ]
      : a.y === b.y
        ? [{ x: a.x + a.largura, y: a.y + a.altura / 2 }, { x: b.x, y: b.y + b.altura / 2 }]
        : [
          { x: a.x + a.largura, y: a.y + a.altura / 2 },
          { x: (a.x + a.largura + b.x) / 2, y: a.y + a.altura / 2 },
          { x: (a.x + a.largura + b.x) / 2, y: b.y + b.altura / 2 },
          { x: b.x, y: b.y + b.altura / 2 }
        ];
  });

  return {
    larguraDiagrama: Math.max(400, ...elementos.map(item => item.posicao.x + item.posicao.largura)) + MARGEM,
    alturaDiagrama: faixaRetorno + MARGEM
  };
};

// ------------------------------------------------------------
// Interpretação
// ------------------------------------------------------------

export const interpretarPacote = (
  entrada: string | unknown,
  referencias: IReferenciasPacote
): IResultadoInterpretacao => {

  const erros: string[] = [];
  const avisos: string[] = [];
  const falhar = (mensagem: string): IResultadoInterpretacao => ({ erros: [mensagem], avisos: [], errosPublicacao: [] });

  let bruto: IPacoteProcesso;
  try {
    bruto = (typeof entrada === 'string' ? JSON.parse(entrada) : entrada) as IPacoteProcesso;
  } catch (erro) {
    return falhar(`O texto não é um JSON válido: ${erro instanceof Error ? erro.message : String(erro)}`);
  }

  if (!bruto || typeof bruto !== 'object') {
    return falhar('O JSON precisa ser um objeto.');
  }
  if (bruto.formato !== FORMATO_PACOTE) {
    return falhar(`Informe "formato": "${FORMATO_PACOTE}" no início do JSON.`);
  }

  const areaPorSigla = (sigla?: string): { id: string; nome: string } | undefined => {
    const alvo = texto(sigla).toLowerCase();
    if (!alvo) {
      return undefined;
    }
    return referencias.areas.find(item => texto(item.sigla).toLowerCase() === alvo || texto(item.nome).toLowerCase() === alvo);
  };

  const siglasDisponiveis =
    referencias.areas.length > 0
      ? `Siglas cadastradas: ${referencias.areas.map(item => item.sigla || item.nome).filter(item => !!item).slice(0, 30).join(', ')}.`
      : 'Nenhuma área cadastrada no portal.';

  const temFluxo = !!bruto.fluxo;
  const temProcesso = !!bruto.processo;

  if (!temFluxo && !bruto.ambiente && !temProcesso) {
    return falhar('Informe ao menos "processo" (com ou sem "fluxo") ou "ambiente".');
  }
  if (temFluxo && !temProcesso) {
    erros.push('Pacote com "fluxo" precisa de "processo" (código e nome).');
  }
  if (!temProcesso && (bruto.metadados || []).length > 0) {
    erros.push('"metadados" pertencem a um processo: informe "processo" ou remova os metadados.');
  }

  // ---------------- processo ----------------
  const processoBruto = (bruto.processo || {}) as NonNullable<IPacoteProcesso['processo']>;
  const codigo = texto(processoBruto.codigo).toUpperCase();
  const nomeProcesso = texto(processoBruto.nome);
  if (temProcesso && !/^[A-Z0-9][A-Z0-9._-]{1,29}$/.test(codigo)) {
    erros.push('processo.codigo: use de 2 a 30 caracteres (letras, números, ponto, hífen), ex.: "QUA-AUD".');
  }
  if (temProcesso && nomeProcesso.length < 3) {
    erros.push('processo.nome: informe o nome do processo.');
  }
  let areaProcesso: { id: string; nome: string } | undefined;
  if (temProcesso && processoBruto.area) {
    areaProcesso = areaPorSigla(processoBruto.area);
    if (!areaProcesso) {
      avisos.push(`processo.area: a área "${processoBruto.area}" não foi encontrada — o processo fica sem área. ${siglasDisponiveis}`);
    }
  }

  // ---------------- metadados ----------------
  const metadados: IFluxoMetadado[] = [];
  (bruto.metadados || []).forEach((meta, indice) => {
    const onde = `metadados[${indice}]`;
    const chave = texto(meta && meta.chave);
    if (!/^[a-z][A-Za-z0-9]{0,49}$/.test(chave)) {
      erros.push(`${onde}.chave "${chave}": use camelCase sem acento, começando com letra minúscula (ex.: "valorEstimado").`);
      return;
    }
    if (metadados.some(item => item.chave === chave)) {
      erros.push(`${onde}: a chave "${chave}" está repetida.`);
      return;
    }
    if (TIPOS_CAMPO.indexOf(meta.tipo) < 0) {
      erros.push(`${onde} (${chave}): tipo "${meta.tipo}" inválido. Use: ${TIPOS_CAMPO.join(', ')}.`);
      return;
    }
    if (meta.tipo === 'lista' && (!meta.opcoes || meta.opcoes.length === 0)) {
      erros.push(`${onde} (${chave}): campos do tipo lista precisam de "opcoes".`);
    }
    if (meta.tipo === 'avaliacao') {
      validarConfigAvaliacao(chave, meta.avaliacao).forEach(erro => erros.push(`${onde} (${chave}): ${erro}`));
    }
    if (meta.tipo === 'componente') {
      validarConfigComponente(chave, meta.componente, CHAVES_NATIVOS).forEach(erro => erros.push(`${onde} (${chave}): ${erro}`));
    }
    if (meta.tipo === 'tabela') {
      const colunas = meta.colunas || [];
      if (colunas.length === 0) {
        erros.push(`${onde} (${chave}): campos do tipo tabela precisam de "colunas".`);
      }
      colunas.forEach(coluna => {
        if (!/^[a-z][A-Za-z0-9]{0,49}$/.test(texto(coluna.chave))) {
          erros.push(`${onde} (${chave}): coluna com chave inválida "${coluna.chave}".`);
        }
        if (TIPOS_COLUNA.indexOf(coluna.tipo) < 0) {
          erros.push(`${onde} (${chave}): coluna "${coluna.chave}" com tipo inválido "${coluna.tipo}". Use: ${TIPOS_COLUNA.join(', ')}.`);
        }
        if (coluna.tipo === 'lista' && (!coluna.opcoes || coluna.opcoes.length === 0)) {
          erros.push(`${onde} (${chave}): coluna "${coluna.chave}" do tipo lista precisa de "opcoes".`);
        }
      });
    }
    metadados.push({
      chave,
      rotulo: texto(meta.rotulo) || chave,
      tipo: meta.tipo,
      opcoes: meta.tipo === 'lista' ? meta.opcoes : undefined,
      colunas: meta.tipo === 'tabela' ? (meta.colunas || []).map(coluna => ({ ...coluna, rotulo: coluna.rotulo || coluna.chave })) : undefined,
      avaliacao: meta.tipo === 'avaliacao' ? meta.avaliacao : undefined,
      componente: meta.tipo === 'componente' ? meta.componente : undefined,
      ajuda: texto(meta.ajuda) || undefined
    });
  });

  const metadado = (chave: string): IFluxoMetadado | undefined => metadados.find(item => item.chave === chave);

  // Componentes nativos: parâmetros (ex.: campo da Seleção de kit) só
  // podem ser checados com todos os metadados lidos.
  metadados
    .filter(item => item.tipo === 'componente')
    .forEach(item => validarParametrosNativo(item.chave, item.componente, metadados).forEach(erro => erros.push(`metadados (${item.chave}): ${erro}`)));

  // ---------------- fluxo: elementos ----------------
  const fluxo = (bruto.fluxo || { elementos: [], transicoes: [] }) as NonNullable<IPacoteProcesso['fluxo']>;
  const elementos: IFluxoElemento[] = [];
  const mapaIds: Record<string, string> = {};

  (fluxo.elementos || []).forEach((item, indice) => {
    const onde = `fluxo.elementos[${indice}]`;
    const idOriginal = texto(item && item.id);
    if (!idOriginal) {
      erros.push(`${onde}: informe o "id" (ex.: "registrar").`);
      return;
    }
    const id = idElementoValido(idOriginal);
    if (elementos.some(el => el.id === id)) {
      erros.push(`${onde}: o id "${idOriginal}" está repetido.`);
      return;
    }
    const tipo = item.tipo as TipoElementoFluxo;
    if (TIPOS_ELEMENTO.indexOf(tipo) < 0) {
      erros.push(`${onde} (${idOriginal}): tipo "${item.tipo}" inválido. Use: ${TIPOS_ELEMENTO.join(', ')}.`);
      return;
    }
    mapaIds[idOriginal] = id;

    const elemento: IFluxoElemento = {
      id,
      tipo,
      nome: texto(item.nome) || (tipo === 'inicio' ? 'Início' : tipo === 'fim' ? 'Fim' : id),
      descricao: texto(item.descricao) || undefined,
      instrucoes: texto(item.instrucoes) || undefined,
      subtitulo: texto(item.subtitulo) || undefined,
      responsaveis: [],
      acoes: [],
      campos: [],
      posicao: item.posicao
        ? { x: item.posicao.x, y: item.posicao.y, largura: item.posicao.largura || (TAMANHOS[tipo] || TAMANHOS.tarefaHumana).largura, altura: item.posicao.altura || (TAMANHOS[tipo] || TAMANHOS.tarefaHumana).altura }
        : { x: 0, y: 0, largura: 0, altura: 0 }
    };

    if (tipo === 'tarefaHumana') {
      if (item.prazoDiasUteis !== undefined) {
        const prazo = Number(item.prazoDiasUteis);
        if (!(prazo >= 0 && prazo <= 365)) {
          erros.push(`${onde} (${idOriginal}): prazoDiasUteis deve ser um número de 0 a 365.`);
        } else {
          elemento.prazoDiasUteis = Math.round(prazo);
        }
      }

      // Responsáveis
      (item.responsaveis || []).forEach((resp, r) => {
        const ondeResp = `${onde} (${idOriginal}).responsaveis[${r}]`;
        if (TIPOS_RESPONSAVEL.indexOf(resp.tipo) < 0) {
          erros.push(`${ondeResp}: tipo "${resp.tipo}" inválido. Use: ${TIPOS_RESPONSAVEL.join(', ')}.`);
          return;
        }
        const convertido: IFluxoResponsavel = {
          tipo: resp.tipo as IFluxoResponsavel['tipo'],
          descricao: texto(resp.descricao) || DESCRICAO_RESPONSAVEL[resp.tipo],
          papelTeste: `${resp.tipo}${resp.area ? `:${resp.area}` : ''}${resp.email ? `:${resp.email}` : ''}${resp.campo ? `:${resp.campo}` : ''}`
        };
        if (resp.tipo === 'area' || ((resp.tipo === 'cargoArea' || resp.tipo === 'nivelHierarquico') && resp.area)) {
          const area = areaPorSigla(resp.area);
          if (!area) {
            erros.push(`${ondeResp}: área "${resp.area || ''}" não encontrada. ${siglasDisponiveis}`);
            return;
          }
          convertido.referenciaId = area.id;
          convertido.referenciaNome = area.nome;
          convertido.descricao = texto(resp.descricao) || `${DESCRICAO_RESPONSAVEL[resp.tipo]}: ${area.nome}`;
        }
        if (resp.tipo === 'area') {
          convertido.somenteGestores = !!resp.somenteGestores;
        }
        if (resp.tipo === 'cargoArea') {
          convertido.cargo = texto(resp.cargo) || 'Diretor';
          convertido.origemArea = resp.origemArea;
        }
        if (resp.tipo === 'nivelHierarquico') {
          convertido.nivel = resp.nivel !== undefined ? Number(resp.nivel) : 1;
          convertido.origemArea = resp.origemArea;
        }
        if (resp.tipo === 'usuario') {
          const alvo = texto(resp.email).toLowerCase();
          const usuario = referencias.usuarios.find(u => texto(u.email).toLowerCase() === alvo);
          if (!usuario) {
            erros.push(`${ondeResp}: usuário "${resp.email || ''}" não encontrado (use o e-mail cadastrado no portal).`);
            return;
          }
          convertido.referenciaId = usuario.id;
          convertido.referenciaNome = usuario.nome;
          convertido.descricao = texto(resp.descricao) || usuario.nome;
        }
        if (resp.tipo === 'campoUsuario') {
          const campo = metadado(texto(resp.campo));
          if (!campo || campo.tipo !== 'usuario') {
            erros.push(`${ondeResp}: "campo" deve ser a chave de um metadado do tipo usuario.`);
            return;
          }
          convertido.referenciaId = campo.chave;
          convertido.referenciaNome = campo.rotulo;
          convertido.descricao = texto(resp.descricao) || `Usuário do campo "${campo.rotulo}"`;
        }
        elemento.responsaveis.push(convertido);
      });
      if (elemento.responsaveis.length === 0) {
        avisos.push(`Etapa "${elemento.nome}" sem responsáveis: ninguém poderá concluí-la até ajustar no editor.`);
      }

      // Ações
      const acoes = (item.acoes && item.acoes.length > 0) ? item.acoes : [ACAO_PADRAO];
      acoes.forEach((acao, a) => {
        const chaveAcao = texto(acao.chave);
        if (!/^[a-z][A-Za-z0-9]{0,39}$/.test(chaveAcao) || !texto(acao.rotulo) || !texto(acao.resultado)) {
          erros.push(`${onde} (${idOriginal}).acoes[${a}]: informe "chave" (camelCase), "rotulo" e "resultado".`);
          return;
        }
        elemento.acoes.push({
          chave: chaveAcao,
          rotulo: texto(acao.rotulo),
          resultado: texto(acao.resultado),
          principal: acao.principal !== undefined ? !!acao.principal : a === 0,
          exigeComentario: !!acao.exigeComentario,
          dispensaCampos: acao.dispensaCampos ? true : undefined,
          mensagemConfirmacao: texto(acao.mensagemConfirmacao) || undefined
        });
      });

      // Campos da etapa (pelo metadado)
      (item.campos || []).forEach((campo, c) => {
        const chave = texto(campo.chave);
        const meta = metadado(chave);
        const tipoCampo = (campo.tipo || (meta && meta.tipo)) as TipoCampoFluxo;
        if (!meta) {
          erros.push(`${onde} (${idOriginal}).campos[${c}]: o campo "${chave}" não está em "metadados". Declare-o lá primeiro.`);
          return;
        }
        const convertido: IFluxoCampo = {
          chave,
          rotulo: texto(campo.rotulo) || meta.rotulo,
          tipo: tipoCampo,
          obrigatorio: !!campo.obrigatorio,
          somenteLeitura: campo.somenteLeitura ? true : undefined,
          opcoes: campo.opcoes || meta.opcoes,
          colunas: campo.colunas || meta.colunas,
          avaliacao: meta.avaliacao,
          componente: meta.componente,
          ajuda: texto(campo.ajuda) || meta.ajuda,
          mostrarQuando: campo.mostrarQuando,
          obrigatorioQuando: campo.obrigatorioQuando,
          validarNosResultados: campo.validarNosResultados
        };
        elemento.campos.push(convertido);
      });

      if (item.statusDocumento) {
        if (STATUS_DOCUMENTO.indexOf(item.statusDocumento as StatusDocumentoEtapa) < 0) {
          erros.push(`${onde} (${idOriginal}): statusDocumento deve ser ${STATUS_DOCUMENTO.join(', ')}.`);
        } else {
          elemento.statusDocumento = item.statusDocumento as StatusDocumentoEtapa;
        }
      }
      if (item.anexoArquivo) {
        if (ANEXO.indexOf(item.anexoArquivo as AnexoArquivoEtapa) < 0) {
          erros.push(`${onde} (${idOriginal}): anexoArquivo deve ser ${ANEXO.join(', ')}.`);
        } else {
          elemento.anexoArquivo = item.anexoArquivo as AnexoArquivoEtapa;
        }
      }
      if (item.permiteEditarDocumento !== undefined) {
        elemento.permiteEditarDocumento = !!item.permiteEditarDocumento;
      }
    }

    if (tipo === 'tarefaSistema') {
      if (ACOES_SISTEMA.indexOf(item.acaoSistema as AcaoSistemaFluxo) < 0) {
        erros.push(`${onde} (${idOriginal}): acaoSistema deve ser ${ACOES_SISTEMA.join(', ')}.`);
      } else {
        elemento.acaoSistema = item.acaoSistema as AcaoSistemaFluxo;
      }
    }

    if (tipo === 'eventoRevisao') {
      elemento.tipoRevisao = (texto(item.tipoRevisao) || 'revisao') as TipoEventoRevisao;
      elemento.removerArquivo = item.removerArquivo ? true : undefined;
    }

    if (tipo === 'subprocesso') {
      const sub = item.subprocesso || {};
      const alvo = texto(sub.fluxo).toUpperCase();
      const destino = referencias.processos.find(p => texto(p.codigo).toUpperCase() === alvo);
      if (!destino) {
        erros.push(`${onde} (${idOriginal}): subprocesso.fluxo "${sub.fluxo || ''}" — informe o CÓDIGO de um processo que já existe no portal (importe-o antes).`);
      }
      let areaSub: { id: string; nome: string } | undefined;
      if (sub.area) {
        areaSub = areaPorSigla(sub.area);
        if (!areaSub) {
          erros.push(`${onde} (${idOriginal}): subprocesso.area "${sub.area}" não encontrada. ${siglasDisponiveis}`);
        }
      }
      elemento.subprocesso = {
        fluxoId: destino ? destino.id : '',
        fluxoNome: destino ? `${destino.codigo} — ${destino.nome}` : undefined,
        origem: sub.origem === 'unico' ? 'unico' : 'tabela',
        campoTabela: sub.campoTabela,
        campoReferencias: texto(sub.campoReferencias),
        tipoDocumento: texto(sub.tipoDocumento) || 'PDA',
        areaId: areaSub ? areaSub.id : undefined,
        areaNome: areaSub ? areaSub.nome : undefined,
        titulo: texto(sub.titulo) || '{pai.codigo} — {n}',
        autor: texto(sub.autor) || 'executor',
        mapeamentos: sub.mapeamentos || [],
        aguardar: sub.aguardar === 'todos' ? 'todos' : 'nao',
        filtroLinhas: sub.filtroLinhas
      };
    }

    elementos.push(elemento);
  });

  if (temFluxo && !elementos.some(item => item.tipo === 'inicio')) {
    erros.push('fluxo.elementos: inclua um elemento { "tipo": "inicio" }.');
  }
  if (temFluxo && !elementos.some(item => item.tipo === 'fim')) {
    erros.push('fluxo.elementos: inclua ao menos um elemento { "tipo": "fim" }.');
  }

  // ---------------- fluxo: transições ----------------
  const transicoes: IFluxoTransicao[] = [];
  (fluxo.transicoes || []).forEach((item, indice) => {
    const onde = `fluxo.transicoes[${indice}]`;
    const origemId = mapaIds[texto(item && item.de)];
    const destinoId = mapaIds[texto(item && item.para)];
    if (!origemId || !destinoId) {
      erros.push(`${onde}: "de" e "para" devem ser ids de elementos (${texto(item && item.de)} → ${texto(item && item.para)}).`);
      return;
    }
    const quando = item.quando || {};
    const transicao: IFluxoTransicao = {
      id: `fluxo_${indice + 1}`,
      origemId,
      destinoId,
      rotulo: texto(item.rotulo) || undefined,
      tipoCondicao: quando.resultado ? 'resultado' : quando.campo ? 'campo' : 'sempre',
      resultado: texto(quando.resultado) || undefined,
      campo: texto(quando.campo) || undefined,
      valorEsperado: quando.campo ? texto(quando.valor) : undefined,
      padrao: !!item.padrao,
      excecao: !!item.excecao,
      pontos: item.pontos || []
    };
    if (transicao.tipoCondicao === 'campo' && !metadado(transicao.campo as string)) {
      erros.push(`${onde}: quando.campo "${transicao.campo}" não está em "metadados".`);
    }
    transicoes.push(transicao);
  });

  if (erros.length > 0) {
    return { erros, avisos, errosPublicacao: [] };
  }

  let definicao: IFluxoDefinicao | undefined;

  if (temFluxo) {
    const tamanho = calcularLayout(elementos, transicoes);
    definicao = {
      id: 'importado',
      nome: `${codigo} — ${nomeProcesso}`,
      versao: 1,
      status: 'rascunho',
      tiposDocumento: [],
      larguraDiagrama: tamanho.larguraDiagrama,
      alturaDiagrama: tamanho.alturaDiagrama,
      elementos,
      transicoes,
      metadados
    };
  }

  // Armadilha comum (inclusive em JSON gerado por IA): botão na ligação
  // etapa → decisão. Corrige para "Qualquer botão" e avisa.
  if (definicao) {
    const correcao = corrigirLigacoesParaDecisao(definicao);
    if (correcao.corrigidas.length > 0) {
      definicao = correcao.definicao;
      correcao.corrigidas.forEach(item => avisos.push(
        `Ligação "${item.etapaNome} → ${item.decisaoNome}" ajustada para "Qualquer botão": com o botão "${item.botaoPermitido}" nela, ` +
        `"${item.botoesBarrados.join('", "')}" não chegaria à decisão.`
      ));
    }
  }

  const errosPublicacao = definicao ? validarDefinicao(definicao) : [];

  // Ids das etapas nas telas: os do fluxo do pacote ou, sem fluxo, os
  // informados (validados quando o ambiente abrir com o fluxo real).
  const idEtapa = (id: string): string | undefined =>
    temFluxo ? mapaIds[texto(id)] : (texto(id) ? idElementoValido(id) : undefined);

  // ---------------- ambiente ----------------
  let ambiente: IAmbienteDoPacote | undefined;
  if (bruto.ambiente) {
    const amb = bruto.ambiente;
    const nome = texto(amb.nome);
    if (nome.length < 3) {
      erros.push('ambiente.nome: informe o nome do ambiente (mínimo 3 letras).');
    }
    const icone = ICONES.indexOf(texto(amb.icone)) >= 0 ? texto(amb.icone) as IconeChave : 'workflow';
    if (amb.icone && icone !== amb.icone) {
      avisos.push(`ambiente.icone "${amb.icone}" não existe — usado "workflow". Opções: ${ICONES.join(', ')}.`);
    }
    let processoExistente: { id: string; codigo: string; nome: string } | undefined;
    if (amb.fluxo) {
      if (temFluxo) {
        avisos.push('ambiente.fluxo foi ignorado: o ambiente usa o fluxo deste pacote.');
      } else {
        processoExistente = referencias.processos.find(p => texto(p.codigo).toUpperCase() === texto(amb.fluxo).toUpperCase());
        if (!processoExistente) {
          erros.push(`ambiente.fluxo "${amb.fluxo}": nenhum processo com esse código no portal. Códigos: ${referencias.processos.map(p => p.codigo).slice(0, 30).join(', ') || '(nenhum)'}.`);
        }
      }
    }

    let layout: IAmbienteLayout | undefined;
    if (amb.telas) {
      const telas = amb.telas;
      const base = layoutPadrao(definicao);
      const etapas: IEtapaLayout[] | undefined = telas.etapas
        ? telas.etapas
          .filter(item => !!idEtapa(item.id))
          .map(item => ({ elementoId: idEtapa(item.id) as string, rotulo: texto(item.rotulo), visivel: item.visivel !== false }))
        : undefined;
      (telas.etapas || []).filter(item => !idEtapa(item.id)).forEach(item => avisos.push(`ambiente.telas.etapas: "${item.id}" não é um elemento do fluxo — ignorado.`));
      const visoes: IVisaoAmbiente[] | undefined = telas.visoes
        ? telas.visoes.map((visao, v) => {
          const filtro = { ...visao.filtro } as IVisaoAmbiente['filtro'];
          if (filtro.tipo === 'etapas') {
            filtro.etapas = (filtro.etapas || []).map(id => idEtapa(id) || id);
          }
          return {
            id: texto(visao.id) || `vis-${v + 1}`,
            nome: texto(visao.nome) || `Visão ${v + 1}`,
            icone: (ICONES.indexOf(texto(visao.icone)) >= 0 ? visao.icone : 'grid') as IconeChave,
            cor: /^#[0-9a-f]{6}$/i.test(texto(visao.cor)) ? texto(visao.cor) : '#0F6CBD',
            filtro
          };
        })
        : undefined;
      layout = normalizarLayout({
        versao: 1,
        visoes: visoes || base.visoes,
        colunas: telas.colunas || base.colunas,
        etapas: etapas || base.etapas,
        registro: { ...base.registro, ...(telas.registro || {}) },
        lista: { ...base.lista, ...(telas.lista || {}) }
      }, definicao);
    }
    ambiente = {
      nome,
      chave: texto(amb.chave),
      descricao: texto(amb.descricao),
      subtitulo: texto(amb.subtitulo),
      icone,
      ordem: Number(amb.ordem || 0),
      prefixoCodigo: texto(amb.prefixoCodigo).toUpperCase(),
      rotuloRegistro: texto(amb.rotuloRegistro) || 'Registro',
      liberadoParaTodos: !!amb.liberadoParaTodos,
      perfisPadrao: (amb.perfisPadrao || []).filter(item => ['Funcionario', 'Editor', 'Gestor'].indexOf(item) >= 0),
      layout,
      processoExistenteId: processoExistente ? processoExistente.id : undefined,
      processoExistenteNome: processoExistente ? `${processoExistente.codigo} — ${processoExistente.nome}` : undefined
    };
  }

  return {
    erros,
    avisos,
    errosPublicacao,
    pacote: erros.length > 0 ? undefined : {
      processo: temProcesso
        ? { codigo, nome: nomeProcesso, descricao: texto(processoBruto.descricao), areaId: areaProcesso ? areaProcesso.id : undefined, areaNome: areaProcesso ? areaProcesso.nome : undefined }
        : undefined,
      metadados,
      definicao,
      ambiente
    }
  };
};

// ------------------------------------------------------------
// Editor do fluxo: aplicar o JSON no processo ABERTO
// ------------------------------------------------------------

// Troca o "processo" do JSON pelo processo aberto (código e nome). Se o
// JSON for de outro código, devolve um aviso. Texto inválido volta como
// está (o interpretador mostra o erro de JSON).
export const aplicarNoProcesso = (
  texto: string,
  processo: { codigo: string; nome: string }
): { entrada: unknown; aviso: string } => {
  try {
    const objeto = JSON.parse(texto) as { processo?: { codigo?: string } };
    if (!objeto || typeof objeto !== 'object') {
      return { entrada: texto, aviso: '' };
    }
    const original = objeto.processo && objeto.processo.codigo ? String(objeto.processo.codigo) : '';
    return {
      entrada: { ...objeto, processo: { ...(objeto.processo || {}), codigo: processo.codigo, nome: processo.nome } },
      aviso: original && original.toUpperCase() !== processo.codigo.toUpperCase()
        ? `O JSON é do processo ${original}; ele será aplicado em ${processo.codigo}.`
        : ''
    };
  } catch {
    return { entrada: texto, aviso: '' };
  }
};

// ------------------------------------------------------------
// Exportação (o mesmo formato, com referências amigáveis)
// ------------------------------------------------------------

export interface IDadosExportacao {
  processo: { codigo: string; nome: string; descricao?: string; areaId?: string };
  metadados: IFluxoMetadado[];
  definicao?: IFluxoDefinicao;
  ambiente?: Omit<IPacoteAmbiente, 'telas'>;
  layout?: IAmbienteLayout;
}

export const exportarPacote = (
  dados: IDadosExportacao,
  referencias: IReferenciasPacote
): IPacoteProcesso => {

  const siglaArea = (id?: string): string | undefined => {
    const area = referencias.areas.find(item => guid(item.id) === guid(id));
    return area ? (area.sigla || area.nome) : undefined;
  };
  const emailUsuario = (id?: string): string | undefined => {
    const usuario = referencias.usuarios.find(item => guid(item.id) === guid(id));
    return usuario ? usuario.email : undefined;
  };
  const codigoProcesso = (id?: string): string | undefined => {
    const processo = referencias.processos.find(item => guid(item.id) === guid(id));
    return processo ? processo.codigo : undefined;
  };

  const definicao = dados.definicao;

  const elementos: IPacoteElemento[] = definicao
    ? definicao.elementos.map(el => {
      const saida: IPacoteElemento = { id: el.id, tipo: el.tipo, nome: el.nome };
      if (el.descricao) { saida.descricao = el.descricao; }
      if (el.instrucoes) { saida.instrucoes = el.instrucoes; }
      if (el.subtitulo) { saida.subtitulo = el.subtitulo; }
      if (el.tipo === 'tarefaHumana') {
        if (el.prazoDiasUteis !== undefined) { saida.prazoDiasUteis = el.prazoDiasUteis; }
        saida.responsaveis = el.responsaveis.map(r => {
          const resp: IPacoteResponsavel = { tipo: r.tipo, descricao: r.descricao };
          if (r.tipo === 'area' || ((r.tipo === 'cargoArea' || r.tipo === 'nivelHierarquico') && r.referenciaId)) { resp.area = siglaArea(r.referenciaId); }
          if (r.tipo === 'area' && r.somenteGestores) { resp.somenteGestores = true; }
          if (r.tipo === 'usuario') { resp.email = emailUsuario(r.referenciaId); }
          if (r.tipo === 'campoUsuario') { resp.campo = r.referenciaId; }
          if (r.cargo) { resp.cargo = r.cargo; }
          if (r.nivel !== undefined) { resp.nivel = r.nivel; }
          if (r.origemArea) { resp.origemArea = r.origemArea; }
          return resp;
        });
        saida.acoes = el.acoes.map(a => ({ ...a }));
        saida.campos = el.campos.map(c => {
          const campo: IPacoteCampoEtapa = { chave: c.chave, obrigatorio: c.obrigatorio };
          const meta = dados.metadados.find(m => m.chave === c.chave);
          if (!meta || meta.rotulo !== c.rotulo) { campo.rotulo = c.rotulo; }
          if (c.somenteLeitura) { campo.somenteLeitura = true; }
          if (c.mostrarQuando) { campo.mostrarQuando = c.mostrarQuando; }
          if (c.obrigatorioQuando) { campo.obrigatorioQuando = c.obrigatorioQuando; }
          if (c.validarNosResultados) { campo.validarNosResultados = c.validarNosResultados; }
          if (c.ajuda && (!meta || meta.ajuda !== c.ajuda)) { campo.ajuda = c.ajuda; }
          return campo;
        });
        if (el.statusDocumento) { saida.statusDocumento = el.statusDocumento; }
        if (el.anexoArquivo) { saida.anexoArquivo = el.anexoArquivo; }
        if (el.permiteEditarDocumento !== undefined) { saida.permiteEditarDocumento = el.permiteEditarDocumento; }
      }
      if (el.tipo === 'tarefaSistema' && el.acaoSistema) { saida.acaoSistema = el.acaoSistema; }
      if (el.tipo === 'eventoRevisao') {
        saida.tipoRevisao = el.tipoRevisao;
        if (el.removerArquivo) { saida.removerArquivo = true; }
      }
      if (el.tipo === 'subprocesso' && el.subprocesso) {
        const sub = el.subprocesso;
        saida.subprocesso = {
          fluxo: codigoProcesso(sub.fluxoId),
          area: siglaArea(sub.areaId),
          origem: sub.origem,
          campoTabela: sub.campoTabela,
          campoReferencias: sub.campoReferencias,
          tipoDocumento: sub.tipoDocumento,
          titulo: sub.titulo,
          autor: sub.autor,
          mapeamentos: sub.mapeamentos,
          aguardar: sub.aguardar,
          filtroLinhas: sub.filtroLinhas
        };
      }
      saida.posicao = { x: el.posicao.x, y: el.posicao.y, largura: el.posicao.largura, altura: el.posicao.altura };
      return saida;
    })
    : [];

  const transicoes: IPacoteTransicao[] = definicao
    ? definicao.transicoes.map(t => {
      const saida: IPacoteTransicao = { de: t.origemId, para: t.destinoId };
      if (t.rotulo) { saida.rotulo = t.rotulo; }
      if (t.tipoCondicao === 'resultado') { saida.quando = { resultado: t.resultado }; }
      if (t.tipoCondicao === 'campo') { saida.quando = { campo: t.campo, valor: t.valorEsperado }; }
      if (t.padrao) { saida.padrao = true; }
      if (t.excecao) { saida.excecao = true; }
      if (t.pontos && t.pontos.length > 0) { saida.pontos = t.pontos; }
      return saida;
    })
    : [];

  const pacote: IPacoteProcesso = {
    formato: FORMATO_PACOTE,
    processo: {
      codigo: dados.processo.codigo,
      nome: dados.processo.nome,
      descricao: dados.processo.descricao || undefined,
      area: siglaArea(dados.processo.areaId)
    },
    metadados: dados.metadados.map(({ id, ...resto }) => resto),
    fluxo: { elementos, transicoes }
  };

  if (dados.ambiente) {
    pacote.ambiente = { ...dados.ambiente };
    if (dados.layout) {
      pacote.ambiente.telas = {
        visoes: dados.layout.visoes.map(v => ({ ...v })),
        colunas: dados.layout.colunas,
        etapas: dados.layout.etapas.map(e => ({ id: e.elementoId, rotulo: e.rotulo || undefined, visivel: e.visivel })),
        registro: dados.layout.registro,
        lista: dados.layout.lista
      };
    }
  }

  return pacote;
};
