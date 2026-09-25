import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  IDocumentoEvento,
  IDocumentoRevisao,
  TipoEventoDocumento
} from '../models/Documento';

// ============================================================
// HISTÓRICO DO DOCUMENTO
//
// Grava e lê eventos na tabela dgt_auditorianegocio:
//   dgt_entidade   = 'dgt_documento'
//   dgt_registroid = id do documento (minúsculo, sem chaves)
//   dgt_dadosnovos = JSON com o evento (tipo, revisão, status...)
//
// Regra do projeto: NUNCA apagar histórico. Este serviço só insere.
// ============================================================

export const ENTIDADE_HISTORICO_DOCUMENTO =
  'dgt_documento';

const ORIGEM_HISTORICO =
  'Portal DGT - Documentos';

export interface IRegistrarEventoDocumento {
  documentoId: string;
  tipo: TipoEventoDocumento;
  titulo: string;
  descricao?: string;
  revisao?: IDocumentoRevisao;
  revisaoNumero?: string;
  statusAnterior?: string;
  statusNovo?: string;
  motivo?: string;
  arquivoUrl?: string;
  dadosAnteriores?: Record<string, unknown>;
  usuarioId?: string;
  usuarioNome?: string;
}

interface IDadosEvento {
  evento?: TipoEventoDocumento;
  revisaoId?: string;
  revisao?: string;
  statusAnterior?: string;
  statusNovo?: string;
  motivo?: string;
  arquivoUrl?: string;
  usuarioNome?: string;
}

