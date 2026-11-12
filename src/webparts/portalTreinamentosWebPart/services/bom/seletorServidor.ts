import {
  FICHAS_SOFTWARE,
  FinalidadeServidor,
  IAlertaServidor,
  ILinhaServidor,
  INFO_SOFTWARE,
  IPremissaServidor,
  LINHAS_SERVIDOR,
  NivelAlertaServidor,
  NOME_FINALIDADE,
  SoftwareServidor,
  fichaSoftware,
  nomeLinha,
  pendenciasLinha
} from './catalogoServidores';

// ============================================================
// SELEÇÃO DE SERVIDOR — REGRAS (puro: sem tela e sem Dataverse)
//
// O sistema resolve sozinho: finalidade, local (nuvem/on-premise),
// software, câmeras, faixa recomendada e o que tiver uma opção só.
// O arquiteto decide: premissas, compressão, distribuição (A/B/C),
// GPU, processador e SO quando há alternativas.
//
// Ordem das respostas (alterar uma apaga as seguintes):
//   premissas → compressão → câmeras (reserva, LPR, porteiros,
//   ajuste manual) → faixa → opção → GPU → processador → SO
//
// Hardware pela FAIXA (o que o fornecedor dimensionou); licença base
// do Digifort 1 por SERVIDOR; packs pela NECESSIDADE (pendência S3:
// o modo "tabela da faixa" também existe, por linha do memorial).
// ============================================================

export type ModoLicencaServidor = 'necessidade' | 'faixa';

export interface ISelecaoServidor {
  // Software com que as respostas foram dadas: se o VMS do projeto
  // mudar, as respostas deixam de valer (recomeça).
  software?: SoftwareServidor;
  premissas: Record<string, boolean>;
  compressao?: 'H.264' | 'H.265';
  reservaPct: number;
  incluirLpr: boolean;
  incluirPorteiros: boolean;
  ajusteManual?: number;
  camerasConfirmadas: boolean;
  capacidade?: number;
  chaveLinha?: string;
  gpu?: string;
  processador?: string;
  so?: string;
  modoLicenca: ModoLicencaServidor;
  // "Adicionar à central": os itens só entram no B.O.M. depois disso.
  concluido: boolean;
  necessidadeNaConclusao?: number;
}

export type PassoServidor =
  | 'premissas'
  | 'compressao'
  | 'cameras'
  | 'faixa'
  | 'opcao'
  | 'gpu'
  | 'processador'
  | 'so';

export const ORDEM_PASSOS: PassoServidor[] = ['premissas', 'compressao', 'cameras', 'faixa', 'opcao', 'gpu', 'processador', 'so'];

export const RESERVAS = [0, 10, 20, 30];

export const selecaoServidorVazia = (software?: SoftwareServidor): ISelecaoServidor => ({
  software,
  premissas: {},
  reservaPct: 10,
  // Padrão documentado: LPR entra na gravação (pendência S1).
  incluirLpr: true,
  // Porteiro fora da base, como documentado (pendência S2).
  incluirPorteiros: false,
  camerasConfirmadas: false,
  modoLicenca: 'necessidade',
  concluido: false
});

// Apaga a resposta do passo e todas as seguintes.
export const limparAPartirDe = (estado: ISelecaoServidor, passo: PassoServidor): ISelecaoServidor => {
  const i = ORDEM_PASSOS.indexOf(passo);
  const novo: ISelecaoServidor = { ...estado, concluido: false, necessidadeNaConclusao: undefined };
  const apaga = (p: PassoServidor): boolean => ORDEM_PASSOS.indexOf(p) >= i;
  if (apaga('premissas')) { novo.premissas = {}; }
  if (apaga('compressao')) { novo.compressao = undefined; }
  if (apaga('cameras')) {
    const vazio = selecaoServidorVazia();
    novo.reservaPct = vazio.reservaPct;
    novo.incluirLpr = vazio.incluirLpr;
    novo.incluirPorteiros = vazio.incluirPorteiros;
    novo.ajusteManual = undefined;
    novo.camerasConfirmadas = false;
  }
  if (apaga('faixa')) { novo.capacidade = undefined; }
  if (apaga('opcao')) { novo.chaveLinha = undefined; }
  if (apaga('gpu')) { novo.gpu = undefined; }
  if (apaga('processador')) { novo.processador = undefined; }
  if (apaga('so')) { novo.so = undefined; }
  return novo;
};

