import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// REGISTROS DE OPORTUNIDADE (RO) — Arquitetura de Soluções
//
// Tabela existente dgt_bom_ro, ampliada por scripts/dataverse/atualizar-registros-oportunidade.ps1.
// Uma linha por RO, de todos os fabricantes (antes: uma aba por
// fabricante na planilha de controle de Pré-vendas).
// ============================================================

export const TABELA_RO = 'dgt_bom_ro';

const C = {
  id: 'dgt_bom_roid',
  numero: 'dgt_name',
  fabricante: 'dgt_bom_fabricante',
  oportunidadeCrm: 'dgt_bom_oportunidadecrm',
  dataCriacao: 'dgt_bom_datacriacaoro',
  projeto: 'dgt_bom_projeto',
  valor: 'dgt_bom_valor',
  modalidade: 'dgt_bom_modalidade',
  situacao: 'dgt_bom_situacao',
  observacao: 'dgt_bom_observacao',
  executivo: 'dgt_bom_executivo',
  editalPregao: 'dgt_bom_editalpregao',
  statusRo: 'dgt_bom_statusro',
  dataAtualizacao: 'dgt_bom_dataatualizacao',
  validade: 'dgt_bom_validade',
  vinculo: 'dgt_bom_vinculo',
  ativo: 'dgt_bom_ativo'
};

// Rótulos usados no histórico de alterações (auditoria)
export const ROTULO_CAMPO: { [campo: string]: string } = {
  [C.numero]: 'Nº do RO',
  [C.fabricante]: 'Fabricante',
  dgt_bom_numeroprojeto: 'Nº do projeto no fabricante',
  [C.oportunidadeCrm]: 'Número da oportunidade no CRM',
  [C.dataCriacao]: 'Criação do RO',
  [C.projeto]: 'Cliente / projeto',
  [C.valor]: 'Valor',
  [C.modalidade]: 'Modalidade',
  [C.situacao]: 'Situação',
  [C.observacao]: 'Observações',
  [C.executivo]: 'Executivo',
  [C.editalPregao]: 'Edital / pregão',
  [C.statusRo]: 'Status do RO',
  [C.dataAtualizacao]: 'Última atualização',
  [C.validade]: 'Validade',
  [C.vinculo]: 'Substituição',
  [C.ativo]: 'Registro ativo'
};

export const FABRICANTES = [
  'Intelbras',
  'Hikvision',
  'Dahua',
  'TP-Link',
  'NHS',
  'Milestone',
  'Digifort',
  'IPX',
  'Axxon'
];

export const STATUS_RO = ['Ativo', 'Avaliação de RO', 'Perdido', 'Concluída'];

export const SITUACOES = ['Em negociação', 'Em implantação', 'Suspenso', 'Em faturamento', 'Em construção', 'Anulado'];

export const EXECUTIVOS_RO = [
  'Eder Zimmer', 'Daniel Neque', 'Lucas Muller', 'Waleska Silva', 'Mateus Moura',
  'Marcelo Silva', 'Karine Schuster', 'Daiana Hoffmeister', 'Aderson Heinen',
  'Richard Souza', 'Valdoir Damazio'
];

const TABELA_VALIDADE = 'dgt_bom_rovalidade';
const ID_VALIDADE = '01fcdb80-5523-4a0e-95de-49376c9e3868';
const CAMPO_PRAZOS = 'dgt_bom_prazos';

export type IPrazosRo = Record<string, number>;

export const PRAZOS_PADRAO: IPrazosRo = { '': 30, Intelbras: 26, NHS: 180 };

const prazoValido = (dias: number): boolean => Number.isInteger(dias) && dias > 0 && dias <= 36500;

export const sugerirValidade = (criacao: string, fabricante: string, prazos: IPrazosRo): string => {
  const data = new Date(`${criacao}T00:00:00Z`);
  if (isNaN(data.getTime())) return '';
  data.setUTCDate(data.getUTCDate() + (prazos[fabricante] ?? prazos[''] ?? PRAZOS_PADRAO['']));
  const resultado = data.toISOString().slice(0, 10);
  return resultado.length === 10 && resultado.charAt(0) !== '+' ? resultado : '';
};

