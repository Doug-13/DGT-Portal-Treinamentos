import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

import {
  CategoriaItem,
  ChaveKit,
  CondicaoComponente,
  EstruturaBridgefy,
  ICameraCatalogo,
  ICatalogoKitsDados,
  IComponenteKit,
  IParametrosEstrutura,
  ITENS_EM_REGRAS,
  KITS,
  ModeloKit,
  RegraQuantidade,
  aplicarCatalogo,
  catalogoPadrao,
  idCamera,
  idSwitch,
  restaurarCatalogoPadrao
} from './catalogoKits';

import {
  COL_ALTERACAO,
  COL_COMPOSICAO,
  COL_ITEM,
  COL_KIT,
  IAtributosItemKit,
  SituacaoItemKit,
  TABELAS_KITS,
  TipoItemKit
} from './esquemaKits';

// ============================================================
// KITS — ACESSO AOS DADOS (Dataverse)
//
// O catálogo do montador de B.O.M. tem um PADRÃO no código
// (catalogoKits.ts). O Dataverse guarda as alterações feitas na aba
// "Kits"; ao carregar, o que está gravado é aplicado POR CIMA do
// padrão (aplicarCatalogo). Sem as tabelas, a aba funciona em modo
// consulta, mostrando o padrão.
//
// Histórico: nada é excluído. Itens e linhas retiradas são
// desativadas, e cada gravação gera um registro em dgt_kitalteracao
// com o "antes" e o "depois".
// ============================================================

export interface IItemKit {
  id?: string;
  chave: string;
  tipo: TipoItemKit;
  codigo: string;
  descricao: string;
  categoria: CategoriaItem;
  situacao: SituacaoItemKit;
  observacao: string;
  ordem: number;
  ativo: boolean;
  atributos: IAtributosItemKit;
}

export interface IKitParametros {
  id?: string;
  chave: ChaveKit;
  // Modelo de cálculo (kits do sistema: igual à chave).
  modelo: ModeloKit;
  sistema: boolean;
  ativo: boolean;
  ordem: number;
  nome: string;
  codigoCigam: string;
  maxCameras: number;
  aceitaOcr: boolean;
  sinalizacao: string;
  descricao: string;
}

export interface IAlteracaoKit {
  id: string;
  data: string;
  usuarioNome: string;
  entidade: string;
  chave: string;
  acao: string;
  resumo: string;
  motivo: string;
  detalhes: string;
}

export interface ICatalogoKitsCarregado {
  origem: 'dataverse' | 'padrao';
  // Por que está no padrão (tabelas não criadas, sem permissão...).
  motivoPadrao?: string;
  // Tabelas existem, mas nada foi importado ainda.
  vazio: boolean;
  itens: IItemKit[];
  kits: IKitParametros[];
  composicoes: Record<string, IComponenteKit[]>;
  // Kits cuja composição já está gravada no Dataverse.
  composicaoGravada: Record<string, boolean>;
  alteracoes: IAlteracaoKit[];
}

// ------------------------------------------------------------
// Auxiliares
// ------------------------------------------------------------

const guid = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const numero = (registro: IDataverseRecord, campo: string, padrao = 0): number => {
  const valor = Number(registro[campo]);
  return isNaN(valor) ? padrao : valor;
};

const lerJson = <T>(valor: string, padrao: T): T => {
  if (!valor) {
    return padrao;
  }
  try {
    return JSON.parse(valor) as T;
  } catch {
    return padrao;
  }
};

const tabelaInexistente = (erro: unknown): boolean => {
  const mensagem = String((erro as Error)?.message || erro || '');
  return /404|could not find|does not exist|não localizado|0x80060888/i.test(mensagem);
};

// Nome do kit EM USO (sistema ou configurado).
export const nomeKit = (chave: string): string =>
  (KITS.filter(k => k.chave === chave)[0] || { nome: chave }).nome;

