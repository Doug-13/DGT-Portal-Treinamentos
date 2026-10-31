import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  STATUS_USUARIO_TREINAMENTO
} from '../constants/dataverseChoices';

// ============================================================
// ATRIBUIÇÕES DE UM TREINAMENTO
//
// - Lista todas as pessoas atribuídas a um treinamento
//   (dgt_usuariotreinamento), inclusive as já removidas.
// - Remove uma atribuição SEM APAGAR o registro:
//     dgt_ativo = Não, dgt_liberado = Não, dgt_status = Cancelado.
//   O portal já esconde atribuições com dgt_ativo = Não, e a
//   Custom API dgt_ProcessarAtribuicao ignora as inativas na
//   verificação de duplicidade — então é possível atribuir de
//   novo depois, gerando um registro novo.
// - Atribuição concluída NÃO pode ser removida: ela é a evidência
//   de capacitação e sustenta o certificado.
// ============================================================

export interface IAtribuicaoTreinamento {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioEmail: string;
  status: string;
  statusValor: number;
  liberado: boolean;
  ativo: boolean;
  origem: string;
  trilha: string;
  dataAtribuicao: string;
  dataLimite: string;
  dataConclusao: string;
  dataValidade: string;
  nota?: number;
  revisaoTreinada: string;
  // true quando a atribuição é evidência de conclusão.
  concluida: boolean;
}

export interface IRemocaoAtribuicao {
  atribuicaoId: string;
  motivo: string;
  responsavelId?: string;
  responsavelNome?: string;
  treinamentoNome?: string;
}

const FORMATADO =
  '@OData.Community.Display.V1.FormattedValue';

const guid = (
  valor?: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: IDataverseRecord,
  campo: string
): string => {
  const valor = registro[campo];

  return valor === undefined ||
    valor === null
    ? ''
    : String(valor);
};

const formatado = (
  registro: IDataverseRecord,
  campo: string
): string =>
  texto(
    registro,
    `${campo}${FORMATADO}`
  );

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao: boolean
): boolean => {
  const valor = registro[campo];

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 1 || valor === '1' || valor === 'true') {
    return true;
  }

  if (valor === 0 || valor === '0' || valor === 'false') {
    return false;
  }

  return padrao;
};

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Mesma regra usada no portal (PortalTreinamentos.tsx).
const rotuloStatus = (
  statusValor: number,
  statusTexto: string,
  liberado: boolean,
  ativo: boolean
): string => {

  if (!ativo) {
    return 'Removido';
  }

  const s =
    normalizar(statusTexto);

  if (
    statusValor === STATUS_USUARIO_TREINAMENTO.CONCLUIDO ||
    s.indexOf('conclu') >= 0 ||
    s.indexOf('aprov') >= 0
  ) {
    return 'Concluído';
  }

  if (s.indexOf('reprov') >= 0) {
    return 'Reprovado';
  }

  if (s.indexOf('venc') >= 0) {
    return 'Vencido';
  }

  if (s.indexOf('cancel') >= 0) {
    return 'Cancelado';
  }

  if (
    s.indexOf('andamento') >= 0 ||
    s.indexOf('iniciado') >= 0
  ) {
    return 'Em andamento';
  }

  if (
    s.indexOf('bloque') >= 0 ||
    !liberado
  ) {
    return 'Bloqueado';
  }

  return 'Disponível';
};

const SELECT_ATRIBUICAO = [
  'dgt_usuariotreinamentoid',
  '_dgt_usuario_value',
  '_dgt_treinamento_value',
  '_dgt_trilha_value',
  'dgt_status',
  'dgt_liberado',
  'dgt_ativo',
  'dgt_origem',
  'dgt_dataatribuicao',
  'dgt_datalimite',
  'dgt_dataconclusao',
  'dgt_datavalidade',
  'dgt_nota',
  'dgt_revisaotreinada',
  'createdon'
];

export class AtribuicoesTreinamentoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  // ----------------------------------------------------------
  // LISTAR
  // ----------------------------------------------------------

  public async listarPorTreinamento(
    treinamentoId: string
  ): Promise<IAtribuicaoTreinamento[]> {

    const id =
      guid(treinamentoId);

    if (!id) {
      return [];
    }

    const [
      registros,
      usuarios
    ] =
      await Promise.all([
        this.dataverse.listarRegistros(
          'dgt_usuariotreinamento',
          `$select=${SELECT_ATRIBUICAO.join(',')}` +
          `&$filter=_dgt_treinamento_value eq ${id}`
        ),
        // E-mail é só complemento: se falhar, a lista sai sem ele.
        this.dataverse
          .getUsuarios()
          .catch(
            (): IDataverseRecord[] => []
          )
      ]);

    const emails: Record<string, string> = {};

    usuarios.forEach(
      usuario => {
        emails[
          guid(usuario.dgt_usuarioid)
        ] = texto(usuario, 'dgt_email');
      }
    );

    return registros
      .map(
        registro => {

          const statusValor =
            Number(
              registro.dgt_status
            );

          const liberado =
            booleano(
              registro,
              'dgt_liberado',
              true
            );

          const ativo =
            booleano(
              registro,
              'dgt_ativo',
              true
            );

          const usuarioId =
            guid(
              registro._dgt_usuario_value
            );

          const dataConclusao =
            texto(
              registro,
              'dgt_dataconclusao'
            );

          const status =
            rotuloStatus(
              statusValor,
              formatado(registro, 'dgt_status'),
              liberado,
              ativo
            );

          const notaBruta =
            registro.dgt_nota;

          return {
            id:
              guid(
                registro.dgt_usuariotreinamentoid
              ),
            usuarioId,
            usuarioNome:
              formatado(
                registro,
                '_dgt_usuario_value'
              ) || 'Usuário',
            usuarioEmail:
              emails[usuarioId] || '',
            status,
            statusValor,
            liberado,
            ativo,
            origem:
              formatado(
                registro,
                'dgt_origem'
              ) || '-',
            trilha:
              formatado(
                registro,
                '_dgt_trilha_value'
              ) || '',
            dataAtribuicao:
              texto(registro, 'dgt_dataatribuicao') ||
              texto(registro, 'createdon'),
            dataLimite:
              texto(registro, 'dgt_datalimite'),
            dataConclusao,
            dataValidade:
              texto(registro, 'dgt_datavalidade'),
            nota:
              notaBruta === undefined ||
              notaBruta === null ||
              notaBruta === ''
                ? undefined
                : Number(notaBruta),
            revisaoTreinada:
              texto(registro, 'dgt_revisaotreinada'),
            concluida:
              statusValor === STATUS_USUARIO_TREINAMENTO.CONCLUIDO ||
              !!dataConclusao
          };
        }
      )
      .sort(
        (a, b) =>
          a.usuarioNome.localeCompare(
            b.usuarioNome,
            'pt-BR'
          )
      );
  }

  // ----------------------------------------------------------
  // REMOVER (desativar, nunca apagar)
  // ----------------------------------------------------------

  public async remover(
    dados: IRemocaoAtribuicao
  ): Promise<{ avisoAuditoria: string }> {

    const id =
      guid(dados.atribuicaoId);

    const motivo =
      (dados.motivo || '').trim();

    if (!id) {
      throw new Error(
        'Atribuição não informada.'
      );
    }

    if (motivo.length < 5) {
      throw new Error(
        'Informe o motivo da remoção (mínimo de 5 caracteres).'
      );
    }

    // Relê o registro: alguém pode ter concluído o treinamento
    // depois que a lista foi aberta.
    const atual =
      await this.dataverse.obterRegistro(
        'dgt_usuariotreinamento',
        id,
        SELECT_ATRIBUICAO
      );

    if (!atual) {
      throw new Error(
        'A atribuição não foi encontrada. Atualize a lista.'
      );
    }

    const registro =
      atual.registro;

    if (
      !booleano(
        registro,
        'dgt_ativo',
        true
      )
    ) {
      throw new Error(
        'Esta atribuição já foi removida.'
      );
    }

    if (
      Number(registro.dgt_status) ===
        STATUS_USUARIO_TREINAMENTO.CONCLUIDO ||
      !!texto(registro, 'dgt_dataconclusao')
    ) {
      throw new Error(
        'Atribuição concluída não pode ser removida: ela é a evidência do treinamento e mantém o certificado do colaborador.'
      );
    }

    const anteriores = {
      status:
        formatado(registro, 'dgt_status') ||
        texto(registro, 'dgt_status'),
      liberado:
        booleano(registro, 'dgt_liberado', true),
      ativo:
        true
    };

    // Tenta gravar também o status Cancelado. Se a opção não existir
    // no campo dgt_status deste ambiente, grava só a desativação —
    // que é o que efetivamente tira o treinamento da tela.
    try {

      await this.dataverse.atualizarRegistro(
        'dgt_usuariotreinamento',
        id,
        {
          dgt_ativo: false,
          dgt_liberado: false,
          dgt_status:
            STATUS_USUARIO_TREINAMENTO.CANCELADO
        },
        atual.etag || undefined
      );

    } catch (erro) {

      const codigo =
        (erro as { codigo?: string }).codigo;

      if (codigo === 'CONFLITO') {
        throw erro;
      }

      console.warn(
        '[Atribuições] Não foi possível gravar o status Cancelado; gravando apenas a desativação.',
        erro
      );

      await this.dataverse.atualizarRegistro(
        'dgt_usuariotreinamento',
        id,
        {
          dgt_ativo: false,
          dgt_liberado: false
        }
      );
    }

    // Auditoria de negócio: não interrompe a remoção se falhar.
    let avisoAuditoria = '';

    try {

      const usuarioNome =
        formatado(registro, '_dgt_usuario_value') ||
        'Usuário';

      const auditoria: Record<string, unknown> = {
          dgt_name:
            `Atribuição removida · ${usuarioNome}`.substring(0, 100),
          dgt_entidade:
            'dgt_usuariotreinamento',
          dgt_registroid:
            id,
          dgt_dataevento:
            new Date().toISOString(),
          dgt_descricao:
            `Atribuição do treinamento "${dados.treinamentoNome || formatado(registro, '_dgt_treinamento_value')}" removida de ${usuarioNome}` +
            `${dados.responsavelNome ? ` por ${dados.responsavelNome}` : ''}. Motivo: ${motivo}`,
          dgt_dadosanteriores:
            JSON.stringify(anteriores),
          dgt_dadosnovos:
            JSON.stringify({
              evento: 'REMOCAO_ATRIBUICAO',
              ativo: false,
              liberado: false,
              status: 'Cancelado',
              motivo,
              responsavel: dados.responsavelNome || undefined
            }),
          dgt_origem:
            'Portal - Gestão de treinamentos',
          dgt_ativo:
            true
      };

      try {
        await this.dataverse.criarAuditoriaNegocio(
          auditoria,
          dados.responsavelId
        );
      } catch (erroData) {
        // dgt_dataevento configurada como "Somente data".
        const mensagem =
          erroData instanceof Error
            ? erroData.message
            : '';

        if (mensagem.indexOf('Edm.Date') < 0) {
          throw erroData;
        }

        await this.dataverse.criarAuditoriaNegocio(
          {
            ...auditoria,
            dgt_dataevento:
              String(auditoria.dgt_dataevento).substring(0, 10)
          },
          dados.responsavelId
        );
      }

    } catch (erroAuditoria) {

      console.warn(
        '[Atribuições] Remoção concluída, mas a auditoria não foi gravada.',
        erroAuditoria
      );

      avisoAuditoria =
        'A atribuição foi removida, mas o registro de auditoria não pôde ser gravado.';
    }

    return {
      avisoAuditoria
    };
  }
}
