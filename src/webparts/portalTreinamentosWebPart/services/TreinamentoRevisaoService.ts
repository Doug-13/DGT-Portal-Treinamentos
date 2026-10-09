import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ============================================================
// REVISÕES DE TREINAMENTO
//
// Tabela dgt_treinamentorevisao, criada por
// scripts/dataverse/criar-tabela-revisoes-treinamento.ps1
// (os nomes abaixo DEVEM continuar iguais aos do script).
//
// Conceito (mesmo da gestão documental):
//   Treinamento = identidade permanente
//   Revisão     = versão do treinamento (Rev.00 é o original)
//   Atribuição  = evidência de que a pessoa foi treinada
//
// Regras:
//   • Publicar uma revisão NUNCA altera nem apaga conclusões,
//     notas ou certificados anteriores.
//   • "Exige retreinamento" = SIM → cada pessoa que já concluiu
//     ganha uma NOVA atribuição (origem "Revisão de treinamento",
//     OrigemId = id da revisão). A conclusão anterior fica no
//     histórico.
//   • "Exige retreinamento" = NÃO → as conclusões continuam
//     válidas; a justificativa fica registrada.
//   • A revisão em que a pessoa foi treinada é deduzida pela
//     data de conclusão (última revisão vigente até aquela data).
//     Por isso não é preciso gravar nada no registro antigo.
// ============================================================

export const TABELA_REVISAO_TREINAMENTO = 'dgt_treinamentorevisao';

export const ORIGEM_REVISAO_TREINAMENTO = 'Revisão de treinamento';

const C = {
  id: 'dgt_treinamentorevisaoid',
  nome: 'dgt_name',
  treinamento: '_dgt_treinamento_value',
  treinamentoBind: 'dgt_Treinamento@odata.bind',
  numero: 'dgt_numero',
  vigencia: 'dgt_datavigencia',
  motivo: 'dgt_motivo',
  alteracoes: 'dgt_descricaoalteracoes',
  retreinar: 'dgt_requerretreinamento',
  justificativa: 'dgt_justificativa',
  prazoDias: 'dgt_prazodias',
  impactados: 'dgt_usuariosimpactados',
  atribuidos: 'dgt_atribuicoescriadas',
  responsavel: 'dgt_responsavelnome'
};

export interface IRevisaoTreinamento {
  id: string;
  treinamentoId: string;
  numero: number;
  rotulo: string;
  vigencia: string;
  motivo: string;
  alteracoes: string;
  requerRetreinamento: boolean;
  justificativa: string;
  prazoDias?: number;
  usuariosImpactados?: number;
  atribuicoesCriadas?: number;
  responsavel: string;
  registradaEm: string;
}

export interface IPessoaImpactada {
  usuarioId: string;
  nome: string;
  dataConclusao: string;
}

export interface IImpactoRevisao {
  concluidos: IPessoaImpactada[];
  emAndamento: number;
}

export interface INovaRevisao {
  treinamentoId: string;
  treinamentoCodigo: string;
  motivo: string;
  alteracoes: string;
  requerRetreinamento: boolean;
  justificativa: string;
  prazoDias?: number;
  responsavel: string;
}

export interface IResultadoRevisao {
  revisao: IRevisaoTreinamento;
  impactados: number;
  criados: number;
  jaExistiam: number;
  falhas: string[];
}

