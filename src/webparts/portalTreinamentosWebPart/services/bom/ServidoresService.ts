import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  ALERTAS_PADRAO,
  CATALOGO_SERVIDORES_PADRAO,
  Compressao,
  FinalidadeServidor,
  IAlertaServidorRegra,
  ILinhaServidor,
  NivelAlertaServidor,
  SOFTWARES_SERVIDOR,
  SoftwareServidor,
  aplicarCatalogoServidores
} from './servidores';

import {
  detectarDadoSensivel
} from '../LicitacaoParecerService';

// ============================================================
// SERVIDORES — CATÁLOGO NO DATAVERSE (aba Kits → Servidores)
//
//   dgt_servidorcatalogo  uma linha por faixa/opção de um memorial
//   dgt_servidoralerta    textos e níveis dos alertas (regras gerais
//                         ou "linha:<chave>")
//
// Alternativas (processador, GPU, SO) ficam em campos próprios, uma
// por linha de texto — nada de interpretar "X ou (Y / Z)" na hora.
// Nada é apagado: linha fora de uso é desativada. As alterações vão
// para o histórico da aba Kits (dgt_kitalteracao).
//
// Tabelas: scripts/dataverse/criar-tabelas-servidores.ps1
// ============================================================

export const TABELA_SERVIDOR = 'dgt_servidorcatalogo';
export const TABELA_ALERTA_SERVIDOR = 'dgt_servidoralerta';

const C = {
  id: 'dgt_servidorcatalogoid',
  chave: 'dgt_name',
  software: 'dgt_software',
  finalidade: 'dgt_finalidade',
  capacidade: 'dgt_capacidade',
  opcao: 'dgt_opcao',
  qtdServidores: 'dgt_qtdservidores',
  camerasPorServidor: 'dgt_camerasporservidor',
  processadores: 'dgt_processadores',
  ram: 'dgt_ram',
  discoSo: 'dgt_discoso',
  armazServidorTb: 'dgt_armazservidortb',
  armazTotalTb: 'dgt_armaztotaltb',
  discosQtd: 'dgt_discosqtd',
  discoTamanhoTb: 'dgt_discotamanhotb',
  arranjo: 'dgt_arranjo',
  gpus: 'dgt_gpus',
  sistemasOperacionais: 'dgt_sistemasoperacionais',
  compressaoRef: 'dgt_compressaoref',
  iops: 'dgt_iops',
  redeCamerasMbps: 'dgt_redecamerasmbps',
  codigoCigam: 'dgt_codigocigam',
  versaoMemorial: 'dgt_versaomemorial',
  observacao: 'dgt_observacao',
  ativo: 'dgt_ativo'
};

const CA = {
  id: 'dgt_servidoralertaid',
  regra: 'dgt_name',
  nivel: 'dgt_nivel',
  texto: 'dgt_texto',
  ativo: 'dgt_ativo'
};

export interface ILinhaServidorGravada extends ILinhaServidor {
  registroId?: string;
}

export interface IAlertaServidorGravado extends IAlertaServidorRegra {
  registroId?: string;
}

export interface ICatalogoServidoresCarregado {
  origem: 'dataverse' | 'padrao';
  motivoPadrao?: string;
  vazio: boolean;
  linhas: ILinhaServidorGravada[];
  alertas: IAlertaServidorGravado[];
}

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const numero = (r: IDataverseRecord, campo: string): number => {
  const v = Number(r[campo]);
  return isNaN(v) ? 0 : v;
};

const lista = (valor: string): string[] =>
  (valor || '').split(/\r?\n|\s\|\s/).map(x => x.trim()).filter(Boolean);

const guid = (v: unknown): string => String(v || '').replace(/[{}]/g, '').trim().toLowerCase();

const ehTabelaInexistente = (erro: unknown): boolean =>
  /404|could not find|does not exist|não localizado|0x80060888/i.test(String((erro as Error)?.message || erro || ''));

const catalogoPadrao = (motivo: string): ICatalogoServidoresCarregado => ({
  origem: 'padrao',
  motivoPadrao: motivo,
  vazio: true,
  linhas: CATALOGO_SERVIDORES_PADRAO.map(l => ({ ...l })),
  alertas: ALERTAS_PADRAO.map(x => ({ ...x }))
});