export const MODALIDADES = [
  'Edital',
  'Pré-edital',
  'Adesão à Ata',
  'Dispensa',
  'Chamamento público',
  'Projeto privado'
];

export interface IRegistroOportunidade {
  id: string;
  numero: string;
  fabricante: string;
  oportunidadeCrm: string;
  dataCriacao: string;      // yyyy-mm-dd
  projeto: string;
  valor?: number;
  modalidade: string;
  situacao: string;
  observacao: string;
  executivo: string;
  editalPregao: string;
  statusRo: string;
  dataAtualizacao: string;  // yyyy-mm-dd
  validade: string;         // yyyy-mm-dd
  vinculo: string;
  ativo: boolean;
  criadoEm: string;
  criadoPor: string;
  alteradoEm: string;
  alteradoPor: string;
}

export type IRoEdicao =
  Omit<IRegistroOportunidade, 'id' | 'criadoEm' | 'criadoPor' | 'alteradoEm' | 'alteradoPor'> & { id?: string };

export interface IAlteracaoRo {
  data: string;
  usuario: string;
  acao: string;
  campos: { campo: string; antes: string; depois: string }[];
}

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const formatado = (r: IDataverseRecord, campo: string): string =>
  texto(r, `${campo}@OData.Community.Display.V1.FormattedValue`);

const soData = (valor: string): string =>
  valor ? valor.substring(0, 10) : '';