// Responde um passo: grava o que mudou e apaga o que vem depois.
export const responder = (
  estado: ISelecaoServidor,
  passo: PassoServidor,
  parcial: Partial<ISelecaoServidor>
): ISelecaoServidor => {
  const i = ORDEM_PASSOS.indexOf(passo);
  const seguinte = ORDEM_PASSOS[i + 1];
  const base = seguinte ? limparAPartirDe(estado, seguinte) : { ...estado, concluido: false, necessidadeNaConclusao: undefined };
  return { ...base, ...parcial, concluido: false, necessidadeNaConclusao: undefined };
};

// ------------------------------------------------------------
// Entradas vindas do projeto
// ------------------------------------------------------------

export interface IContagemCameras {
  video: number;
  lpr: number;
  porteiros: number;
  // Câmeras de vídeo acima de um limite de resolução: modelo × MP.
  modelosVideo: Array<{ modelo: string; mp?: number; quantidade: number }>;
}

export interface IEntradaServidor {
  finalidade: FinalidadeServidor;
  vms: string;
  ipx: boolean;
  estado?: ISelecaoServidor;
  contagem: IContagemCameras;
}

// Software do projeto para a finalidade: a licença de VMS presente
// (gravação) ou o IPX (analítico). 'nuvem' = Safe City, sem servidor.
export const softwareDaFinalidade = (finalidade: FinalidadeServidor, vms: string, ipx: boolean): SoftwareServidor | 'nuvem' | undefined => {
  if (finalidade === 'analitico') {
    return ipx ? 'ipx' : undefined;
  }
  if (vms === 'safeCity') {
    return 'nuvem';
  }
  return vms === 'digifort' || vms === 'milestone' ? vms : undefined;
};

// ------------------------------------------------------------
// Avaliação
// ------------------------------------------------------------

export type EstadoPasso = 'bloqueado' | 'aberto' | 'respondido' | 'automatico' | 'naoSeAplica';

export interface IPassoAvaliado {
  id: PassoServidor;
  titulo: string;
  estado: EstadoPasso;
  valor?: string;
}

export interface IPremissaAvaliada extends IPremissaServidor {
  atendida?: boolean;
  automatica: boolean;
  detalhe?: string;
}

export interface IFaixaAvaliada {
  capacidade: number;
  habilitada: boolean;
  recomendada: boolean;
  folga: number;
  // Linhas ativas e completas na faixa (as incompletas não contam).
  opcoes: number;
  incompletas: number;
}

export interface IAlertaAvaliado {
  nivel: NivelAlertaServidor;
  texto: string;
}

export interface IItemServidor {
  codigo: string;
  descricao: string;
  categoria: 'Equipamento' | 'Licença';
  quantidade: number;
  // Chave do catálogo de itens (licenças Digifort/Milestone); vazia
  // para servidor, disco e SO (código vem da linha do memorial).
  chaveItem?: string;
}

export type StatusServidor =
  | 'naoSeAplica'
  | 'nuvem'
  | 'semCameras'
  | 'emAndamento'
  | 'pendente'
  | 'pronto'
  | 'concluido'
  | 'revisar';

export interface IAvaliacaoServidor {
  finalidade: FinalidadeServidor;
  software?: SoftwareServidor;
  status: StatusServidor;
  mensagem: string;
  estado: ISelecaoServidor;
  contagem: IContagemCameras;
  base: number;
  necessidade: number;
  passos: IPassoAvaliado[];
  premissas: IPremissaAvaliada[];
  compressoes: Array<'H.264' | 'H.265'>;
  faixas: IFaixaAvaliada[];
  faixaRecomendada?: number;
  capacidade?: number;
  linhasDaFaixa: ILinhaServidor[];
  linha?: ILinhaServidor;
  gpu?: string;
  processador?: string;
  so?: string;
  armazenamentoTotalTb: number;
  armazenamentoServidorTb: number;
  alertas: IAlertaAvaliado[];
  itens: IItemServidor[];
  rastreabilidade: string;
}

