import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  IColaborador,
  ITreinamentoColaborador,
  IUsuario
} from '../models/Usuario';

import {
  rotuloStatus
} from './AtribuicoesTreinamentoService';

import {
  lerDataConformidade
} from './ConformidadeService';

// Prazo para realização (dgt_datalimite) já passou? Compara só o dia.
const prazoExpirado = (
  valor: string
): boolean => {

  const data =
    lerDataConformidade(valor);

  if (!data) {
    return false;
  }

  const hoje = new Date();

  return (
    new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime() <
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
  );
};

export class UsuarioService {

  private readonly dataverse?: DataverseService;

  public constructor(
    dataverse?: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ============================================================
  // UTILITÁRIOS
  // ============================================================

  public primeiroNome(
    nomeCompleto: string
  ): string {

    const nome = (nomeCompleto || '').trim();

    return nome
      ? nome.split(' ')[0]
      : 'Colaborador';
  }

  public urlFotoSharePoint(
    siteUrl: string,
    email: string
  ): string {

    if (!siteUrl || !email) {
      return '';
    }

    return (
      `${siteUrl}/_layouts/15/userphoto.aspx` +
      `?size=M&accountname=${encodeURIComponent(email)}`
    );
  }

  private texto(
    registro: IDataverseRecord,
    campos: string | string[],
    padrao = ''
  ): string {

    const lista =
      Array.isArray(campos)
        ? campos
        : [campos];

    for (const campo of lista) {

      const valor = registro[campo];

      if (
        valor !== undefined &&
        valor !== null &&
        String(valor).trim() !== ''
      ) {
        return String(valor);
      }
    }

    return padrao;
  }

  private booleano(
    registro: IDataverseRecord,
    campo: string,
    padrao = true
  ): boolean {

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
  }

  private limparGuid(
    valor: string
  ): string {

    return (valor || '')
      .replace(/[{}]/g, '')
      .trim()
      .toLowerCase();
  }

  // ============================================================
  // USUÁRIOS
  // ============================================================

  public async getUsuarios():
    Promise<IUsuario[]> {

    if (!this.dataverse) {
      return [];
    }

    const registros =
      await this.dataverse.getUsuarios();

    return registros.map(
      registro => ({
        id: this.limparGuid(
          this.texto(
            registro,
            'dgt_usuarioid'
          )
        ),

        nome: this.texto(
          registro,
          'dgt_name',
          'Colaborador'
        ),

        email: this.texto(
          registro,
          'dgt_email'
        ),

        upn: this.texto(
          registro,
          'dgt_upn'
        ),

        ativo: this.booleano(
          registro,
          'dgt_ativo',
          true
        )
      })
    );
  }

  // ============================================================
  // TREINAMENTO DE UMA ATRIBUIÇÃO (detalhe da equipe)
  // A situação segue a MESMA regra dos totais de getEquipe,
  // para o detalhe bater com os números da linha.
  // ============================================================

  private treinamentoDaAtribuicao(
    item: IDataverseRecord
  ): ITreinamentoColaborador {

    const statusTexto =
      this.texto(
        item,
        [
          'dgt_status@OData.Community.Display.V1.FormattedValue',
          'dgt_status'
        ]
      );

    const statusNormalizado =
      statusTexto
        .toLowerCase()
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        );

    const dataLimite =
      this.texto(item, 'dgt_datalimite');

    const concluido =
      statusNormalizado.includes('conclu') ||
      statusNormalizado.includes('aprov') ||
      !!this.texto(item, 'dgt_dataconclusao');

    const reprovado =
      statusNormalizado.includes('reprov');

    // Mesma regra da Conformidade: prazo para realização expirado e
    // treinamento não feito conta como VENCIDO (exceto Reprovado).
    const vencidoPorPrazo =
      !concluido &&
      !reprovado &&
      prazoExpirado(dataLimite);

    const situacao: ITreinamentoColaborador['situacao'] =
      concluido
        ? 'concluido'
        : statusNormalizado.includes('venc') || vencidoPorPrazo
          ? 'vencido'
          : 'pendente';

    const liberado =
      this.booleano(
        item,
        'dgt_liberado',
        true
      );

    return {
      id:
        this.limparGuid(
          this.texto(item, 'dgt_usuariotreinamentoid')
        ),

      treinamentoId:
        this.limparGuid(
          this.texto(item, '_dgt_treinamento_value')
        ),

      nome:
        this.texto(
          item,
          '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue',
          'Treinamento'
        ),

      status:
        vencidoPorPrazo
          ? 'Vencido'
          : rotuloStatus(
            Number(item.dgt_status),
            statusTexto,
            liberado,
            true
          ),

      situacao,

      trilha:
        this.texto(
          item,
          '_dgt_trilha_value@OData.Community.Display.V1.FormattedValue'
        ) || undefined,

      dataAtribuicao:
        this.texto(item, ['dgt_dataatribuicao', 'createdon']) || undefined,

      dataLimite:
        dataLimite || undefined,

      dataConclusao:
        this.texto(item, 'dgt_dataconclusao') || undefined,

      dataValidade:
        this.texto(item, 'dgt_datavalidade') || undefined
    };
  }

  // ============================================================
  // EQUIPE
  // ============================================================

  public async getEquipe():
    Promise<IColaborador[]> {

    if (!this.dataverse) {
      return [];
    }

    const [
      usuarios,
      atribuicoes
    ] = await Promise.all([
      this.dataverse.getUsuarios(),
      this.dataverse.getUsuarioTreinamentos()
    ]);

    return usuarios.map(usuario => {

      const usuarioId =
        this.limparGuid(
          this.texto(
            usuario,
            'dgt_usuarioid'
          )
        );

      // Atribuições removidas (dgt_ativo = Não) não contam
      // como pendência da equipe.
      const atribuicoesUsuario =
        atribuicoes.filter(item => {

          if (item.dgt_ativo === false) {
            return false;
          }

          const usuarioLookup =
            this.limparGuid(
              this.texto(
                item,
                '_dgt_usuario_value'
              )
            );

          return usuarioLookup === usuarioId;
        });

      let concluidos = 0;
      let pendentes = 0;
      let vencidos = 0;

      // Detalhe por treinamento (clique no nome em "Minha equipe").
      const treinamentos: ITreinamentoColaborador[] = [];

      // Totais a partir da mesma classificação do detalhe, para os
      // números da linha baterem com a lista ao clicar no nome.
      atribuicoesUsuario.forEach(item => {

        const treinamento =
          this.treinamentoDaAtribuicao(item);

        treinamentos.push(treinamento);

        if (treinamento.situacao === 'concluido') {
          concluidos += 1;
          return;
        }

        if (treinamento.situacao === 'vencido') {
          vencidos += 1;
          return;
        }

        pendentes += 1;
      });

      const total =
        atribuicoesUsuario.length;

      const conformidadeNumero =
        total === 0
          ? 100
          : Math.round(
              (
                concluidos /
                total
              ) * 100
            );

      return {
        id: usuarioId,

        nome: this.texto(
          usuario,
          'dgt_name',
          'Colaborador'
        ),

        email: this.texto(
          usuario,
          'dgt_email'
        ),

        // Campos ainda não confirmados
        // no Dataverse.
        funcao: '-',
        setor: '-',

        concluidos,
        pendentes,
        vencidos,
        total,

        conformidade:
          `${conformidadeNumero}%`,

        treinamentos
      };
    });
  }
}