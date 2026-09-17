import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export type OrigemAtribuicao =
  | 'Individual'
  | 'Grupo'
  | 'Função'
  | 'Reciclagem'
  | 'Revisão documental'
  | 'Mudança de função';

export interface IUsuarioAtribuicao {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export interface ITrilhaAtribuicao {
  id: string;
  nome: string;
  ativa: boolean;
}

export interface IAtribuicaoManual {
  usuarioId: string;
  treinamentoId: string;
  trilhaId?: string;
  origem: OrigemAtribuicao;
  origemId?: string;
  dataLimite?: string;
  observacao?: string;
}

export interface IResultadoAtribuicao {
  sucesso: boolean;
  mensagem: string;
  usuarioTreinamentoId?: string;
  reutilizado?: boolean;
  criado?: boolean;
  liberado?: boolean;
}

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];

  return valor === undefined ||
    valor === null
    ? padrao
    : String(valor);
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {
  const valor = registro[campo];

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (
    valor === 1 ||
    valor === '1' ||
    valor === 'true'
  ) {
    return true;
  }

  if (
    valor === 0 ||
    valor === '0' ||
    valor === 'false'
  ) {
    return false;
  }

  return padrao;
};

export class AtribuicaoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  public async listarUsuarios():
    Promise<IUsuarioAtribuicao[]> {

    const registros =
      await this.dataverse
        .getUsuarios();

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_usuarioid'
          ),
          nome: texto(
            registro,
            'dgt_name',
            'Usuário'
          ),
          email: texto(
            registro,
            'dgt_email'
          ),
          ativo: booleano(
            registro,
            'dgt_ativo',
            true
          )
        })
      )
      .filter(
        item =>
          item.ativo
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async listarTrilhas():
    Promise<ITrilhaAtribuicao[]> {

    const registros =
      await this.dataverse
        .getTrilhasAdministrativas();

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_trilhaid'
          ),
          nome: texto(
            registro,
            'dgt_name',
            'Trilha'
          ),
          ativa: booleano(
            registro,
            'dgt_ativo',
            true
          )
        })
      )
      .filter(
        item =>
          item.ativa
      )
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR'
          )
      );
  }

  public async atribuir(
    dados: IAtribuicaoManual
  ): Promise<IResultadoAtribuicao> {

    if (!dados.usuarioId) {
      throw new Error(
        'Selecione o usuário.'
      );
    }

    if (!dados.treinamentoId) {
      throw new Error(
        'Selecione o treinamento.'
      );
    }

    if (!dados.origem) {
      throw new Error(
        'Informe a origem da atribuição.'
      );
    }

    return this.dataverse
      .processarAtribuicao({
        UsuarioId:
          dados.usuarioId,
        TreinamentoId:
          dados.treinamentoId,
        TrilhaId:
          dados.trilhaId || '',
        Origem:
          dados.origem,
        OrigemId:
          dados.origemId || '',
        DataLimite:
          dados.dataLimite || '',
        Observacao:
          dados.observacao || ''
      });
  }
}