export const aplicarServidoresNoMontador = (c: ICatalogoServidoresCarregado): void => {
  if (c.origem === 'dataverse' && !c.vazio) {
    aplicarCatalogoServidores(c.linhas, c.alertas);
  } else {
    aplicarCatalogoServidores(CATALOGO_SERVIDORES_PADRAO, ALERTAS_PADRAO);
  }
};

// ------------------------------------------------------------
// Importação (colar do Excel) — colunas do modelo
// ------------------------------------------------------------

export const COLUNAS_MODELO = [
  'Software (Digifort, Milestone, IPX, Digifort + IPX)',
  'Capacidade (câmeras)',
  'Opção (A/B/C ou vazio)',
  'Qtd. servidores',
  'Câmeras por servidor',
  'Processadores (alternativas separadas por |)',
  'RAM',
  'Disco do SO',
  'Armazenamento por servidor (TB)',
  'Armazenamento total (TB)',
  'Discos por servidor',
  'Tamanho do disco (TB)',
  'Arranjo',
  'GPUs (alternativas separadas por |)',
  'Sistemas operacionais (separados por |)',
  'Compressão de referência (H.264/H.265)',
  'IOPS',
  'Rede das câmeras (Mbps)',
  'Código CIGAM',
  'Versão do memorial',
  'Ativo (Sim/Não)'
];

