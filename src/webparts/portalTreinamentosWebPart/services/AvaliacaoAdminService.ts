import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

export interface IAvaliacaoAdmin {
  id: string;
  treinamentoId: string;
  nome: string;
  descricao: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativasPermitidas: number;
  tempoLimiteMin: number;
  sortearQuestoes: boolean;
  embaralharQuestoes: boolean;
  embaralharAlternativas: boolean;
  mostrarResultado: boolean;
  mostrarRespostasCorretas: boolean;
  ativa: boolean;
}

export interface INovaAvaliacao {
  treinamentoId: string;
  nome: string;
  descricao: string;
  notaMinima: number;
  quantidadeQuestoes: number;
  tentativasPermitidas: number;
  tempoLimiteMin: number;
  sortearQuestoes: boolean;
  embaralharQuestoes: boolean;
  embaralharAlternativas: boolean;
  mostrarResultado: boolean;
  mostrarRespostasCorretas: boolean;
  ativa: boolean;
}

export interface IEditarAvaliacao
  extends INovaAvaliacao {
  id: string;
}

export interface IQuestaoAdmin {
  id: string;
  avaliacaoId: string;
  nome: string;
  enunciado: string;
  ordem: number;
  peso: number;
  multiplasRespostas: boolean;
  ativa: boolean;
}

export interface INovaQuestao {
  avaliacaoId: string;
  nome: string;
  enunciado: string;
  ordem: number;
  peso: number;
  multiplasRespostas: boolean;
  ativa: boolean;
}

export interface IEditarQuestao
  extends INovaQuestao {
  id: string;
}

export interface IAlternativaAdmin {
  id: string;
  questaoId: string;
  texto: string;
  ordem: number;
  correta: boolean;
  ativa: boolean;
}

export interface INovaAlternativa {
  questaoId: string;
  texto: string;
  ordem: number;
  correta: boolean;
  ativa: boolean;
}