// Rótulos procurados na coluna Ação (dgt_acao, Choice). Como as opções
// podem ter sido cadastradas com nomes diferentes, tenta vários — se
// nenhum existir, usa a primeira opção disponível. O tipo exato do
// evento sempre fica gravado no JSON de dgt_dadosnovos.
const ROTULOS_ACAO:
  Record<TipoEventoDocumento, string[]> = {
  REVISAO_CRIADA:
    ['Criação', 'Criacao', 'Inclusão', 'Inclusao', 'Criar', 'Create'],
  REVISAO_EDITADA:
    ['Alteração', 'Alteracao', 'Atualização', 'Atualizacao', 'Edição', 'Update'],
  ARQUIVO_SUBSTITUIDO:
    ['Alteração', 'Alteracao', 'Atualização', 'Atualizacao', 'Update'],
  ENVIADA_APROVACAO:
    ['Envio para aprovação', 'Alteração de status', 'Alteração', 'Alteracao', 'Atualização', 'Update'],
  REPROVADA:
    ['Reprovação', 'Reprovacao', 'Rejeição', 'Alteração', 'Alteracao', 'Atualização', 'Update'],
  APROVADA_PUBLICADA:
    ['Aprovação', 'Aprovacao', 'Publicação', 'Publicacao', 'Alteração', 'Atualização', 'Update'],
  REVISAO_SUBSTITUIDA:
    ['Alteração', 'Alteracao', 'Atualização', 'Atualizacao', 'Update'],
  OUTRO:
    ['Alteração', 'Alteracao', 'Atualização', 'Update']
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const guid = (
  valor: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined || valor === null
    ? ''
    : String(valor);
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(
    registro,
    `${campo}@OData.Community.Display.V1.FormattedValue`
  );

const limitar = (
  valor: string,
  maximo: number
): string =>
  valor.length > maximo
    ? `${valor.substring(0, maximo - 1)}…`
    : valor;

export class DocumentoHistoricoService {

  private readonly dataverse:
    DataverseService;

  private opcoesAcao?:
    Promise<Array<{ value: number; label: string }>>;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ==========================================================
  // GRAVAR
  // ==========================================================

  public async registrar(
    evento: IRegistrarEventoDocumento
  ): Promise<void> {

    const documentoId =
      guid(evento.documentoId);

    if (!documentoId) {
      throw new Error(
        'Histórico: documento não informado.'
      );
    }

    const revisaoNumero =
      evento.revisaoNumero ||
      evento.revisao?.revisao ||
      '';

    const dadosNovos: IDadosEvento = {
      evento: evento.tipo,
      revisaoId: evento.revisao?.id || undefined,
      revisao: revisaoNumero || undefined,
      statusAnterior: evento.statusAnterior || undefined,
      statusNovo: evento.statusNovo || undefined,
      motivo: evento.motivo || undefined,
      arquivoUrl: evento.arquivoUrl || undefined,
      usuarioNome: evento.usuarioNome || undefined
    };

    const acao =
      await this.resolverAcao(
        evento.tipo
      );

    const registro: Record<string, unknown> = {
      dgt_name:
        limitar(
          revisaoNumero
            ? `${revisaoNumero} · ${evento.titulo}`
            : evento.titulo,
          100
        ),

      dgt_entidade:
        ENTIDADE_HISTORICO_DOCUMENTO,

      dgt_registroid:
        documentoId,

      dgt_dataevento:
        new Date().toISOString(),

      dgt_descricao:
        evento.descricao || '',

      dgt_dadosnovos:
        JSON.stringify(dadosNovos),

      dgt_origem:
        ORIGEM_HISTORICO,

      dgt_ativo:
        true
    };

    if (evento.dadosAnteriores) {
      registro.dgt_dadosanteriores =
        JSON.stringify(
          evento.dadosAnteriores
        );
    }

    if (acao !== undefined) {
      registro.dgt_acao = acao;
    }

    try {
      await this.dataverse
        .criarAuditoriaNegocio(
          registro,
          evento.usuarioId
        );
    } catch (error) {

      // Se dgt_dataevento estiver configurada como "Somente data", o
      // Dataverse recusa data com hora (erro Edm.Date). Tenta de novo
      // só com a data — a ordem exata continua em createdon.
      const mensagem =
        error instanceof Error
          ? error.message
          : '';

      if (mensagem.indexOf('Edm.Date') < 0) {
        throw error;
      }

      await this.dataverse
        .criarAuditoriaNegocio(
          {
            ...registro,
            dgt_dataevento:
              String(registro.dgt_dataevento).substring(0, 10)
          },
          evento.usuarioId
        );
    }
  }

  // Versão que nunca interrompe o fluxo principal: se a gravação do
  // histórico falhar (ex.: falta de permissão na tabela), devolve a
  // mensagem para a tela exibir como aviso.
  public async registrarSemInterromper(
    evento: IRegistrarEventoDocumento
  ): Promise<string> {

    try {
      await this.registrar(evento);
      return '';
    } catch (error) {
      console.error(
        'Falha ao gravar histórico do documento.',
        error
      );

      return (
        'A ação foi concluída, mas não foi possível gravar o evento no histórico ' +
        '(verifique a permissão de criação na tabela Auditoria de Negócio).'
      );
    }
  }

  // ==========================================================
  // LER
  // ==========================================================

  public async listar(
    documentoId: string,
    revisoes: IDocumentoRevisao[]
  ): Promise<IDocumentoEvento[]> {

    const registros =
      await this.dataverse
        .getAuditoriaNegocioPorRegistro(
          ENTIDADE_HISTORICO_DOCUMENTO,
          guid(documentoId)
        );

    const gravados =
      registros.map(
        registro =>
          this.mapear(
            registro
          )
      );

    const derivados =
      this.derivarDasRevisoes(
        revisoes,
        gravados
      );

    return [
      ...gravados,
      ...derivados
    ].sort(
      (a, b) =>
        (new Date(b.data).getTime() || 0) -
        (new Date(a.data).getTime() || 0)
    );
  }

  // ==========================================================
  // INTERNOS
  // ==========================================================

  private mapear(
    registro: IDataverseRecord
  ): IDocumentoEvento {

    let dados: IDadosEvento = {};

    try {
      dados =
        JSON.parse(
          texto(registro, 'dgt_dadosnovos') || '{}'
        ) as IDadosEvento;
    } catch {
      dados = {};
    }

    const nome =
      texto(registro, 'dgt_name');

    // O título salvo é "Rev.01 · Texto" — remove o prefixo da revisão
    // porque a tela já mostra a revisão separadamente.
    const titulo =
      dados.revisao &&
      nome.indexOf(`${dados.revisao} · `) === 0
        ? nome.substring(dados.revisao.length + 3)
        : nome;

    return {
      id:
        guid(texto(registro, 'dgt_auditorianegocioid')),

      tipo:
        dados.evento || 'OUTRO',

      titulo:
        titulo ||
        formatado(registro, 'dgt_acao') ||
        'Evento',

      descricao:
        texto(registro, 'dgt_descricao'),

      data:
        texto(registro, 'dgt_dataevento'),

      usuario:
        formatado(registro, '_dgt_usuario_value') ||
        dados.usuarioNome ||
        formatado(registro, '_createdby_value') ||
        '-',

      revisaoId:
        dados.revisaoId ? guid(dados.revisaoId) : undefined,

      revisao:
        dados.revisao,

      statusAnterior:
        dados.statusAnterior,

      statusNovo:
        dados.statusNovo,

      motivo:
        dados.motivo,

      arquivoUrl:
        dados.arquivoUrl,

      derivado:
        false
    };
  }

  // Documentos criados antes do histórico existir não têm eventos
  // gravados. Para a linha do tempo não ficar vazia, reconstrói a
  // criação e a publicação de cada revisão a partir dos seus dados.
  private derivarDasRevisoes(
    revisoes: IDocumentoRevisao[],
    gravados: IDocumentoEvento[]
  ): IDocumentoEvento[] {

    const possui = (
      revisaoId: string,
      tipo: TipoEventoDocumento
    ): boolean =>
      gravados.some(
        evento =>
          evento.revisaoId === revisaoId &&
          evento.tipo === tipo
      );

    const eventos: IDocumentoEvento[] = [];

    revisoes.forEach(
      revisao => {

        const dataCriacao =
          revisao.criadoEm ||
          revisao.dataRevisao;

        if (
          dataCriacao &&
          !possui(revisao.id, 'REVISAO_CRIADA')
        ) {
          eventos.push({
            id: `derivado-criacao-${revisao.id}`,
            tipo: 'REVISAO_CRIADA',
            titulo: 'Revisão criada',
            descricao: revisao.motivoAlteracao || '',
            data: dataCriacao,
            usuario:
              revisao.criadoPor ||
              (revisao.responsavel && revisao.responsavel !== '-'
                ? revisao.responsavel
                : '-'),
            revisaoId: revisao.id,
            revisao: revisao.revisao,
            derivado: true
          });
        }

        const vigente =
          normalizar(revisao.status) === 'vigente';

        const dataPublicacao =
          revisao.dataAprovacao ||
          revisao.dataVigencia;

        if (
          vigente &&
          dataPublicacao &&
          !possui(revisao.id, 'APROVADA_PUBLICADA')
        ) {
          eventos.push({
            id: `derivado-publicacao-${revisao.id}`,
            tipo: 'APROVADA_PUBLICADA',
            titulo: 'Revisão aprovada e publicada',
            descricao:
              revisao.requerRetreinamento
                ? 'Publicada com retreinamento obrigatório.'
                : revisao.justificativa
                  ? `Sem retreinamento. Justificativa: ${revisao.justificativa}`
                  : 'Publicada sem retreinamento.',
            data: dataPublicacao,
            usuario:
              revisao.aprovadoPor && revisao.aprovadoPor !== '-'
                ? revisao.aprovadoPor
                : '-',
            revisaoId: revisao.id,
            revisao: revisao.revisao,
            statusNovo: 'Vigente',
            derivado: true
          });
        }
      }
    );

    return eventos;
  }

  private async resolverAcao(
    tipo: TipoEventoDocumento
  ): Promise<number | undefined> {

    try {

      if (!this.opcoesAcao) {
        this.opcoesAcao =
          this.dataverse.getChoiceOptions(
            'dgt_auditorianegocio',
            'dgt_acao'
          );
      }

      const opcoes =
        await this.opcoesAcao;

      if (opcoes.length === 0) {
        return undefined;
      }

      const candidatos =
        ROTULOS_ACAO[tipo] ||
        ROTULOS_ACAO.OUTRO;

      for (const candidato of candidatos) {

        const encontrado =
          opcoes.find(
            opcao =>
              normalizar(opcao.label) ===
              normalizar(candidato)
          );

        if (encontrado) {
          return encontrado.value;
        }
      }

      return opcoes[0].value;

    } catch (error) {
      // Se não conseguir ler as opções, limpa o cache para tentar de
      // novo na próxima gravação.
      this.opcoesAcao = undefined;

      console.warn(
        'Histórico: não foi possível ler as opções de dgt_acao.',
        error
      );

      return undefined;
    }
  }
}