const softwareDe = (valor: string): SoftwareServidor | undefined => {
  const v = (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');
  if (/digifort.*ipx|dgfipx|combinado/.test(v)) { return 'digifortIpx'; }
  if (/digifort|dgf/.test(v)) { return 'digifort'; }
  if (/milestone|xprotect|mil/.test(v)) { return 'milestone'; }
  if (/ipx/.test(v)) { return 'ipx'; }
  return undefined;
};

const decimal = (valor: string): number => {
  const v = Number((valor || '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(v) ? 0 : v;
};

export const chaveDaLinha = (l: Pick<ILinhaServidor, 'software' | 'capacidade' | 'opcao'>): string => {
  const sigla = (SOFTWARES_SERVIDOR.filter(s => s.software === l.software)[0] || { sigla: 'SRV' }).sigla;
  return `${sigla}-${('00' + l.capacidade).slice(-3)}${l.opcao ? `-${l.opcao}` : ''}`;
};

export const interpretarColado = (textoColado: string): Array<{ linha: number; dado?: ILinhaServidor; erro?: string }> =>
  textoColado
    .split(/\r?\n/)
    .map((l, i) => ({ c: l.split('\t'), i }))
    .filter(x => x.c.some(v => v.trim()))
    .filter(x => !/^software/i.test((x.c[0] || '').trim()))
    .map(({ c, i }) => {
      const software = softwareDe(c[0]);
      const capacidade = Math.round(decimal(c[1]));
      if (!software) {
        return { linha: i + 1, erro: `Software não reconhecido: "${c[0]}".` };
      }
      if (!(capacidade > 0)) {
        return { linha: i + 1, erro: 'Capacidade inválida.' };
      }
      const finalidade: FinalidadeServidor = (SOFTWARES_SERVIDOR.filter(s => s.software === software)[0]).finalidade;
      const qtd = Math.max(1, Math.round(decimal(c[3])) || 1);
      const opcao = (c[2] || '').trim().toUpperCase().substring(0, 2);
      const dado: ILinhaServidor = {
        id: '',
        software,
        finalidade,
        capacidade,
        opcao,
        qtdServidores: qtd,
        camerasPorServidor: Math.round(decimal(c[4])) || Math.ceil(capacidade / qtd),
        processadores: lista((c[5] || '').replace(/\|/g, ' | ')),
        ram: (c[6] || '').trim(),
        discoSo: (c[7] || '').trim(),
        armazServidorTb: decimal(c[8]),
        armazTotalTb: decimal(c[9]) || decimal(c[8]) * qtd,
        discosQtd: Math.round(decimal(c[10])),
        discoTamanhoTb: decimal(c[11]),
        arranjo: (c[12] || '').trim(),
        gpus: lista((c[13] || '').replace(/\|/g, ' | ')),
        sistemasOperacionais: lista((c[14] || '').replace(/\|/g, ' | ')),
        compressaoRef: /265/.test(c[15] || '') ? 'H.265' : 'H.264',
        iops: (c[16] || '').trim(),
        redeCamerasMbps: decimal(c[17]),
        codigoCigam: (c[18] || '').trim(),
        versaoMemorial: (c[19] || '').trim(),
        ativo: !/^n(ao|ão)?$/i.test((c[20] || '').trim()),
        observacao: ''
      };
      dado.id = chaveDaLinha(dado);
      const sensivel = detectarDadoSensivel([dado.processadores.join(' '), dado.ram, dado.versaoMemorial, dado.iops].join(' '));
      return sensivel ? { linha: i + 1, erro: `Contém ${sensivel}.` } : { linha: i + 1, dado };
    });

// ------------------------------------------------------------
// Serviço
// ------------------------------------------------------------

export class ServidoresService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async carregar(): Promise<ICatalogoServidoresCarregado> {

    let registros: IDataverseRecord[];
    try {
      registros = await this.dataverse.listarRegistros(TABELA_SERVIDOR, `$select=${Object.keys(C).map(k => (C as Record<string, string>)[k]).join(',')}`);
    } catch (erro) {
      return catalogoPadrao(ehTabelaInexistente(erro)
        ? 'As tabelas de servidores ainda não foram criadas no Dataverse (script criar-tabelas-servidores.ps1).'
        : `Não foi possível ler o catálogo de servidores: ${String((erro as Error)?.message || erro).substring(0, 200)}`);
    }

    const regAlertas = await this.dataverse
      .listarRegistros(TABELA_ALERTA_SERVIDOR, `$select=${Object.keys(CA).map(k => (CA as Record<string, string>)[k]).join(',')}`)
      .catch(() => [] as IDataverseRecord[]);

    const linhas: ILinhaServidorGravada[] = registros.map(r => {
      const software = (texto(r, C.software) || 'digifort') as SoftwareServidor;
      return {
        registroId: guid(r[C.id]),
        id: texto(r, C.chave),
        software,
        finalidade: (texto(r, C.finalidade) || 'gravacao') as FinalidadeServidor,
        capacidade: numero(r, C.capacidade),
        opcao: texto(r, C.opcao),
        qtdServidores: numero(r, C.qtdServidores) || 1,
        camerasPorServidor: numero(r, C.camerasPorServidor),
        processadores: lista(texto(r, C.processadores)),
        ram: texto(r, C.ram),
        discoSo: texto(r, C.discoSo),
        armazServidorTb: numero(r, C.armazServidorTb),
        armazTotalTb: numero(r, C.armazTotalTb),
        discosQtd: numero(r, C.discosQtd),
        discoTamanhoTb: numero(r, C.discoTamanhoTb),
        arranjo: texto(r, C.arranjo),
        gpus: lista(texto(r, C.gpus)),
        sistemasOperacionais: lista(texto(r, C.sistemasOperacionais)),
        compressaoRef: (texto(r, C.compressaoRef) || 'H.264') as Compressao,
        iops: texto(r, C.iops),
        redeCamerasMbps: numero(r, C.redeCamerasMbps),
        codigoCigam: texto(r, C.codigoCigam),
        versaoMemorial: texto(r, C.versaoMemorial),
        observacao: texto(r, C.observacao),
        ativo: r[C.ativo] !== false
      };
    }).sort((x, y) => x.software.localeCompare(y.software) || x.capacidade - y.capacidade || x.opcao.localeCompare(y.opcao));

    const gravados: IAlertaServidorGravado[] = regAlertas.map(r => ({
      registroId: guid(r[CA.id]),
      id: texto(r, CA.regra),
      regra: texto(r, CA.regra),
      nivel: (texto(r, CA.nivel) || 'aviso') as NivelAlertaServidor,
      texto: texto(r, CA.texto),
      ativo: r[CA.ativo] !== false
    }));

    // Regras gerais sem registro aparecem com o texto padrão.
    const alertas: IAlertaServidorGravado[] = [
      ...ALERTAS_PADRAO.filter(p => !gravados.some(g => g.regra === p.regra)).map(p => ({ ...p })),
      ...gravados
    ];

    return { origem: 'dataverse', vazio: registros.length === 0, linhas, alertas };
  }

  private dadosLinha(l: ILinhaServidor): Record<string, unknown> {
    return {
      [C.chave]: (l.id || chaveDaLinha(l)).substring(0, 100),
      [C.software]: l.software,
      [C.finalidade]: l.finalidade,
      [C.capacidade]: Math.round(l.capacidade),
      [C.opcao]: l.opcao || '',
      [C.qtdServidores]: Math.max(1, Math.round(l.qtdServidores || 1)),
      [C.camerasPorServidor]: Math.round(l.camerasPorServidor || 0),
      [C.processadores]: l.processadores.join('\n'),
      [C.ram]: l.ram,
      [C.discoSo]: l.discoSo,
      [C.armazServidorTb]: l.armazServidorTb || 0,
      [C.armazTotalTb]: l.armazTotalTb || 0,
      [C.discosQtd]: Math.round(l.discosQtd || 0),
      [C.discoTamanhoTb]: l.discoTamanhoTb || 0,
      [C.arranjo]: l.arranjo,
      [C.gpus]: l.gpus.join('\n'),
      [C.sistemasOperacionais]: l.sistemasOperacionais.join('\n'),
      [C.compressaoRef]: l.compressaoRef,
      [C.iops]: l.iops,
      [C.redeCamerasMbps]: l.redeCamerasMbps || 0,
      [C.codigoCigam]: l.codigoCigam.trim(),
      [C.versaoMemorial]: l.versaoMemorial,
      [C.observacao]: l.observacao,
      [C.ativo]: l.ativo
    };
  }

  public async salvarLinha(l: ILinhaServidorGravada): Promise<void> {
    if (!(l.capacidade > 0)) {
      throw new Error('Informe a capacidade (câmeras).');
    }
    if (!l.versaoMemorial.trim()) {
      throw new Error('Informe a versão do memorial (rastreabilidade).');
    }
    const sensivel = detectarDadoSensivel([l.processadores.join(' '), l.ram, l.versaoMemorial, l.observacao].join(' '));
    if (sensivel) {
      throw new Error(`Os campos contêm ${sensivel}. Remova esse dado (política da DGT).`);
    }
    if (l.registroId) {
      await this.dataverse.atualizarRegistro(TABELA_SERVIDOR, l.registroId, this.dadosLinha(l));
    } else {
      await this.dataverse.criarRegistro(TABELA_SERVIDOR, this.dadosLinha(l));
    }
  }

  public async salvarAlerta(x: IAlertaServidorGravado): Promise<void> {
    const dados = { [CA.regra]: x.regra.substring(0, 100), [CA.nivel]: x.nivel, [CA.texto]: x.texto.substring(0, 2000), [CA.ativo]: x.ativo };
    if (x.registroId) {
      await this.dataverse.atualizarRegistro(TABELA_ALERTA_SERVIDOR, x.registroId, dados);
    } else {
      await this.dataverse.criarRegistro(TABELA_ALERTA_SERVIDOR, dados);
    }
  }

  // Leva o padrão (memorial combinado + linhas parciais + alertas) ao
  // Dataverse. Só cria o que não existe.
  public async importarPadrao(atual: ICatalogoServidoresCarregado): Promise<number> {
    let n = 0;
    for (const l of CATALOGO_SERVIDORES_PADRAO) {
      if (!atual.linhas.some(x => x.registroId && x.id === l.id)) {
        await this.dataverse.criarRegistro(TABELA_SERVIDOR, this.dadosLinha(l));
        n++;
      }
    }
    for (const x of ALERTAS_PADRAO) {
      if (!atual.alertas.some(y => y.registroId && y.regra === x.regra)) {
        await this.salvarAlerta(x);
        n++;
      }
    }
    return n;
  }

  // Linhas coladas: atualiza pela chave (software + capacidade + opção)
  // ou cria.
  public async importarLinhas(atual: ICatalogoServidoresCarregado, novas: ILinhaServidor[]): Promise<{ criadas: number; atualizadas: number }> {
    let criadas = 0;
    let atualizadas = 0;
    for (const l of novas) {
      const existente = atual.linhas.filter(x => x.registroId && x.id === l.id)[0];
      await this.salvarLinha({ ...l, registroId: existente ? existente.registroId : undefined, observacao: existente ? existente.observacao : l.observacao });
      if (existente) { atualizadas++; } else { criadas++; }
    }
    return { criadas, atualizadas };
  }
}

// Usado pelo montador (garantirCatalogoKitsAplicado).
export const carregarEAplicarServidores = async (dataverse: DataverseService): Promise<ICatalogoServidoresCarregado> => {
  const c = await new ServidoresService(dataverse).carregar();
  aplicarServidoresNoMontador(c);
  return c;
};