export interface IEditarAlternativa
  extends INovaAlternativa {
  id: string;
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

const numero = (
  registro: IDataverseRecord,
  campo: string,
  padrao = 0
): number => {
  const valor = registro[campo];

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return padrao;
  }

  const convertido = Number(valor);

  return Number.isNaN(convertido)
    ? padrao
    : convertido;
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = false
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

export class AvaliacaoAdminService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse =
      dataverse;
  }

  // ============================================================
  // AVALIAÇÕES
  // ============================================================

  public async listarAvaliacoes(
    treinamentoId: string
  ): Promise<IAvaliacaoAdmin[]> {

    if (!treinamentoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getAvaliacoesTreinamentoAdmin(
          treinamentoId
        );

    return registros.map(
      registro => ({
        id: texto(
          registro,
          'dgt_avaliacaoid'
        ),
        treinamentoId: texto(
          registro,
          '_dgt_treinamento_value'
        ),
        nome: texto(
          registro,
          'dgt_name',
          'Avaliação'
        ),
        descricao: texto(
          registro,
          'dgt_descricao'
        ),
        notaMinima: numero(
          registro,
          'dgt_notaminima',
          70
        ),
        quantidadeQuestoes: numero(
          registro,
          'dgt_quantidadequestoes',
          10
        ),
        tentativasPermitidas: numero(
          registro,
          'dgt_tentativaspermitidas',
          3
        ),
        tempoLimiteMin: numero(
          registro,
          'dgt_tempolimitemin',
          0
        ),
        sortearQuestoes: booleano(
          registro,
          'dgt_sortearquestoes',
          true
        ),
        embaralharQuestoes: booleano(
          registro,
          'dgt_embaralharquestoes',
          true
        ),
        embaralharAlternativas: booleano(
          registro,
          'dgt_embaralharalternativas',
          true
        ),
        mostrarResultado: booleano(
          registro,
          'dgt_mostrarresultado',
          true
        ),
        mostrarRespostasCorretas: booleano(
          registro,
          'dgt_mostrarrespostascorretas',
          false
        ),
        ativa: booleano(
          registro,
          'dgt_ativa',
          true
        )
      })
    );
  }

  public async criarAvaliacao(
    dados: INovaAvaliacao
  ): Promise<void> {

    this.validarAvaliacao(
      dados
    );

    await this.dataverse
      .criarAvaliacao(
        dados.treinamentoId,
        {
          dgt_name:
            dados.nome.trim(),

          dgt_descricao:
            dados.descricao.trim(),

          dgt_notaminima:
            dados.notaMinima,

          dgt_quantidadequestoes:
            dados.quantidadeQuestoes,

          dgt_tentativaspermitidas:
            dados.tentativasPermitidas,

          dgt_tempolimitemin:
            dados.tempoLimiteMin,

          dgt_sortearquestoes:
            dados.sortearQuestoes,

          dgt_embaralharquestoes:
            dados.embaralharQuestoes,

          dgt_embaralharalternativas:
            dados.embaralharAlternativas,

          dgt_mostrarresultado:
            dados.mostrarResultado,

          dgt_mostrarrespostascorretas:
            dados.mostrarRespostasCorretas,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async editarAvaliacao(
    dados: IEditarAvaliacao
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'Avaliação não informada.'
      );
    }

    this.validarAvaliacao(
      dados
    );

    await this.dataverse
      .atualizarAvaliacao(
        dados.id,
        {
          dgt_name:
            dados.nome.trim(),

          dgt_descricao:
            dados.descricao.trim(),

          dgt_notaminima:
            dados.notaMinima,

          dgt_quantidadequestoes:
            dados.quantidadeQuestoes,

          dgt_tentativaspermitidas:
            dados.tentativasPermitidas,

          dgt_tempolimitemin:
            dados.tempoLimiteMin,

          dgt_sortearquestoes:
            dados.sortearQuestoes,

          dgt_embaralharquestoes:
            dados.embaralharQuestoes,

          dgt_embaralharalternativas:
            dados.embaralharAlternativas,

          dgt_mostrarresultado:
            dados.mostrarResultado,

          dgt_mostrarrespostascorretas:
            dados.mostrarRespostasCorretas,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async definirAvaliacaoAtiva(
    avaliacaoId: string,
    ativa: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarAvaliacao(
        avaliacaoId,
        {
          dgt_ativa: ativa
        }
      );
  }

  // ============================================================
  // QUESTÕES
  // ============================================================

  public async listarQuestoes(
    avaliacaoId: string
  ): Promise<IQuestaoAdmin[]> {

    if (!avaliacaoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getQuestoesAvaliacaoAdmin(
          avaliacaoId
        );

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_questaoid'
          ),
          avaliacaoId: texto(
            registro,
            '_dgt_avaliacao_value'
          ),
          nome: texto(
            registro,
            'dgt_name',
            'Questão'
          ),
          enunciado: texto(
            registro,
            'dgt_enunciado'
          ),
          ordem: numero(
            registro,
            'dgt_ordem'
          ),
          peso: numero(
            registro,
            'dgt_peso',
            1
          ),
          multiplasRespostas:
            booleano(
              registro,
              'dgt_multiplasrespostas',
              false
            ),
          ativa: booleano(
            registro,
            'dgt_ativa',
            true
          )
        })
      )
      .sort(
        (a, b) =>
          a.ordem -
          b.ordem
      );
  }

  public async criarQuestao(
    dados: INovaQuestao
  ): Promise<void> {

    this.validarQuestao(
      dados
    );

    await this.dataverse
      .criarQuestao(
        dados.avaliacaoId,
        {
          dgt_name:
            dados.nome.trim(),

          dgt_enunciado:
            dados.enunciado.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_peso:
            dados.peso,

          dgt_multiplasrespostas:
            dados.multiplasRespostas,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async editarQuestao(
    dados: IEditarQuestao
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'Questão não informada.'
      );
    }

    this.validarQuestao(
      dados
    );

    await this.dataverse
      .atualizarQuestao(
        dados.id,
        {
          dgt_name:
            dados.nome.trim(),

          dgt_enunciado:
            dados.enunciado.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_peso:
            dados.peso,

          dgt_multiplasrespostas:
            dados.multiplasRespostas,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async definirQuestaoAtiva(
    questaoId: string,
    ativa: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarQuestao(
        questaoId,
        {
          dgt_ativa: ativa
        }
      );
  }

  // ============================================================
  // ALTERNATIVAS
  // ============================================================

  public async listarAlternativas(
    questaoId: string
  ): Promise<IAlternativaAdmin[]> {

    if (!questaoId) {
      return [];
    }

    const registros =
      await this.dataverse
        .getAlternativasQuestaoAdmin(
          questaoId
        );

    return registros
      .map(
        registro => ({
          id: texto(
            registro,
            'dgt_alternativaid'
          ),
          questaoId: texto(
            registro,
            '_dgt_questao_value'
          ),
          texto: texto(
            registro,
            'dgt_name',
            'Alternativa'
          ),
          ordem: numero(
            registro,
            'dgt_ordem'
          ),
          correta: booleano(
            registro,
            'dgt_correta',
            false
          ),
          ativa: booleano(
            registro,
            'dgt_ativa',
            true
          )
        })
      )
      .sort(
        (a, b) =>
          a.ordem -
          b.ordem
      );
  }

  public async criarAlternativa(
    dados: INovaAlternativa
  ): Promise<void> {

    if (!dados.questaoId) {
      throw new Error(
        'Questão não informada.'
      );
    }

    if (!dados.texto.trim()) {
      throw new Error(
        'Informe o texto da alternativa.'
      );
    }

    await this.dataverse
      .criarAlternativa(
        dados.questaoId,
        {
          dgt_name:
            dados.texto.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_correta:
            dados.correta,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async editarAlternativa(
    dados: IEditarAlternativa
  ): Promise<void> {

    if (!dados.id) {
      throw new Error(
        'Alternativa não informada.'
      );
    }

    await this.dataverse
      .atualizarAlternativa(
        dados.id,
        {
          dgt_name:
            dados.texto.trim(),

          dgt_ordem:
            dados.ordem,

          dgt_correta:
            dados.correta,

          dgt_ativa:
            dados.ativa
        }
      );
  }

  public async definirAlternativaAtiva(
    alternativaId: string,
    ativa: boolean
  ): Promise<void> {

    await this.dataverse
      .atualizarAlternativa(
        alternativaId,
        {
          dgt_ativa:
            ativa
        }
      );
  }

  private validarAvaliacao(
    dados: INovaAvaliacao
  ): void {

    if (!dados.treinamentoId) {
      throw new Error(
        'Treinamento não informado.'
      );
    }

    if (!dados.nome.trim()) {
      throw new Error(
        'Informe o nome da avaliação.'
      );
    }

    if (
      dados.notaMinima < 0 ||
      dados.notaMinima > 100
    ) {
      throw new Error(
        'Nota mínima deve estar entre 0 e 100.'
      );
    }

    if (
      dados.quantidadeQuestoes <= 0
    ) {
      throw new Error(
        'Quantidade de questões deve ser maior que zero.'
      );
    }

    if (
      dados.tentativasPermitidas <= 0
    ) {
      throw new Error(
        'Tentativas permitidas deve ser maior que zero.'
      );
    }
  }

  private validarQuestao(
    dados: INovaQuestao
  ): void {

    if (!dados.avaliacaoId) {
      throw new Error(
        'Avaliação não informada.'
      );
    }

    if (!dados.enunciado.trim()) {
      throw new Error(
        'Informe o enunciado da questão.'
      );
    }

    if (dados.ordem <= 0) {
      throw new Error(
        'A ordem deve ser maior que zero.'
      );
    }

    if (dados.peso <= 0) {
      throw new Error(
        'O peso deve ser maior que zero.'
      );
    }
  }
}