// Chave estável de um equipamento do padrão.
const chaveEquipamento = (tipo: TipoItemKit, id: string): string =>
  `${tipo}:${id}`;

// ------------------------------------------------------------
// Padrão (código) → modelo da aba Kits
// ------------------------------------------------------------

export const itensDoPadrao = (): IItemKit[] => {

  const p = catalogoPadrao();
  const itens: IItemKit[] = [];

  p.itens.forEach((item, indice) => itens.push({
    chave: item.chave,
    tipo: 'item',
    codigo: item.codigo,
    descricao: item.descricao,
    categoria: item.categoria,
    situacao: 'Homologado',
    observacao: '',
    ordem: indice,
    ativo: true,
    atributos: {}
  }));

  const camera = (tipo: TipoItemKit): ((cam: ICameraCatalogo, indice: number) => IItemKit) => (cam: ICameraCatalogo, indice: number): IItemKit => ({
    chave: chaveEquipamento(tipo, idCamera(cam)),
    tipo,
    codigo: cam.codigo,
    descricao: cam.modelo,
    categoria: 'Câmera',
    situacao: cam.codigo ? 'Homologado' : 'Em homologação',
    observacao: cam.observacao || '',
    ordem: indice,
    ativo: true,
    atributos: { formato: cam.formato, zoomOptico: cam.zoomOptico, consumoW: cam.consumoW, padrao: !!cam.padrao }
  });

  p.camerasVideo.forEach((cam, i) => itens.push(camera('cameraVideo')(cam, i)));
  p.camerasOcr.forEach((cam, i) => itens.push(camera('cameraOcr')(cam, i)));

  p.switches.forEach((sw, i) => itens.push({
    chave: chaveEquipamento('switch', idSwitch(sw)),
    tipo: 'switch',
    codigo: sw.codigo,
    descricao: sw.modelo,
    categoria: 'Equipamento',
    situacao: sw.codigo ? 'Homologado' : 'Em homologação',
    observacao: '',
    ordem: i,
    ativo: true,
    atributos: { poe: sw.poe, orcamentoW: sw.orcamentoW, portasPoe: sw.portasPoe, padrao: !!sw.padrao, usoCatraca: !!sw.usoCatraca }
  }));

  p.controladoresPorta.forEach((ctrl, i) => itens.push({
    chave: chaveEquipamento('controladorPorta', ctrl.codigo || ctrl.modelo),
    tipo: 'controladorPorta',
    codigo: ctrl.codigo,
    descricao: ctrl.modelo,
    categoria: 'Equipamento',
    situacao: 'Homologado',
    observacao: '',
    ordem: i,
    ativo: true,
    atributos: { padrao: !!ctrl.padrao }
  }));

  if (p.controladorPne) {
    itens.push({
      chave: chaveEquipamento('controladorPne', p.controladorPne.codigo || p.controladorPne.modelo),
      tipo: 'controladorPne',
      codigo: p.controladorPne.codigo,
      descricao: p.controladorPne.modelo,
      categoria: 'Equipamento',
      situacao: 'Homologado',
      observacao: '',
      ordem: 0,
      ativo: true,
      atributos: { padrao: true }
    });
  }

  return itens;
};

export const kitsDoPadrao = (): IKitParametros[] => {
  const p = catalogoPadrao();
  return KITS.filter(kit => kit.sistema).map(kit => {
    const estrutura = (p.estruturas as Record<string, IParametrosEstrutura | undefined>)[kit.chave];
    return {
      chave: kit.chave,
      modelo: kit.modelo,
      sistema: true,
      ativo: true,
      ordem: kit.ordem,
      nome: estrutura ? estrutura.nome : kit.nome,
      codigoCigam: estrutura ? estrutura.codigoKit : '',
      maxCameras: estrutura ? estrutura.maxCameras : 0,
      aceitaOcr: estrutura ? estrutura.aceitaOcr : false,
      sinalizacao: estrutura ? estrutura.sinalizacao : '',
      descricao: kit.resumo
    };
  });
};