export const hojeIso = (): string => {
  const d = new Date();
  const mm = ('0' + String(d.getMonth() + 1)).slice(-2);
  const dd = ('0' + String(d.getDate())).slice(-2);
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export class RoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  public async listarPrazos(): Promise<{ prazos: IPrazosRo; etag: string }> {
    const configuracao = await this.dataverse.obterRegistro(TABELA_VALIDADE, ID_VALIDADE, [CAMPO_PRAZOS]);
    if (!configuracao) throw new Error('O registro de configuração de validade precisa ser provisionado.');
    const prazos = { ...PRAZOS_PADRAO, ...JSON.parse(texto(configuracao.registro, CAMPO_PRAZOS) || '{}') } as IPrazosRo;
    if (!Object.keys(prazos).every(fabricante => prazoValido(prazos[fabricante]))) {
      throw new Error('A configuração contém um prazo inválido.');
    }
    return { prazos, etag: configuracao.etag };
  }

  public async salvarPrazos(prazos: IPrazosRo, etag: string): Promise<void> {
    if (!Object.keys(prazos).every(fabricante => prazoValido(prazos[fabricante]))) {
      throw new Error('Informe prazos inteiros entre 1 e 36.500 dias.');
    }
    await this.dataverse.atualizarRegistro(TABELA_VALIDADE, ID_VALIDADE, {
      [CAMPO_PRAZOS]: JSON.stringify(prazos)
    }, etag);
  }

  public async listar(): Promise<IRegistroOportunidade[]> {

    const registros =
      await this.dataverse.listarRegistros(
        TABELA_RO,
        '$select=' +
        [C.id, C.numero, C.fabricante, C.oportunidadeCrm, C.dataCriacao, C.projeto, C.valor,
          C.modalidade, C.situacao, C.observacao, C.executivo, C.editalPregao, C.statusRo,
          C.dataAtualizacao, C.validade, C.vinculo, C.ativo,
          'createdon', 'modifiedon', '_createdby_value', '_modifiedby_value'].join(',')
      );

    return registros.map(r => {
      const valor = r[C.valor];
      return {
        id: texto(r, C.id),
        numero: texto(r, C.numero),
        fabricante: texto(r, C.fabricante),
        oportunidadeCrm: texto(r, C.oportunidadeCrm),
        dataCriacao: soData(texto(r, C.dataCriacao)),
        projeto: texto(r, C.projeto),
        valor: valor === null || valor === undefined || valor === '' ? undefined : Number(valor),
        modalidade: texto(r, C.modalidade),
        situacao: texto(r, C.situacao) || SITUACOES[0],
        observacao: texto(r, C.observacao),
        executivo: texto(r, C.executivo),
        editalPregao: texto(r, C.editalPregao),
        statusRo: texto(r, C.statusRo) || 'Ativo',
        dataAtualizacao: soData(texto(r, C.dataAtualizacao)),
        validade: soData(texto(r, C.validade)),
        vinculo: texto(r, C.vinculo),
        ativo: r[C.ativo] !== false,
        criadoEm: texto(r, 'createdon'),
        criadoPor: formatado(r, '_createdby_value'),
        alteradoEm: texto(r, 'modifiedon'),
        alteradoPor: formatado(r, '_modifiedby_value')
      };
    });
  }

  public async salvar(dados: IRoEdicao): Promise<void> {

    const numero = (dados.numero || '').trim();

    if (!numero) {
      throw new Error('Informe o número do RO.');
    }

    if (!dados.fabricante) {
      throw new Error('Informe o fabricante.');
    }

    const registro: Record<string, unknown> = {
      [C.numero]: numero.substring(0, 200),
      [C.fabricante]: dados.fabricante,
      [C.oportunidadeCrm]: dados.oportunidadeCrm.trim().substring(0, 100),
      [C.dataCriacao]: dados.dataCriacao || null,
      [C.projeto]: dados.projeto.trim(),
      [C.valor]: dados.valor === undefined || isNaN(dados.valor) ? null : Math.round(dados.valor * 100) / 100,
      [C.modalidade]: dados.modalidade,
      [C.situacao]: dados.situacao,
      [C.observacao]: dados.observacao.trim(),
      [C.executivo]: dados.executivo.trim(),
      [C.editalPregao]: dados.editalPregao.trim(),
      [C.statusRo]: dados.statusRo,
      [C.dataAtualizacao]: dados.dataAtualizacao || null,
      [C.validade]: dados.validade || null,
      [C.vinculo]: dados.vinculo.trim(),
      [C.ativo]: dados.ativo
    };

    if (dados.id) {
      await this.dataverse.atualizarRegistro(TABELA_RO, dados.id, registro);
    } else {
      await this.dataverse.criarRegistro(TABELA_RO, registro);
    }
  }

  public async marcarAtualizado(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELA_RO, id, { [C.dataAtualizacao]: hojeIso() });
  }

  public async definirAtivo(id: string, ativo: boolean): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELA_RO, id, { [C.ativo]: ativo });
  }

  // Histórico (auditoria do Dataverse). Exige a auditoria ligada na
  // organização e na tabela, e permissão "Exibir histórico de
  // auditoria" para quem consulta.
  public async historico(id: string): Promise<IAlteracaoRo[]> {

    const registros =
      await this.dataverse.listarRegistros(
        'audit',
        '$select=action,createdon,changedata,_userid_value' +
        `&$filter=_objectid_value eq ${id.replace(/[{}]/g, '')}` +
        '&$orderby=createdon desc&$top=50'
      );

    return registros.map(r => {
      let campos: { campo: string; antes: string; depois: string }[] = [];

      try {
        const dados = JSON.parse(texto(r, 'changedata') || '{}') as {
          changedAttributes?: { logicalName: string; oldValue?: unknown; newValue?: unknown }[];
        };

        campos =
          (dados.changedAttributes || [])
            .filter(item => !!ROTULO_CAMPO[item.logicalName])
            .map(item => ({
              campo: ROTULO_CAMPO[item.logicalName],
              antes: item.oldValue === undefined || item.oldValue === null ? '' : String(item.oldValue),
              depois: item.newValue === undefined || item.newValue === null ? '' : String(item.newValue)
            }));
      } catch {
        campos = [];
      }

      return {
        data: texto(r, 'createdon'),
        usuario: formatado(r, '_userid_value') || '—',
        acao: formatado(r, 'action') || texto(r, 'action'),
        campos
      };
    });
  }
}