const linhasAtivas = (software: SoftwareServidor): ILinhaServidor[] =>
  LINHAS_SERVIDOR.filter(l => l.software === software && l.ativo);

export const linhaCompleta = (linha: ILinhaServidor): boolean => pendenciasLinha(linha).length === 0;

export const necessidadeDe = (base: number, reservaPct: number): number =>
  Math.ceil(base * (1 + (Number(reservaPct) || 0) / 100) - 1e-9);

export const baseDe = (finalidade: FinalidadeServidor, contagem: IContagemCameras, estado: ISelecaoServidor): number =>
  finalidade === 'analitico'
    ? contagem.video
    : contagem.video + (estado.incluirLpr ? contagem.lpr : 0) + (estado.incluirPorteiros ? contagem.porteiros : 0);

// No Digifort com H.265, o armazenamento do memorial cai à metade.
export const fatorArmazenamento = (software: SoftwareServidor, compressao?: string): number =>
  software === 'digifort' && compressao === 'H.265' ? 0.5 : 1;

const formatar = (n: number): string =>
  (Math.round(n * 100) / 100).toLocaleString('pt-BR');

// Licenças do Digifort: base de 8 câmeras por servidor + o menor pack
// que cobre o que falta em cada servidor.
export const PACKS_DGFEN: Array<{ cameras: number; codigo: string }> = [
  { cameras: 64, codigo: 'DGFEN1164V7' },
  { cameras: 32, codigo: 'DGFEN1132V7' },
  { cameras: 16, codigo: 'DGFEN1116V7' },
  { cameras: 8, codigo: 'DGFEN1108V7' },
  { cameras: 4, codigo: 'DGFEN1104V7' },
  { cameras: 2, codigo: 'DGFEN1102V7' }
];

export const CODIGO_BASE_DGFEN = 'DGFEN1008V7';

export const licencasDigifortPorNecessidade = (cameras: number, servidores: number): Array<{ codigo: string; qtd: number }> => {
  const s = Math.max(1, Math.floor(servidores) || 1);
  const contagem: Record<string, number> = {};
  for (let i = 0; i < s; i++) {
    const doServidor = Math.floor(cameras / s) + (i < cameras % s ? 1 : 0);
    let faltam = Math.max(0, doServidor - 8);
    while (faltam > 0) {
      const cobrem = PACKS_DGFEN.filter(p => p.cameras >= faltam);
      const pack = cobrem.length > 0 ? cobrem[cobrem.length - 1] : PACKS_DGFEN[0];
      contagem[pack.codigo] = (contagem[pack.codigo] || 0) + 1;
      faltam -= pack.cameras;
    }
  }
  return [
    { codigo: CODIGO_BASE_DGFEN, qtd: s },
    ...PACKS_DGFEN.filter(p => contagem[p.codigo]).map(p => ({ codigo: p.codigo, qtd: contagem[p.codigo] }))
  ];
};

const escolhaDe = (alternativas: string[], escolhida?: string): { valor?: string; automatico: boolean } => {
  if (alternativas.length === 0) {
    return { valor: undefined, automatico: true };
  }
  if (alternativas.length === 1) {
    return { valor: alternativas[0], automatico: true };
  }
  return { valor: escolhida && alternativas.indexOf(escolhida) >= 0 ? escolhida : undefined, automatico: false };
};

const aplicaAlerta = (a: IAlertaServidor, ctx: { processador?: string; gpu?: string; so?: string; compressao?: string }): boolean => {
  if (a.compressao && a.compressao !== ctx.compressao) {
    return false;
  }
  if (a.campo && a.contem) {
    const valor = (ctx[a.campo] || '').toLowerCase();
    return valor.indexOf(a.contem.toLowerCase()) >= 0;
  }
  return true;
};

const preencher = (texto: string, linha?: ILinhaServidor, ctx?: { processador?: string; gpu?: string; so?: string }): string =>
  texto
    .replace(/\{iops\}/g, (linha && linha.iops) || '—')
    .replace(/\{rede\}/g, (linha && linha.redeMbps) || '—')
    .replace(/\{processador\}/g, (ctx && ctx.processador) || '—')
    .replace(/\{gpu\}/g, (ctx && ctx.gpu) || '—')
    .replace(/\{so\}/g, (ctx && ctx.so) || '—');