const catalogoDoPadrao = (motivo: string): ICatalogoKitsCarregado => ({
  origem: 'padrao',
  motivoPadrao: motivo,
  vazio: true,
  itens: itensDoPadrao(),
  kits: kitsDoPadrao(),
  composicoes: catalogoPadrao().composicoes,
  composicaoGravada: {},
  alteracoes: []
});

// ------------------------------------------------------------
// Modelo da aba Kits → dados do montador
// ------------------------------------------------------------

export const dadosParaMontador = (
  catalogo: Pick<ICatalogoKitsCarregado, 'itens' | 'kits' | 'composicoes'>
): ICatalogoKitsDados => {

  const ativos = (tipo: TipoItemKit): IItemKit[] =>
    catalogo.itens
      .filter(item => item.tipo === tipo && item.ativo && item.situacao !== 'Descontinuado')
      .sort((a, b) => a.ordem - b.ordem || a.descricao.localeCompare(b.descricao));

  const cameras = (tipo: TipoItemKit): ICameraCatalogo[] => ativos(tipo).map(item => ({
    codigo: item.codigo,
    modelo: item.descricao,
    formato: item.atributos.formato || 'Bullet',
    zoomOptico: !!item.atributos.zoomOptico,
    consumoW: Number(item.atributos.consumoW) || 0,
    padrao: !!item.atributos.padrao,
    observacao: item.observacao || undefined
  }));

  const pne = ativos('controladorPne')[0];

  const estruturas: Partial<Record<EstruturaBridgefy, IParametrosEstrutura>> = {};
  const parametrosKits: Record<string, IParametrosEstrutura> = {};
  const bridgefy = (modelo: string): boolean => modelo === 'torre' || modelo === 'box' || modelo === 'mini';

  catalogo.kits
    .filter(kit => bridgefy(kit.modelo))
    .forEach(kit => {
      const parametros: IParametrosEstrutura = {
        nome: kit.nome,
        codigoKit: kit.codigoCigam,
        maxCameras: kit.maxCameras,
        aceitaOcr: kit.aceitaOcr,
        sinalizacao: kit.sinalizacao
      };
      if (kit.sistema) {
        estruturas[kit.chave as EstruturaBridgefy] = parametros;
      } else {
        parametrosKits[kit.chave] = parametros;
      }
    });

  return {
    itens: catalogo.itens
      .filter(item => item.tipo === 'item')
      .map(item => ({
        chave: item.chave,
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: item.categoria,
        ativo: item.ativo && item.situacao !== 'Descontinuado'
      })),
    camerasVideo: cameras('cameraVideo'),
    camerasOcr: cameras('cameraOcr'),
    switches: ativos('switch').map(item => ({
      codigo: item.codigo,
      modelo: item.descricao,
      poe: !!item.atributos.poe,
      orcamentoW: Number(item.atributos.orcamentoW) || 0,
      portasPoe: Number(item.atributos.portasPoe) || 0,
      padrao: !!item.atributos.padrao,
      usoCatraca: !!item.atributos.usoCatraca
    })),
    controladoresPorta: ativos('controladorPorta').map(item => ({
      codigo: item.codigo,
      modelo: item.descricao,
      padrao: !!item.atributos.padrao
    })),
    controladorPne: pne ? { codigo: pne.codigo, modelo: pne.descricao } : undefined,
    estruturas,
    parametrosKits,
    kits: catalogo.kits.map(kit => ({
      chave: kit.chave,
      nome: kit.nome,
      grupo: (bridgefy(kit.modelo) ? 'Bridgefy' : 'Controle de acesso') as 'Bridgefy' | 'Controle de acesso',
      editavel: kit.modelo !== 'catraca',
      resumo: kit.descricao,
      modelo: kit.modelo,
      sistema: kit.sistema,
      ativo: kit.ativo,
      ordem: kit.ordem
    })),
    composicoes: catalogo.composicoes
  };
};