export const rotuloRevisao = (numero: number): string =>
  `Rev.${numero < 10 ? '0' : ''}${Math.max(0, Math.floor(numero))}`;

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const ehGuid = (valor: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

const texto = (r: IDataverseRecord, campo: string): string => {
  const v = r[campo];
  return v === undefined || v === null ? '' : String(v).trim();
};

const numeroOu = (r: IDataverseRecord, campo: string): number | undefined => {
  const v = r[campo];
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  const n = Number(v);
  return isNaN(n) ? undefined : n;
};

const formatado = (r: IDataverseRecord, campo: string): string =>
  texto(r, `${campo}@OData.Community.Display.V1.FormattedValue`);

const mapear = (r: IDataverseRecord): IRevisaoTreinamento => {
  const numero = numeroOu(r, C.numero) || 0;
  return {
    id: guid(r[C.id]),
    treinamentoId: guid(r[C.treinamento]),
    numero,
    rotulo: rotuloRevisao(numero),
    vigencia: texto(r, C.vigencia) || texto(r, 'createdon'),
    motivo: texto(r, C.motivo),
    alteracoes: texto(r, C.alteracoes),
    requerRetreinamento: r[C.retreinar] === true,
    justificativa: texto(r, C.justificativa),
    prazoDias: numeroOu(r, C.prazoDias),
    usuariosImpactados: numeroOu(r, C.impactados),
    atribuicoesCriadas: numeroOu(r, C.atribuidos),
    responsavel: texto(r, C.responsavel) || formatado(r, '_createdby_value') || '-',
    registradaEm: texto(r, 'createdon')
  };
};

const SELECT_REVISAO =
  '$select=' +
  [C.id, C.nome, C.treinamento, C.numero, C.vigencia, C.motivo, C.alteracoes,
    C.retreinar, C.justificativa, C.prazoDias, C.impactados, C.atribuidos,
    C.responsavel, 'createdon', '_createdby_value'].join(',');

// Erro de tabela inexistente (script ainda não executado).
export const ehTabelaRevisaoInexistente = (erro: unknown): boolean => {
  const m = erro instanceof Error ? erro.message : String(erro || '');
  return /\b404\b|0x80060888|could not find|does not exist|não localizado/i.test(m);
};

// Revisão vigente numa data (Rev.00 se não houver revisões até ela).
export const revisaoNaData = (
  revisoes: IRevisaoTreinamento[],
  dataIso: string
): string => {

  const data = new Date(dataIso);

  if (!dataIso || isNaN(data.getTime())) {
    return revisoes.length > 0
      ? revisoes.reduce((a, b) => (b.numero > a.numero ? b : a)).rotulo
      : rotuloRevisao(0);
  }

  const validas = revisoes.filter(r => {
    const v = new Date(r.vigencia);
    return !isNaN(v.getTime()) && v.getTime() <= data.getTime();
  });

  return validas.length > 0
    ? validas.reduce((a, b) => (b.numero > a.numero ? b : a)).rotulo
    : rotuloRevisao(0);
};

export class TreinamentoRevisaoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // { treinamentoId → revisões (mais recente primeiro) }
  public async listarPorTreinamento(
    treinamentoIds?: string[]
  ): Promise<Record<string, IRevisaoTreinamento[]>> {

    let filtro = '';

    if (treinamentoIds) {
      const ids = treinamentoIds
        .map(guid)
        .filter(ehGuid)
        .filter((id, i, lista) => lista.indexOf(id) === i);

      if (ids.length === 0) {
        return {};
      }

      // Lotes de 25 para não estourar o tamanho da URL.
      const registros: IDataverseRecord[] = [];
      for (let i = 0; i < ids.length; i += 25) {
        const lote = ids.slice(i, i + 25);
        filtro =
          '&$filter=statecode eq 0 and (' +
          lote.map(id => `${C.treinamento} eq ${id}`).join(' or ') +
          ')';
        (await this.dataverse.listarRegistros(
          TABELA_REVISAO_TREINAMENTO,
          `${SELECT_REVISAO}${filtro}&$orderby=${C.numero} desc`
        )).forEach(r => registros.push(r));
      }
      return this.agrupar(registros);
    }

    return this.agrupar(
      await this.dataverse.listarRegistros(
        TABELA_REVISAO_TREINAMENTO,
        `${SELECT_REVISAO}&$filter=statecode eq 0&$orderby=${C.numero} desc`
      )
    );
  }

  public async listar(treinamentoId: string): Promise<IRevisaoTreinamento[]> {
    const mapa = await this.listarPorTreinamento([treinamentoId]);
    return mapa[guid(treinamentoId)] || [];
  }

  // Quem já concluiu o treinamento (última situação de cada pessoa).
  public async analisarImpacto(
    treinamentoId: string
  ): Promise<IImpactoRevisao> {

    const id = guid(treinamentoId);

    const registros = await this.dataverse.listarRegistros(
      'dgt_usuariotreinamento',
      '$select=dgt_usuariotreinamentoid,_dgt_usuario_value,dgt_status,dgt_dataconclusao,dgt_ativo,createdon' +
      `&$filter=_dgt_treinamento_value eq ${id}`
    );

    const porUsuario: Record<string, IDataverseRecord[]> = {};

    registros
      .filter(r => r.dgt_ativo !== false)
      .forEach(r => {
        const usuario = guid(r._dgt_usuario_value);
        if (usuario) {
          (porUsuario[usuario] = porUsuario[usuario] || []).push(r);
        }
      });

    const concluido = (r: IDataverseRecord): boolean =>
      !!texto(r, 'dgt_dataconclusao') ||
      /conclu/i.test(formatado(r, 'dgt_status'));

    const concluidos: IPessoaImpactada[] = [];
    let emAndamento = 0;

    Object.keys(porUsuario).forEach(usuario => {
      const lista = porUsuario[usuario];
      const pendente = lista.some(r => !concluido(r));

      if (pendente) {
        // Já tem uma atribuição em aberto: fará o conteúdo novo.
        emAndamento++;
        return;
      }

      const ultima = lista
        .slice()
        .sort((a, b) =>
          texto(b, 'dgt_dataconclusao').localeCompare(texto(a, 'dgt_dataconclusao')))[0];

      concluidos.push({
        usuarioId: usuario,
        nome: formatado(ultima, '_dgt_usuario_value') || 'Colaborador',
        dataConclusao: texto(ultima, 'dgt_dataconclusao')
      });
    });

    concluidos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return { concluidos, emAndamento };
  }

  public async publicar(
    dados: INovaRevisao,
    aoProgredir?: (mensagem: string) => void
  ): Promise<IResultadoRevisao> {

    const treinamentoId = guid(dados.treinamentoId);

    if (!ehGuid(treinamentoId)) {
      throw new Error('Treinamento inválido.');
    }

    if ((dados.motivo || '').trim().length < 5) {
      throw new Error('Informe o motivo da revisão.');
    }

    if ((dados.alteracoes || '').trim().length < 5) {
      throw new Error('Descreva o que mudou no treinamento.');
    }

    if (!dados.requerRetreinamento && (dados.justificativa || '').trim().length < 5) {
      throw new Error('Justifique por que os colaboradores já treinados não precisam refazer o treinamento.');
    }

    const anteriores = await this.listar(treinamentoId);
    const numero = anteriores.reduce((max, r) => Math.max(max, r.numero), 0) + 1;
    const rotulo = rotuloRevisao(numero);

    // Impacto calculado ANTES de gravar a revisão.
    const impacto = dados.requerRetreinamento
      ? await this.analisarImpacto(treinamentoId)
      : { concluidos: [], emAndamento: 0 };

    if (aoProgredir) {
      aoProgredir(`Registrando ${rotulo}…`);
    }

    const agora = new Date().toISOString();
    const referencia = await this.dataverse.referenciaLookup('dgt_treinamento', treinamentoId);

    const revisaoId = await this.dataverse.criarRegistro(
      TABELA_REVISAO_TREINAMENTO,
      {
        [C.nome]: `${dados.treinamentoCodigo || 'Treinamento'} ${rotulo}`.substring(0, 200),
        [C.treinamentoBind]: referencia,
        [C.numero]: numero,
        [C.vigencia]: agora,
        [C.motivo]: dados.motivo.trim().substring(0, 4000),
        [C.alteracoes]: dados.alteracoes.trim().substring(0, 4000),
        [C.retreinar]: dados.requerRetreinamento,
        [C.justificativa]: (dados.justificativa || '').trim().substring(0, 4000),
        [C.prazoDias]: dados.requerRetreinamento && dados.prazoDias ? Math.round(dados.prazoDias) : null,
        [C.impactados]: impacto.concluidos.length,
        [C.responsavel]: (dados.responsavel || '').substring(0, 200)
      }
    );

    let criados = 0;
    let jaExistiam = 0;
    const falhas: string[] = [];

    if (dados.requerRetreinamento) {

      let dataLimite = '';
      if (dados.prazoDias && dados.prazoDias > 0) {
        const limite = new Date();
        limite.setDate(limite.getDate() + dados.prazoDias);
        dataLimite = limite.toISOString().substring(0, 10);
      }

      for (let i = 0; i < impacto.concluidos.length; i++) {
        const pessoa = impacto.concluidos[i];

        if (aoProgredir) {
          aoProgredir(`Atribuindo retreinamento ${i + 1} de ${impacto.concluidos.length}…`);
        }

        try {
          const retorno = await this.dataverse.processarAtribuicao({
            UsuarioId: pessoa.usuarioId,
            TreinamentoId: treinamentoId,
            TrilhaId: '',
            Origem: ORIGEM_REVISAO_TREINAMENTO,
            OrigemId: revisaoId,
            DataLimite: dataLimite,
            Observacao: `Retreinamento pela ${rotulo}: ${dados.motivo.trim()}`.substring(0, 2000)
          });

          if (retorno.criado) {
            criados++;
          } else {
            jaExistiam++;
          }
        } catch (e) {
          falhas.push(`${pessoa.nome}: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
        }
      }

      try {
        await this.dataverse.atualizarRegistro(
          TABELA_REVISAO_TREINAMENTO,
          revisaoId,
          { [C.atribuidos]: criados }
        );
      } catch {
        // O contador é informativo; a revisão já está registrada.
      }
    }

    return {
      revisao: {
        id: revisaoId,
        treinamentoId,
        numero,
        rotulo,
        vigencia: agora,
        motivo: dados.motivo.trim(),
        alteracoes: dados.alteracoes.trim(),
        requerRetreinamento: dados.requerRetreinamento,
        justificativa: (dados.justificativa || '').trim(),
        prazoDias: dados.prazoDias,
        usuariosImpactados: impacto.concluidos.length,
        atribuicoesCriadas: criados,
        responsavel: dados.responsavel || 'Você',
        registradaEm: agora
      },
      impactados: impacto.concluidos.length,
      criados,
      jaExistiam,
      falhas
    };
  }

  private agrupar(
    registros: IDataverseRecord[]
  ): Record<string, IRevisaoTreinamento[]> {

    const mapa: Record<string, IRevisaoTreinamento[]> = {};

    registros.map(mapear).forEach(r => {
      (mapa[r.treinamentoId] = mapa[r.treinamentoId] || []).push(r);
    });

    Object.keys(mapa).forEach(id =>
      mapa[id].sort((a, b) => b.numero - a.numero)
    );

    return mapa;
  }
}