export const avaliarServidor = (entrada: IEntradaServidor): IAvaliacaoServidor => {

  const { finalidade, contagem } = entrada;
  const software = softwareDaFinalidade(finalidade, entrada.vms, entrada.ipx);
  const vazia = (status: StatusServidor, mensagem: string, sw?: SoftwareServidor): IAvaliacaoServidor => ({
    finalidade, software: sw, status, mensagem, estado: entrada.estado || selecaoServidorVazia(sw), contagem,
    base: 0, necessidade: 0, passos: [], premissas: [], compressoes: [], faixas: [], linhasDaFaixa: [],
    armazenamentoTotalTb: 0, armazenamentoServidorTb: 0, alertas: [], itens: [], rastreabilidade: ''
  });

  if (software === undefined) {
    return vazia('naoSeAplica', finalidade === 'analitico' ? 'Sem analítico no projeto.' : 'O VMS do projeto não tem memorial de servidor.');
  }
  if (software === 'nuvem') {
    return vazia('nuvem', 'Gravação em nuvem (Safe City): o projeto não leva servidor de gravação.');
  }

  // Respostas dadas com outro software não valem.
  const estado: ISelecaoServidor = entrada.estado && entrada.estado.software === software
    ? { ...selecaoServidorVazia(software), ...entrada.estado }
    : selecaoServidorVazia(software);

  const info = INFO_SOFTWARE[software];
  const ficha = fichaSoftware(software);
  const geral = fichaSoftware('geral');
  const alertas: IAlertaAvaliado[] = [];

  const baseBruta = baseDe(finalidade, contagem, estado);
  if (baseBruta === 0 && !(estado.ajusteManual && estado.ajusteManual > 0)) {
    return { ...vazia('semCameras', finalidade === 'analitico' ? 'Sem câmeras de vídeo nos pontos: nada para o analítico processar.' : 'Sem câmeras nos pontos ainda.', software), estado };
  }

  // ---- premissas
  const premissas: IPremissaAvaliada[] = (ficha ? ficha.premissas : []).map(p => {
    if (p.verificacao === 'resolucao') {
      const limite = p.limiteMp || 4;
      const acima = contagem.modelosVideo.filter(m => (m.mp || 0) > limite);
      const semDado = contagem.modelosVideo.filter(m => !m.mp);
      return {
        ...p,
        automatica: true,
        atendida: acima.length === 0,
        detalhe: acima.length > 0
          ? `Acima de ${limite} MP nos pontos: ${acima.map(m => `${m.modelo} (${String(m.mp).replace('.', ',')} MP)`).join(', ')}.`
          : semDado.length > 0
            ? `Sem resolução cadastrada: ${semDado.map(m => m.modelo).join(', ')} — confira manualmente.`
            : 'Câmeras dos pontos dentro da premissa.'
      };
    }
    if (p.verificacao === 'informativo') {
      return { ...p, automatica: true, atendida: true };
    }
    return { ...p, automatica: false, atendida: estado.premissas[p.item] };
  });

  const premissasRespondidas = premissas.every(p => p.atendida !== undefined);
  const premissaNaoAtendida = premissas.filter(p => p.atendida === false);

  // ---- compressão
  const compressoes: Array<'H.264' | 'H.265'> =
    finalidade === 'analitico' ? [] : software === 'digifort' ? ['H.264', 'H.265'] : ['H.265'];
  const compressao = compressoes.length === 1 ? compressoes[0] : estado.compressao;

  // ---- câmeras
  const base = baseBruta;
  const calculada = necessidadeDe(base, estado.reservaPct);
  const necessidade = estado.ajusteManual && estado.ajusteManual > 0 ? Math.ceil(estado.ajusteManual) : calculada;

  // ---- faixas
  const todas = linhasAtivas(software);
  const capacidades = todas.map(l => l.capacidade).filter((c, i, arr) => arr.indexOf(c) === i).sort((a, b) => a - b);
  const recomendada = capacidades.filter(c => c >= necessidade)[0];
  const faixas: IFaixaAvaliada[] = capacidades.map(c => {
    const daFaixa = todas.filter(l => l.capacidade === c);
    return {
      capacidade: c,
      habilitada: c >= necessidade && daFaixa.some(linhaCompleta),
      recomendada: c === recomendada,
      folga: c - necessidade,
      opcoes: daFaixa.filter(linhaCompleta).length,
      incompletas: daFaixa.filter(l => !linhaCompleta(l)).length
    };
  });

  const capacidadeEscolhida = estado.capacidade !== undefined && faixas.some(f => f.capacidade === estado.capacidade && f.habilitada)
    ? estado.capacidade
    : undefined;
  // Pré-preenche com a recomendada (se ela tiver linha completa).
  const faixaRec = faixas.filter(f => f.recomendada)[0];
  const capacidade = capacidadeEscolhida !== undefined ? capacidadeEscolhida : faixaRec && faixaRec.habilitada ? faixaRec.capacidade : undefined;

  const linhasDaFaixa = capacidade !== undefined ? todas.filter(l => l.capacidade === capacidade && linhaCompleta(l)) : [];
  const linha = linhasDaFaixa.length === 1
    ? linhasDaFaixa[0]
    : linhasDaFaixa.filter(l => l.chave === estado.chaveLinha)[0];

  const gpuEsc = escolhaDe(linha ? linha.gpus : [], estado.gpu);
  const procEsc = escolhaDe(linha ? linha.processadores : [], estado.processador);
  const soEsc = escolhaDe(linha ? linha.sistemas : [], estado.so);

  // ---- passos
  const passos: IPassoAvaliado[] = [];
  let anteriorOk = true;
  const passo = (id: PassoServidor, titulo: string, respondido: boolean, automatico: boolean, valor?: string, naoSeAplica?: boolean): void => {
    const estadoPasso: EstadoPasso = !anteriorOk
      ? 'bloqueado'
      : naoSeAplica
        ? 'naoSeAplica'
        : respondido
          ? (automatico ? 'automatico' : 'respondido')
          : 'aberto';
    passos.push({ id, titulo, estado: estadoPasso, valor });
    anteriorOk = anteriorOk && (respondido || !!naoSeAplica);
  };

  passo('premissas', 'Premissas do memorial', premissasRespondidas && premissaNaoAtendida.length === 0, premissas.every(p => p.automatica),
    !premissasRespondidas ? undefined : premissaNaoAtendida.length > 0 ? `${premissaNaoAtendida.length} não atendida(s)` : 'Atendidas');
  passo('compressao', 'Compressão', !!compressao, compressoes.length <= 1, compressao, compressoes.length === 0);
  passo('cameras', 'Câmeras', estado.camerasConfirmadas, false, `${necessidade} câmeras (base ${base}${estado.ajusteManual ? ', ajuste manual' : `, reserva ${estado.reservaPct}%`})`);
  passo('faixa', 'Faixa de capacidade', capacidade !== undefined, capacidadeEscolhida === undefined, capacidade !== undefined ? `${capacidade} câmeras` : undefined);
  passo('opcao', 'Distribuição', !!linha, linhasDaFaixa.length === 1, linha ? (linha.opcao ? `Opção ${linha.opcao} · ${linha.qtdServidores} servidor(es)` : `${linha.qtdServidores} servidor(es)`) : undefined);
  passo('gpu', 'GPU', !!linha && (gpuEsc.valor !== undefined || (linha.gpus.length === 0)), gpuEsc.automatico, gpuEsc.valor, !!linha && linha.gpus.length === 0);
  passo('processador', 'Processador', !!linha && procEsc.valor !== undefined, procEsc.automatico, procEsc.valor);
  passo('so', 'Sistema operacional', !!linha && (soEsc.valor !== undefined || linha.sistemas.length === 0), soEsc.automatico, soEsc.valor, !!linha && linha.sistemas.length === 0);

  const tudoRespondido = passos.every(p => p.estado === 'respondido' || p.estado === 'automatico' || p.estado === 'naoSeAplica');

  // ---- alertas
  premissaNaoAtendida.forEach(p => alertas.push({
    nivel: 'bloqueio',
    texto: `Premissa não atendida (${p.item}: ${p.valor}). Peça o dimensionamento ao fornecedor antes de concluir.${p.detalhe ? ` ${p.detalhe}` : ''}`
  }));

  const maior = capacidades[capacidades.length - 1];
  if (capacidades.length > 0 && necessidade > maior) {
    alertas.push({ nivel: 'bloqueio', texto: `Necessidade de ${necessidade} câmeras acima da maior faixa (${maior}). Peça o dimensionamento ao fornecedor ou divida em mais de um conjunto.` });
  }
  if (capacidades.length === 0) {
    alertas.push({ nivel: 'bloqueio', texto: `Nenhuma linha ativa do memorial de ${info.nome}.` });
  } else if (faixaRec && !faixaRec.habilitada && necessidade <= maior) {
    alertas.push({ nivel: 'bloqueio', texto: `A faixa recomendada (${faixaRec.capacidade}) está com os dados do memorial incompletos. Importe a planilha na aba Kits → Servidores.` });
  }

  const ctx = { processador: procEsc.valor, gpu: gpuEsc.valor, so: soEsc.valor, compressao };
  const alertasTabela = ([] as IAlertaServidor[])
    .concat(ficha ? ficha.alertas : [])
    .concat(geral ? geral.alertas : [])
    .concat(linha ? linha.alertas : []);
  alertasTabela
    .filter(a => aplicaAlerta(a, ctx))
    .forEach(a => alertas.push({ nivel: a.nivel, texto: preencher(a.texto, linha, ctx) }));

  if (estado.concluido && estado.chaveLinha && linha && linha.chave !== estado.chaveLinha) {
    alertas.push({ nivel: 'bloqueio', texto: `A linha escolhida (${estado.chaveLinha}) não comporta mais a necessidade de ${necessidade} câmeras: escolha a faixa de novo.` });
  }
  if (linha && !linha.codigoCigam.trim()) {
    alertas.push({ nivel: 'aviso', texto: `Servidor sem código CIGAM (sugestão de cadastro: ${linha.chave}): não orçável até o cadastro.` });
  }
  if (linha && linha.capacidade - necessidade > 0 && estado.modoLicenca === 'faixa') {
    alertas.push({ nivel: 'aviso', texto: `Licenças pela tabela da faixa: ${linha.capacidade} licenças para ${necessidade} câmeras (pendência S3).` });
  }
  if (contagem.porteiros > 0 && finalidade === 'gravacao' && !estado.incluirPorteiros) {
    alertas.push({ nivel: 'aviso', texto: `${contagem.porteiros} porteiro(s) de comunicação bidirecional consomem canal de VMS e não estão na base (pendência S2).` });
  }

  // ---- armazenamento
  const fator = fatorArmazenamento(software, compressao);
  const armazTotal = linha ? (linha.armazTotalTb || linha.armazServidorTb * linha.qtdServidores) * fator : 0;
  const armazServidor = linha ? (linha.armazServidorTb || (linha.qtdServidores ? linha.armazTotalTb / linha.qtdServidores : 0)) * fator : 0;

  // ---- itens
  const itens: IItemServidor[] = [];
  if (linha && tudoRespondido) {
    const s = linha.qtdServidores;
    const hw = finalidade === 'analitico'
      ? [procEsc.valor, linha.ram && `${linha.ram} RAM`, gpuEsc.valor].filter(Boolean)
      : [procEsc.valor, linha.ram && `${linha.ram} RAM`, armazServidor > 0 ? `${formatar(armazServidor)} TB` : '', gpuEsc.valor].filter(Boolean);
    itens.push({
      codigo: linha.codigoCigam.trim(),
      descricao: `${nomeLinha(linha)}${hw.length ? ` — ${hw.join(', ')}` : ''}`,
      categoria: 'Equipamento',
      quantidade: s
    });

    if (software === 'digifort') {
      const lic = estado.modoLicenca === 'faixa' && linha.licencas.length > 0
        ? linha.licencas
        : licencasDigifortPorNecessidade(necessidade, s);
      lic.forEach(l => itens.push({ codigo: '', descricao: l.codigo, categoria: 'Licença', quantidade: l.qtd, chaveItem: `dgfen:${l.codigo}` }));
    }
    if (software === 'milestone') {
      if (linha.discosQtd > 0) {
        itens.push({
          codigo: linha.codigoDisco.trim(),
          descricao: `Disco de vigilância${linha.discoTamanhoTb ? ` ${formatar(linha.discoTamanhoTb)} TB` : ''} (Milestone · faixa ${linha.capacidade})`,
          categoria: 'Equipamento',
          quantidade: linha.discosQtd * s
        });
      }
      itens.push({ codigo: '', descricao: 'Licença XProtect por câmera', categoria: 'Licença', quantidade: estado.modoLicenca === 'faixa' ? linha.capacidade : necessidade, chaveItem: 'milestoneXprotect' });
    }
    if (soEsc.valor) {
      itens.push({ codigo: linha.codigoSo.trim(), descricao: `Sistema operacional ${soEsc.valor}`, categoria: 'Licença', quantidade: s });
    }
  }

  // ---- status
  const bloqueios = alertas.filter(a => a.nivel === 'bloqueio');
  let status: StatusServidor;
  let mensagem: string;
  if (estado.concluido && linha && tudoRespondido && bloqueios.length === 0) {
    if (estado.necessidadeNaConclusao !== undefined && estado.necessidadeNaConclusao !== necessidade) {
      status = 'revisar';
      mensagem = `Os pontos mudaram depois da seleção (${estado.necessidadeNaConclusao} → ${necessidade} câmeras): revise o servidor.`;
    } else {
      status = 'concluido';
      mensagem = 'Servidor na central.';
    }
  } else if (bloqueios.length > 0) {
    status = 'pendente';
    mensagem = 'Pendente: resolva os bloqueios para concluir.';
  } else if (tudoRespondido && linha) {
    status = 'pronto';
    mensagem = 'Pronto para adicionar à central.';
  } else {
    status = 'emAndamento';
    mensagem = 'Responda os passos em ordem.';
  }

  const rastreabilidade = linha
    ? `Origem: ${ficha ? ficha.memorial : info.nome}, ${linha.versaoMemorial || (ficha && ficha.dataMemorial) || 'data não informada'} · linha ${linha.chave}.`
    : ficha ? `Origem: ${ficha.memorial}, ${ficha.dataMemorial}.` : '';

  return {
    finalidade,
    software,
    status,
    mensagem,
    estado,
    contagem,
    base,
    necessidade,
    passos,
    premissas,
    compressoes,
    faixas,
    faixaRecomendada: recomendada,
    capacidade,
    linhasDaFaixa,
    linha,
    gpu: gpuEsc.valor,
    processador: procEsc.valor,
    so: soEsc.valor,
    armazenamentoTotalTb: armazTotal,
    armazenamentoServidorTb: armazServidor,
    alertas,
    itens,
    rastreabilidade
  };
};