export const aplicarNoMontador = (catalogo: ICatalogoKitsCarregado): void => {
  if (catalogo.origem === 'dataverse' && !catalogo.vazio) {
    aplicarCatalogo(dadosParaMontador(catalogo), 'dataverse');
  } else {
    restaurarCatalogoPadrao();
  }
};

// Onde cada item é usado (kits ativos).
export const usosDoItem = (
  chave: string,
  composicoes: Record<string, IComponenteKit[]>
): string[] => {
  const usos = Object.keys(composicoes)
    .filter(kit => composicoes[kit].some(linha => linha.chaveItem === chave))
    .map(kit => nomeKit(kit));
  if (ITENS_EM_REGRAS[chave] && usos.indexOf(ITENS_EM_REGRAS[chave]) < 0) {
    usos.push(ITENS_EM_REGRAS[chave]);
  }
  return usos;
};

// ------------------------------------------------------------
// Serviço
// ------------------------------------------------------------

export class KitsService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // ---------------- leitura ----------------

  public async carregar(): Promise<ICatalogoKitsCarregado> {

    let registrosItens: IDataverseRecord[];

    try {
      registrosItens = await this.dataverse.listarRegistros(
        TABELAS_KITS.item,
        `$select=${Object.keys(COL_ITEM).map(k => (COL_ITEM as Record<string, string>)[k]).join(',')}`
      );
    } catch (erro) {
      return catalogoDoPadrao(
        tabelaInexistente(erro)
          ? 'As tabelas de kits ainda não foram criadas no Dataverse (script criar-tabelas-kits.ps1).'
          : `Não foi possível ler o catálogo de kits no Dataverse: ${String((erro as Error)?.message || erro).substring(0, 200)}`
      );
    }

    const [registrosKits, registrosComposicao, registrosAlteracao] = await Promise.all([
      this.dataverse.listarRegistros(
        TABELAS_KITS.kit,
        `$select=${Object.keys(COL_KIT).map(k => (COL_KIT as Record<string, string>)[k]).join(',')}`
      ).catch(() =>
        // Tabela criada antes das colunas de kits configurados
        // (dgt_modelo, dgt_ordem): lê sem elas.
        this.dataverse.listarRegistros(
          TABELAS_KITS.kit,
          `$select=${[COL_KIT.id, COL_KIT.nome, COL_KIT.chave, COL_KIT.codigoCigam, COL_KIT.maxCameras, COL_KIT.aceitaOcr, COL_KIT.sinalizacao, COL_KIT.descricao, COL_KIT.ativo].join(',')}`
        )),
      this.dataverse.listarRegistros(
        TABELAS_KITS.composicao,
        `$select=${Object.keys(COL_COMPOSICAO).map(k => (COL_COMPOSICAO as Record<string, string>)[k]).join(',')}&$filter=${COL_COMPOSICAO.ativo} eq true&$orderby=${COL_COMPOSICAO.ordem} asc`
      ),
      this.dataverse.listarRegistros(
        TABELAS_KITS.alteracao,
        `$select=${Object.keys(COL_ALTERACAO).map(k => (COL_ALTERACAO as Record<string, string>)[k]).join(',')},createdon&$orderby=createdon desc&$top=300`
      ).catch(() => [] as IDataverseRecord[])
    ]);

    const vazio = registrosItens.length === 0 && registrosKits.length === 0 && registrosComposicao.length === 0;

    // Itens: padrão + gravados (o gravado vence pela chave).
    const porChave: Record<string, IItemKit> = {};
    itensDoPadrao().forEach(item => { porChave[item.chave] = item; });

    registrosItens.forEach(registro => {
      const chave = texto(registro, COL_ITEM.chave);
      if (!chave) {
        return;
      }
      porChave[chave] = {
        id: guid(registro[COL_ITEM.id]),
        chave,
        tipo: (texto(registro, COL_ITEM.tipo) || 'item') as TipoItemKit,
        codigo: texto(registro, COL_ITEM.codigo),
        descricao: texto(registro, COL_ITEM.descricao),
        categoria: (texto(registro, COL_ITEM.categoria) || 'Infraestrutura') as CategoriaItem,
        situacao: (texto(registro, COL_ITEM.situacao) || 'Homologado') as SituacaoItemKit,
        observacao: texto(registro, COL_ITEM.observacao),
        ordem: numero(registro, COL_ITEM.ordem),
        ativo: registro[COL_ITEM.ativo] !== false,
        atributos: lerJson<IAtributosItemKit>(texto(registro, COL_ITEM.atributos), {})
      };
    });

    // Parâmetros dos kits: os do sistema (padrão + gravado) e os
    // configurados na aba Kits (dgt_modelo preenchido).
    const lerKit = (registro: IDataverseRecord, padrao: IKitParametros): IKitParametros => ({
      id: guid(registro[COL_KIT.id]),
      chave: padrao.chave,
      modelo: padrao.modelo,
      sistema: padrao.sistema,
      ativo: padrao.sistema ? true : registro[COL_KIT.ativo] !== false,
      ordem: registro[COL_KIT.ordem] === undefined || registro[COL_KIT.ordem] === null ? padrao.ordem : numero(registro, COL_KIT.ordem),
      nome: texto(registro, COL_KIT.nome) || padrao.nome,
      codigoCigam: texto(registro, COL_KIT.codigoCigam),
      maxCameras: numero(registro, COL_KIT.maxCameras, padrao.maxCameras),
      aceitaOcr: registro[COL_KIT.aceitaOcr] === true,
      sinalizacao: texto(registro, COL_KIT.sinalizacao),
      descricao: texto(registro, COL_KIT.descricao) || padrao.descricao
    });

    const padroes = kitsDoPadrao();
    const kits = padroes.map(padrao => {
      const registro = registrosKits.find(r => texto(r, COL_KIT.chave) === padrao.chave);
      return registro ? lerKit(registro, padrao) : padrao;
    });

    registrosKits
      .filter(r => padroes.every(p => p.chave !== texto(r, COL_KIT.chave)))
      .forEach(registro => {
        const modelo = texto(registro, COL_KIT.modelo) as ModeloKit;
        const base = padroes.filter(p => p.chave === modelo)[0];
        if (!base || modelo === 'catraca') {
          return;
        }
        kits.push(lerKit(registro, { ...base, chave: texto(registro, COL_KIT.chave), sistema: false, ordem: 100 }));
      });

    kits.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

    // Composições: kit com linhas gravadas usa só as gravadas.
    const composicoes = catalogoPadrao().composicoes;
    const composicaoGravada: Record<string, boolean> = {};
    const gravadas: Record<string, IComponenteKit[]> = {};

    registrosComposicao.forEach(registro => {
      const kit = texto(registro, COL_COMPOSICAO.kit);
      if (!kit) {
        return;
      }
      (gravadas[kit] = gravadas[kit] || []).push({
        id: guid(registro[COL_COMPOSICAO.id]),
        chaveItem: texto(registro, COL_COMPOSICAO.itemChave),
        quantidade: numero(registro, COL_COMPOSICAO.quantidade),
        regra: (texto(registro, COL_COMPOSICAO.regra) || 'fixa') as RegraQuantidade,
        condicao: (texto(registro, COL_COMPOSICAO.condicao) || 'sempre') as CondicaoComponente,
        observacao: texto(registro, COL_COMPOSICAO.observacao)
      });
    });

    Object.keys(gravadas).forEach(kit => {
      composicoes[kit] = gravadas[kit];
      composicaoGravada[kit] = true;
    });

    const alteracoes: IAlteracaoKit[] = registrosAlteracao.map(registro => ({
      id: guid(registro[COL_ALTERACAO.id]),
      data: texto(registro, 'createdon'),
      usuarioNome: texto(registro, COL_ALTERACAO.usuarioNome) || '—',
      entidade: texto(registro, COL_ALTERACAO.entidade),
      chave: texto(registro, COL_ALTERACAO.chave),
      acao: texto(registro, COL_ALTERACAO.acao),
      resumo: texto(registro, COL_ALTERACAO.resumo),
      motivo: texto(registro, COL_ALTERACAO.motivo),
      detalhes: texto(registro, COL_ALTERACAO.detalhes)
    }));

    return {
      origem: 'dataverse',
      vazio,
      itens: Object.keys(porChave).map(chave => porChave[chave]),
      kits,
      composicoes,
      composicaoGravada,
      alteracoes
    };
  }

  // ---------------- gravação ----------------

  private dadosItem(item: IItemKit): Record<string, unknown> {
    return {
      [COL_ITEM.chave]: item.chave,
      [COL_ITEM.descricao]: item.descricao.trim().substring(0, 200),
      [COL_ITEM.codigo]: item.codigo.trim(),
      [COL_ITEM.categoria]: item.categoria,
      [COL_ITEM.tipo]: item.tipo,
      [COL_ITEM.situacao]: item.situacao,
      [COL_ITEM.observacao]: item.observacao,
      [COL_ITEM.ordem]: Math.round(item.ordem || 0),
      [COL_ITEM.ativo]: item.ativo,
      [COL_ITEM.atributos]: JSON.stringify(item.atributos || {})
    };
  }

  private dadosKit(kit: IKitParametros): Record<string, unknown> {
    return {
      [COL_KIT.chave]: kit.chave,
      [COL_KIT.nome]: kit.nome.trim().substring(0, 200),
      [COL_KIT.codigoCigam]: kit.codigoCigam.trim(),
      [COL_KIT.maxCameras]: Math.max(0, Math.round(kit.maxCameras || 0)),
      [COL_KIT.aceitaOcr]: kit.aceitaOcr,
      [COL_KIT.sinalizacao]: kit.sinalizacao,
      [COL_KIT.descricao]: kit.descricao,
      [COL_KIT.ativo]: kit.sistema ? true : kit.ativo,
      ...(kit.sistema ? {} : { [COL_KIT.modelo]: kit.modelo, [COL_KIT.ordem]: Math.round(kit.ordem || 0) })
    };
  }

  private dadosLinha(kit: string, linha: IComponenteKit, ordem: number): Record<string, unknown> {
    return {
      [COL_COMPOSICAO.nome]: `${nomeKit(kit)} — ${linha.chaveItem}`.substring(0, 200),
      [COL_COMPOSICAO.kit]: kit,
      [COL_COMPOSICAO.itemChave]: linha.chaveItem,
      [COL_COMPOSICAO.quantidade]: Number(linha.quantidade) || 0,
      [COL_COMPOSICAO.regra]: linha.regra,
      [COL_COMPOSICAO.condicao]: linha.condicao,
      [COL_COMPOSICAO.ordem]: ordem,
      [COL_COMPOSICAO.observacao]: linha.observacao || '',
      [COL_COMPOSICAO.ativo]: true
    };
  }

  public async registrarAlteracao(dados: {
    entidade: string;
    chave: string;
    acao: string;
    resumo: string;
    motivo: string;
    antes?: unknown;
    depois?: unknown;
    usuarioNome: string;
  }): Promise<void> {
    await this.dataverse.criarRegistro(TABELAS_KITS.alteracao, {
      [COL_ALTERACAO.resumo]: dados.resumo.substring(0, 200),
      [COL_ALTERACAO.entidade]: dados.entidade,
      [COL_ALTERACAO.chave]: dados.chave.substring(0, 200),
      [COL_ALTERACAO.acao]: dados.acao,
      [COL_ALTERACAO.motivo]: dados.motivo,
      [COL_ALTERACAO.detalhes]: JSON.stringify({ antes: dados.antes, depois: dados.depois }).substring(0, 100000),
      [COL_ALTERACAO.usuarioNome]: dados.usuarioNome
    });
  }

  // Cria ou atualiza um item (itens do padrão ainda não gravados são
  // criados na primeira alteração).
  public async salvarItem(
    item: IItemKit,
    anterior: IItemKit | undefined,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {

    if (item.id) {
      await this.dataverse.atualizarRegistro(TABELAS_KITS.item, item.id, this.dadosItem(item));
    } else {
      await this.dataverse.criarRegistro(TABELAS_KITS.item, this.dadosItem(item));
    }

    const acao =
      !anterior ? 'Inclusão'
        : anterior.ativo && !item.ativo ? 'Desativação'
          : !anterior.ativo && item.ativo ? 'Reativação'
            : 'Alteração';

    await this.registrarAlteracao({
      entidade: 'Item',
      chave: item.chave,
      acao,
      resumo: `${acao}: ${item.descricao}${item.codigo ? ` (${item.codigo})` : ''}`,
      motivo,
      antes: anterior,
      depois: item,
      usuarioNome
    });
  }

  public async salvarKit(
    kit: IKitParametros,
    anterior: IKitParametros,
    motivo: string,
    usuarioNome: string
  ): Promise<void> {

    if (kit.id) {
      await this.dataverse.atualizarRegistro(TABELAS_KITS.kit, kit.id, this.dadosKit(kit));
    } else {
      await this.dataverse.criarRegistro(TABELAS_KITS.kit, this.dadosKit(kit));
    }

    await this.registrarAlteracao({
      entidade: 'Kit',
      chave: kit.chave,
      acao: 'Parâmetros',
      resumo: `Parâmetros alterados: ${kit.nome}`,
      motivo,
      antes: anterior,
      depois: kit,
      usuarioNome
    });
  }

  // Grava a composição inteira de um kit:
  //   linha nova → cria; linha alterada → atualiza;
  //   linha retirada → DESATIVA (fica no histórico).
  public async salvarComposicao(
    kit: string,
    nova: IComponenteKit[],
    anterior: IComponenteKit[],
    motivo: string,
    resumo: string,
    usuarioNome: string
  ): Promise<void> {

    const idsNovos = nova.filter(l => l.id).map(l => l.id as string);

    for (let i = 0; i < nova.length; i++) {
      const linha = nova[i];
      if (linha.id) {
        await this.dataverse.atualizarRegistro(TABELAS_KITS.composicao, linha.id, this.dadosLinha(kit, linha, i));
      } else {
        await this.dataverse.criarRegistro(TABELAS_KITS.composicao, this.dadosLinha(kit, linha, i));
      }
    }

    const retiradas = anterior.filter(l => l.id && idsNovos.indexOf(l.id) < 0);
    for (const linha of retiradas) {
      await this.dataverse.atualizarRegistro(TABELAS_KITS.composicao, linha.id as string, { [COL_COMPOSICAO.ativo]: false });
    }

    await this.registrarAlteracao({
      entidade: 'Composição',
      chave: kit,
      acao: 'Composição',
      resumo: `${nomeKit(kit)}: ${resumo}`,
      motivo,
      antes: anterior.map(l => ({ chaveItem: l.chaveItem, quantidade: l.quantidade, regra: l.regra, condicao: l.condicao })),
      depois: nova.map(l => ({ chaveItem: l.chaveItem, quantidade: l.quantidade, regra: l.regra, condicao: l.condicao })),
      usuarioNome
    });
  }

  // Novo kit configurado: registro do kit + composição inicial
  // (copiada de outro kit do mesmo modelo).
  public async criarKit(
    kit: IKitParametros,
    composicao: IComponenteKit[],
    motivo: string,
    usuarioNome: string
  ): Promise<void> {

    await this.dataverse.criarRegistro(TABELAS_KITS.kit, this.dadosKit({ ...kit, sistema: false, ativo: true }));

    for (let i = 0; i < composicao.length; i++) {
      await this.dataverse.criarRegistro(TABELAS_KITS.composicao, this.dadosLinha(kit.chave, { ...composicao[i], id: undefined }, i));
    }

    await this.registrarAlteracao({
      entidade: 'Kit',
      chave: kit.chave,
      acao: 'Inclusão',
      resumo: `Novo kit: ${kit.nome} (modelo ${nomeKit(kit.modelo)})`,
      motivo,
      depois: { ...kit, composicao: composicao.map(l => ({ chaveItem: l.chaveItem, quantidade: l.quantidade, regra: l.regra, condicao: l.condicao })) },
      usuarioNome
    });
  }

  // Leva o catálogo padrão (código) para o Dataverse. Só cria o que
  // ainda não existe: pode ser executado mais de uma vez.
  public async importarPadrao(
    atual: ICatalogoKitsCarregado,
    usuarioNome: string,
    aoProgredir?: (feito: number, total: number) => void
  ): Promise<number> {

    const tarefas: Array<() => Promise<unknown>> = [];

    atual.itens
      .filter(item => !item.id)
      .forEach(item => tarefas.push(() => this.dataverse.criarRegistro(TABELAS_KITS.item, this.dadosItem(item))));

    atual.kits
      .filter(kit => !kit.id)
      .forEach(kit => tarefas.push(() => this.dataverse.criarRegistro(TABELAS_KITS.kit, this.dadosKit(kit))));

    KITS
      .filter(kit => kit.editavel && !atual.composicaoGravada[kit.chave])
      .forEach(kit => {
        (atual.composicoes[kit.chave] || []).forEach((linha, ordem) =>
          tarefas.push(() => this.dataverse.criarRegistro(TABELAS_KITS.composicao, this.dadosLinha(kit.chave, linha, ordem))));
      });

    let feito = 0;
    const lote = 5;

    for (let i = 0; i < tarefas.length; i += lote) {
      await Promise.all(tarefas.slice(i, i + lote).map(tarefa => tarefa()));
      feito = Math.min(tarefas.length, i + lote);
      if (aoProgredir) {
        aoProgredir(feito, tarefas.length);
      }
    }

    if (tarefas.length > 0) {
      await this.registrarAlteracao({
        entidade: 'Catálogo',
        chave: 'importacao',
        acao: 'Importação',
        resumo: `Catálogo padrão importado (${tarefas.length} registros)`,
        motivo: 'Carga inicial do catálogo a partir do padrão do sistema.',
        usuarioNome
      });
    }

    return tarefas.length;
  }
}

// ------------------------------------------------------------
// Uso pelo montador (Arquitetura de Soluções): carrega uma vez por
// sessão e aplica. Falhou? Fica o padrão — o montador nunca para.
// ------------------------------------------------------------

let carregamento: Promise<ICatalogoKitsCarregado | undefined> | undefined;

export const garantirCatalogoKitsAplicado = (
  dataverse?: DataverseService
): Promise<ICatalogoKitsCarregado | undefined> => {

  if (!dataverse) {
    return Promise.resolve(undefined);
  }

  if (!carregamento) {
    carregamento = new KitsService(dataverse)
      .carregar()
      .then(catalogo => {
        aplicarNoMontador(catalogo);
        return catalogo;
      })
      .catch(() => {
        carregamento = undefined;
        return undefined;
      });
  }

  return carregamento;
};

// Depois de gravar na aba Kits: a próxima leitura busca de novo.
export const invalidarCatalogoKits = (): void => {
  carregamento = undefined;
};
