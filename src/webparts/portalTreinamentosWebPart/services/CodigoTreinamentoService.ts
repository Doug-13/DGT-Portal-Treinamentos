import {
  DataverseService
} from './DataverseService';

// ============================================================
// CÓDIGO DO TREINAMENTO — sugestão e disponibilidade
//
// Regra (validada também no servidor pelo GerarCodigoTreinamentoPlugin):
//   • O sequencial é escolhido NA CRIAÇÃO (ÁREA-TRN-000).
//   • Não pode usar um código que JÁ EXISTE em treinamentos ou em
//     documentos, ATIVOS OU INATIVOS (o documento de controle do
//     treinamento tem o mesmo código).
//   • Depois de criado, o código nunca muda.
//   • Só a exclusão do registro libera o código.
//
// Esta classe é só para a tela (sugerir e avisar antes de salvar).
// Quem garante a regra é o plugin.
// ============================================================

export const SEQUENCIAL_MAXIMO = 999;

export interface ICodigosUsados {
  prefixo: string;
  // número → quem usa (ex.: 'treinamento "Proposta de Solução", inativo')
  usados: Record<number, string>;
  sugestao: number;
}

const texto = (
  valor: unknown
): string =>
  valor === undefined || valor === null ? '' : String(valor).trim();

export const normalizarSigla = (
  sigla: string
): string =>
  (sigla || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const prefixoCodigoTreinamento = (
  sigla: string
): string =>
  `${normalizarSigla(sigla) || 'AREA'}-TRN-`;

export const formatarSequencial = (
  numero: number
): string =>
  ('000' + String(numero)).slice(-3);

export const montarCodigoTreinamento = (
  sigla: string,
  numero: number
): string =>
  `${prefixoCodigoTreinamento(sigla)}${formatarSequencial(numero)}`;

export class CodigoTreinamentoService {

  private readonly dataverse:
    DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // Números já usados no prefixo (treinamentos e documentos, ativos ou
  // inativos) e a sugestão (maior + 1, pulando os ocupados).
  public async levantar(
    sigla: string
  ): Promise<ICodigosUsados> {

    const prefixo =
      prefixoCodigoTreinamento(sigla);

    const filtro =
      `$filter=startswith(dgt_codigo,'${prefixo.replace(/'/g, "''")}')`;

    const [
      treinamentos,
      documentos
    ] =
      await Promise.all([
        this.dataverse.listarRegistros(
          'dgt_treinamento',
          `$select=dgt_codigo,dgt_name,dgt_ativo&${filtro}`
        ),
        this.dataverse.listarRegistros(
          'dgt_documento',
          `$select=dgt_codigo,dgt_titulo,dgt_name,dgt_ativo&${filtro}`
        )
      ]);

    const usados: Record<number, string> = {};

    const registrar = (
      codigo: string,
      descricao: string
    ): void => {
      const limpo = codigo.toUpperCase();
      if (limpo.indexOf(prefixo) !== 0) {
        return;
      }
      const numero = Number(limpo.substring(prefixo.length));
      if (Number.isInteger(numero) && numero > 0 && !usados[numero]) {
        usados[numero] = descricao;
      }
    };

    treinamentos.forEach(registro =>
      registrar(
        texto(registro.dgt_codigo),
        `treinamento "${texto(registro.dgt_name)}"${registro.dgt_ativo === false ? ', inativo' : ''}`
      )
    );

    documentos.forEach(registro =>
      registrar(
        texto(registro.dgt_codigo),
        `documento "${texto(registro.dgt_titulo) || texto(registro.dgt_name)}"${registro.dgt_ativo === false ? ', inativo' : ''}`
      )
    );

    const numeros =
      Object.keys(usados).map(Number);

    let sugestao =
      numeros.reduce((maior, n) => (n > maior ? n : maior), 0) + 1;

    while (usados[sugestao] && sugestao <= SEQUENCIAL_MAXIMO) {
      sugestao++;
    }

    return {
      prefixo,
      usados,
      sugestao
    };
  }
}