// Concluir ("Adicionar à central"): só quando pronto.
export const concluirServidor = (av: IAvaliacaoServidor): ISelecaoServidor | undefined => {
  if (av.status !== 'pronto' && av.status !== 'revisar') {
    return undefined;
  }
  return {
    ...av.estado,
    software: av.software,
    capacidade: av.capacidade,
    chaveLinha: av.linha ? av.linha.chave : av.estado.chaveLinha,
    gpu: av.gpu,
    processador: av.processador,
    so: av.so,
    compressao: av.compressoes.length === 1 ? av.compressoes[0] : av.estado.compressao,
    concluido: true,
    necessidadeNaConclusao: av.necessidade
  };
};

export const FINALIDADES: FinalidadeServidor[] = ['gravacao', 'analitico'];

export const TITULO_FINALIDADE: Record<FinalidadeServidor, string> = {
  gravacao: 'Servidor de gravação',
  analitico: 'Servidor de analítico'
};

export const NOME_STATUS: Record<StatusServidor, string> = {
  naoSeAplica: 'Não se aplica',
  nuvem: 'Nuvem',
  semCameras: 'Sem câmeras',
  emAndamento: 'Rascunho',
  pendente: 'Pendente',
  pronto: 'Pronto',
  concluido: 'Na central',
  revisar: 'Revisar servidor'
};

// Linhas por software (para telas).
export const linhasDoSoftware = (software: SoftwareServidor): ILinhaServidor[] =>
  LINHAS_SERVIDOR.filter(l => l.software === software)
    .sort((a, b) => a.capacidade - b.capacidade || a.opcao.localeCompare(b.opcao));

export const totalFichas = (): number => FICHAS_SOFTWARE.length;

export { NOME_FINALIDADE };
