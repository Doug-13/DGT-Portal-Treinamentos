import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  IColaborador,
  IUsuario
} from '../models/Usuario';

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

      const atribuicoesUsuario =
        atribuicoes.filter(item => {

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

      atribuicoesUsuario.forEach(item => {

        const status =
          this.texto(
            item,
            [
              'dgt_status@OData.Community.Display.V1.FormattedValue',
              'dgt_status'
            ]
          )
            .toLowerCase()
            .normalize('NFD')
            .replace(
              /[\u0300-\u036f]/g,
              ''
            );

        if (
          status.includes('conclu') ||
          status.includes('aprov')
        ) {
          concluidos += 1;
          return;
        }

        if (status.includes('venc')) {
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
          `${conformidadeNumero}%`
      };
    });
  }
}