import {
  DataverseService
} from './DataverseService';

import {
  SharePointDocumentoService
} from './sharepoint/SharePointDocumentoService';

import {
  DocumentoHistoricoService
} from './DocumentoHistoricoService';

import {
  DocumentoWorkflowService
} from './DocumentoWorkflowService';

import {
  IResultadoPublicacaoRevisao
} from './RevisaoDocumentoAdminService';

import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

// ============================================================
// FLUXO DE REVISÃO DOCUMENTAL — tela de detalhe do documento
//
//   Vigente (Rev.00)
//     └─ "Criar nova revisão"  → Rev.01 em ELABORAÇÃO (editável)
//          └─ "Enviar para aprovação" → APROVAÇÃO (Gestor avalia)
//               ├─ Reprovar → volta para ELABORAÇÃO (motivo no histórico)
//               └─ Aprovar  → VIGENTE (plugin) + Rev.00 marcada como
//                             substituída (dgt_ativa = false)
//
// A revisão anterior NUNCA é alterada em conteúdo nem apagada — só
// deixa de ser a ativa quando a nova é publicada.
// ============================================================

export interface IUsuarioFluxo {
  id: string;
  nome: string;
}

export interface INovaRevisaoFluxo {
  documento: IDocumento;
  revisoes: IDocumentoRevisao[];
  motivoAlteracao: string;
  descricaoAlteracoes: string;
  arquivo?: File;
  usuario: IUsuarioFluxo;
}

export interface IEditarRevisaoFluxo {
  documento: IDocumento;
  revisao: IDocumentoRevisao;
  motivoAlteracao: string;
  descricaoAlteracoes: string;
  arquivo?: File;
  usuario: IUsuarioFluxo;
}

export interface IResultadoFluxo {
  // Aviso não bloqueante (ex.: histórico não gravado).
  aviso: string;
}

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// dgt_datarevisao é uma coluna "Somente data" no Dataverse: aceita
// apenas "AAAA-MM-DD". Usa a data LOCAL (e não toISOString, que é UTC):
// às 22h em Porto Alegre o UTC já seria o dia seguinte.
export const dataHojeSomenteData = (): string => {

  const agora =
    new Date();

  const doisDigitos = (
    valor: number
  ): string =>
    valor < 10
      ? `0${valor}`
      : String(valor);

  return (
    `${agora.getFullYear()}-` +
    `${doisDigitos(agora.getMonth() + 1)}-` +
    `${doisDigitos(agora.getDate())}`
  );
};

// O Dataverse devolve a pilha de exceção inteira (dezenas de linhas).
// Para a tela, extrai só a mensagem principal.
export const resumirErro = (
  mensagem: string
): string => {

  const texto =
    mensagem || '';

  const encontrado =
    texto.match(/"message"\s*:\s*"([^"]*)/);

  const principal =
    (encontrado ? encontrado[1] : texto)
      .split('---->')[0]
      .split('\\r\\n')[0]
      .trim();

  return principal.length > 300
    ? `${principal.substring(0, 300)}…`
    : principal;
};

// Periodicidade da revisão periódica de documentos (ISO 9001: revisar
// criticamente em intervalos planejados). Ajuste aqui se a política
// da DGT for outra.
export const PERIODICIDADE_REVISAO_MESES = 24;

// Vigência + periodicidade → "AAAA-MM-DD".
export const calcularPrazoRevisao = (
  vigencia?: string
): string => {

  const base =
    vigencia && /^\d{4}-\d{2}-\d{2}/.test(vigencia)
      ? new Date(
        Number(vigencia.substring(0, 4)),
        Number(vigencia.substring(5, 7)) - 1,
        Number(vigencia.substring(8, 10))
      )
      : new Date();

  base.setMonth(
    base.getMonth() + PERIODICIDADE_REVISAO_MESES
  );

  const dois = (
    valor: number
  ): string =>
    valor < 10 ? `0${valor}` : String(valor);

  return `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}`;
};

export const estagioRevisao = (
  status: string
): 'elaboracao' | 'revisao' | 'aprovacao' | 'vigente' => {

  const valor =
    normalizar(status);

  return valor === 'revisao' ||
    valor === 'aprovacao' ||
    valor === 'vigente'
    ? valor
    : 'elaboracao';
};

export const numeroRevisao = (
  revisao: string
): number => {

  const encontrado =
    (revisao || '').match(/(\d+)(?!.*\d)/);

  return encontrado
    ? Number(encontrado[1])
    : -1;
};

// "Rev.00" → "Rev.01" | "Rev.9" → "Rev.10" | "03" → "04".
// Usa a MAIOR revisão existente, preservando prefixo e quantidade de
// dígitos. Sem revisões → "Rev.00".
export const calcularProximaRevisao = (
  revisoes: IDocumentoRevisao[]
): string => {

  let maior: IDocumentoRevisao | undefined;

  revisoes.forEach(
    revisao => {
      if (
        !maior ||
        numeroRevisao(revisao.revisao) >
          numeroRevisao(maior.revisao)
      ) {
        maior = revisao;
      }
    }
  );

  if (
    !maior ||
    numeroRevisao(maior.revisao) < 0
  ) {
    return 'Rev.00';
  }

  const base =
    maior.revisao.trim();

  const encontrado =
    base.match(/^(.*?)(\d+)(\D*)$/);

  if (!encontrado) {
    return 'Rev.00';
  }

  const prefixo =
    encontrado[1];

  const digitos =
    encontrado[2];

  const sufixo =
    encontrado[3];

  const proximo =
    String(
      Number(digitos) + 1
    );

  const preenchido =
    proximo.length < digitos.length
      ? `${'0'.repeat(digitos.length - proximo.length)}${proximo}`
      : proximo;

  return `${prefixo}${preenchido}${sufixo}`;
};

// Revisão que está em andamento (Elaboração / Aprovação / legado
// "Revisão"). Só pode existir uma por documento.
export const obterRevisaoEmAndamento = (
  revisoes: IDocumentoRevisao[]
): IDocumentoRevisao | undefined =>

  revisoes.find(
    revisao =>
      estagioRevisao(revisao.status) !== 'vigente'
  );

// Revisão vigente atual: a de maior número entre as vigentes ativas
// (ou, se nenhuma estiver marcada como ativa, a de maior número entre
// as vigentes).
export const obterRevisaoVigente = (
  revisoes: IDocumentoRevisao[]
): IDocumentoRevisao | undefined => {

  const vigentes =
    revisoes
      .filter(
        revisao =>
          estagioRevisao(revisao.status) === 'vigente'
      )
      .sort(
        (a, b) =>
          numeroRevisao(b.revisao) -
          numeroRevisao(a.revisao)
      );

  return (
    vigentes.find(revisao => revisao.ativa) ||
    vigentes[0]
  );
};

export class DocumentoRevisaoFluxoService {

  private readonly dataverse:
    DataverseService;

  private readonly sharePoint:
    SharePointDocumentoService;

  private readonly historico:
    DocumentoHistoricoService;

  private readonly workflow:
    DocumentoWorkflowService;

  public constructor(
    dataverse: DataverseService,
    sharePoint: SharePointDocumentoService
  ) {
    this.dataverse = dataverse;
    this.sharePoint = sharePoint;
    this.historico = new DocumentoHistoricoService(dataverse);
    this.workflow = new DocumentoWorkflowService(dataverse);
  }

  public get historicoService():
    DocumentoHistoricoService {
    return this.historico;
  }

  // ==========================================================
  // CRIAR NOVA REVISÃO (Rev.N → Rev.N+1 em Elaboração)
  // ==========================================================

  public async criarNovaRevisao(
    dados: INovaRevisaoFluxo
  ): Promise<IResultadoFluxo> {

    const emAndamento =
      obterRevisaoEmAndamento(
        dados.revisoes
      );

    if (emAndamento) {
      throw new Error(
        `Já existe a revisão ${emAndamento.revisao} em andamento ` +
        `(${emAndamento.status || 'Elaboração'}). Conclua ou reprove essa revisão antes de criar outra.`
      );
    }

    if (!dados.motivoAlteracao.trim()) {
      throw new Error(
        'Informe o motivo da alteração.'
      );
    }

    if (!dados.descricaoAlteracoes.trim()) {
      throw new Error(
        'Descreva as alterações que serão feitas.'
      );
    }

    const novaRevisao =
      calcularProximaRevisao(
        dados.revisoes
      );

    const statusElaboracao =
      await this.dataverse.getChoiceOptionValue(
        'dgt_documentorevisao',
        'dgt_status',
        'Elaboração'
      );

    const criado =
      await this.dataverse
        .criarDocumentoRevisaoComResponsavel(
          dados.documento.id,
          dados.usuario.id,
          {
            dgt_name:
              `${dados.documento.codigo} - ${novaRevisao}`.substring(0, 100),

            dgt_revisao:
              novaRevisao,

            dgt_datarevisao:
              dataHojeSomenteData(),

            dgt_motivoalteracao:
              dados.motivoAlteracao.trim(),

            dgt_descricaoalteracoes:
              dados.descricaoAlteracoes.trim(),

            // Decidido na aprovação (modal de publicação).
            dgt_requerretreinamento:
              false,

            dgt_justificativa:
              '',

            dgt_status:
              statusElaboracao,

            // Só passa a ser a ativa quando for publicada — até lá a
            // revisão vigente anterior continua valendo.
            dgt_ativa:
              false
          }
        );

    const revisaoId =
      String(
        criado.dgt_documentorevisaoid || ''
      )
        .replace(/[{}]/g, '')
        .toLowerCase();

    // O arquivo é enviado DEPOIS de a revisão existir. Assim, se o
    // registro falhar, nenhum arquivo fica solto no SharePoint; e se o
    // upload falhar, a revisão já existe e o arquivo pode ser anexado
    // depois em "Editar revisão".
    let arquivoUrl = '';
    let avisoUpload = '';

    if (dados.arquivo) {
      try {
        const upload =
          await this.upload(
            dados.documento,
            novaRevisao,
            dados.arquivo,
            // A revisão é nova (maior número + 1), então nunca existe
            // arquivo publicado nesta pasta — só sobra de uma tentativa
            // anterior que falhou. Pode sobrescrever com segurança.
            true
          );

        arquivoUrl = upload.arquivoUrl;

        await this.dataverse
          .atualizarDocumentoRevisao(
            revisaoId,
            {
              dgt_arquivourl: upload.arquivoUrl,
              dgt_biblioteca: upload.biblioteca
            }
          );
      } catch (error) {
        console.error(error);
        avisoUpload =
          `A revisão ${novaRevisao} foi criada, mas o arquivo não pôde ser enviado ` +
          '(' + (error instanceof Error ? resumirErro(error.message) : 'erro desconhecido') + '). ' +
          'Anexe-o em "Editar revisão".';
      }
    }

    const anterior =
      obterRevisaoVigente(
        dados.revisoes
      );

    const aviso =
      await this.historico.registrarSemInterromper({
        documentoId: dados.documento.id,
        tipo: 'REVISAO_CRIADA',
        titulo: 'Nova revisão criada',
        descricao:
          `Revisão ${novaRevisao} aberta para edição` +
          (anterior ? ` a partir da ${anterior.revisao}.` : '.') +
          ` Motivo: ${dados.motivoAlteracao.trim()}`,
        revisao: {
          id: revisaoId,
          revisao: novaRevisao
        } as IDocumentoRevisao,
        statusNovo: 'Elaboração',
        motivo: dados.motivoAlteracao.trim(),
        arquivoUrl,
        usuarioId: dados.usuario.id,
        usuarioNome: dados.usuario.nome
      });

    return {
      aviso: [avisoUpload, aviso]
        .filter(item => !!item)
        .join(' ')
    };
  }

  // ==========================================================
  // EDITAR REVISÃO (somente em Elaboração)
  // ==========================================================

  public async editarRevisao(
    dados: IEditarRevisaoFluxo
  ): Promise<IResultadoFluxo> {

    if (
      estagioRevisao(dados.revisao.status) !== 'elaboracao'
    ) {
      throw new Error(
        'Somente revisões em Elaboração podem ser editadas.'
      );
    }

    if (!dados.motivoAlteracao.trim()) {
      throw new Error(
        'Informe o motivo da alteração.'
      );
    }

    if (!dados.descricaoAlteracoes.trim()) {
      throw new Error(
        'Descreva as alterações realizadas.'
      );
    }

    const alteracoes: Record<string, unknown> = {
      dgt_motivoalteracao:
        dados.motivoAlteracao.trim(),

      dgt_descricaoalteracoes:
        dados.descricaoAlteracoes.trim()
    };

    let arquivoUrl = '';

    if (dados.arquivo) {

      const upload =
        await this.upload(
          dados.documento,
          dados.revisao.revisao,
          dados.arquivo,
          // Revisão em elaboração: pode substituir o próprio arquivo.
          true
        );

      arquivoUrl = upload.arquivoUrl;

      alteracoes.dgt_arquivourl = upload.arquivoUrl;
      alteracoes.dgt_biblioteca = upload.biblioteca;
    }

    await this.dataverse
      .atualizarDocumentoRevisao(
        dados.revisao.id,
        alteracoes
      );

    const mudouTexto =
      (dados.revisao.motivoAlteracao || '') !== dados.motivoAlteracao.trim() ||
      (dados.revisao.descricaoAlteracoes || '') !== dados.descricaoAlteracoes.trim();

    let aviso = '';

    if (mudouTexto) {
      aviso =
        await this.historico.registrarSemInterromper({
          documentoId: dados.documento.id,
          tipo: 'REVISAO_EDITADA',
          titulo: 'Dados da revisão editados',
          descricao:
            `Motivo: ${dados.motivoAlteracao.trim()}`,
          revisao: dados.revisao,
          motivo: dados.motivoAlteracao.trim(),
          dadosAnteriores: {
            motivoAlteracao: dados.revisao.motivoAlteracao || '',
            descricaoAlteracoes: dados.revisao.descricaoAlteracoes || ''
          },
          usuarioId: dados.usuario.id,
          usuarioNome: dados.usuario.nome
        });
    }

    if (dados.arquivo) {
      aviso =
        (await this.historico.registrarSemInterromper({
          documentoId: dados.documento.id,
          tipo: 'ARQUIVO_SUBSTITUIDO',
          titulo: dados.revisao.arquivoUrl
            ? 'Arquivo da revisão substituído'
            : 'Arquivo da revisão anexado',
          descricao: `Arquivo: ${dados.arquivo.name}`,
          revisao: dados.revisao,
          arquivoUrl,
          dadosAnteriores: {
            arquivoUrl: dados.revisao.arquivoUrl || ''
          },
          usuarioId: dados.usuario.id,
          usuarioNome: dados.usuario.nome
        })) || aviso;
    }

    return { aviso };
  }

  // ==========================================================
  // ENVIAR PARA APROVAÇÃO DO GESTOR
  // ==========================================================

  public async enviarParaAprovacao(
    documento: IDocumento,
    revisao: IDocumentoRevisao,
    usuario: IUsuarioFluxo
  ): Promise<IResultadoFluxo> {

    if (!revisao.arquivoUrl) {
      throw new Error(
        'Anexe o arquivo desta revisão antes de enviar para aprovação (botão "Editar revisão").'
      );
    }

    if (
      !(revisao.motivoAlteracao || '').trim() ||
      !(revisao.descricaoAlteracoes || '').trim()
    ) {
      throw new Error(
        'Preencha o motivo e a descrição das alterações antes de enviar para aprovação.'
      );
    }

    await this.workflow.enviarParaAprovacao(
      revisao.id,
      revisao.status
    );

    const aviso =
      await this.historico.registrarSemInterromper({
        documentoId: documento.id,
        tipo: 'ENVIADA_APROVACAO',
        titulo: 'Enviada para aprovação do Gestor',
        revisao,
        statusAnterior: revisao.status || 'Elaboração',
        statusNovo: 'Aprovação',
        usuarioId: usuario.id,
        usuarioNome: usuario.nome
      });

    return { aviso };
  }

  // ==========================================================
  // REPROVAR (volta para Elaboração com motivo registrado)
  // ==========================================================

  public async reprovar(
    documento: IDocumento,
    revisao: IDocumentoRevisao,
    motivo: string,
    usuario: IUsuarioFluxo
  ): Promise<IResultadoFluxo> {

    if (!motivo.trim()) {
      throw new Error(
        'Informe o motivo da reprovação.'
      );
    }

    await this.workflow.devolverParaElaboracao(
      revisao.id,
      revisao.status
    );

    const aviso =
      await this.historico.registrarSemInterromper({
        documentoId: documento.id,
        tipo: 'REPROVADA',
        titulo: 'Reprovada pelo Gestor — devolvida para Elaboração',
        descricao: motivo.trim(),
        revisao,
        statusAnterior: revisao.status || 'Aprovação',
        statusNovo: 'Elaboração',
        motivo: motivo.trim(),
        usuarioId: usuario.id,
        usuarioNome: usuario.nome
      });

    return { aviso };
  }

  // ==========================================================
  // APÓS A PUBLICAÇÃO (plugin já tornou a revisão Vigente)
  // ==========================================================

  public async registrarPublicacao(
    documento: IDocumento,
    revisaoPublicada: IDocumentoRevisao,
    revisoes: IDocumentoRevisao[],
    resultado: IResultadoPublicacaoRevisao,
    usuario: IUsuarioFluxo
  ): Promise<IResultadoFluxo> {

    const avisos: string[] = [];

    // Revisões vigentes anteriores deixam de ser as ativas. O conteúdo
    // delas não é alterado — continuam no histórico e nos registros de
    // treinamento de quem foi treinado nelas.
    const anteriores =
      revisoes.filter(
        revisao =>
          revisao.id !== revisaoPublicada.id &&
          estagioRevisao(revisao.status) === 'vigente' &&
          revisao.ativa
      );

    for (const anterior of anteriores) {
      try {
        await this.dataverse
          .atualizarDocumentoRevisao(
            anterior.id,
            {
              dgt_ativa: false
            }
          );

        const aviso =
          await this.historico.registrarSemInterromper({
            documentoId: documento.id,
            tipo: 'REVISAO_SUBSTITUIDA',
            titulo: `Tornou-se obsoleta (substituída pela ${revisaoPublicada.revisao})`,
            descricao:
              `A ${anterior.revisao} passou a ser obsoleta. O histórico e os treinamentos realizados nela são preservados.`,
            revisao: anterior,
            usuarioId: usuario.id,
            usuarioNome: usuario.nome
          });

        if (aviso) {
          avisos.push(aviso);
        }
      } catch (error) {
        console.error(error);
        avisos.push(
          `Não foi possível marcar a ${anterior.revisao} como substituída.`
        );
      }
    }

    // Nova revisão vigente → novo prazo para a próxima revisão
    // periódica. Se a coluna ainda não existir, apenas não grava.
    let prazoDefinido = '';

    try {
      const prazo =
        calcularPrazoRevisao(
          revisaoPublicada.dataVigencia
        );

      const gravou =
        await this.dataverse
          .atualizarPrazoRevisaoDocumento(
            documento.id,
            prazo
          );

      if (gravou) {
        prazoDefinido = prazo;
      }
    } catch (error) {
      console.error(error);
      avisos.push(
        'Não foi possível definir o prazo da próxima revisão.'
      );
    }

    const descricao =
      (prazoDefinido
        ? `Próxima revisão periódica até ${prazoDefinido.substring(8, 10)}/${prazoDefinido.substring(5, 7)}/${prazoDefinido.substring(0, 4)}. `
        : '') +
      (resultado.requerRetreinamento
        ? `Publicada com retreinamento: ${resultado.treinamentosImpactados} treinamento(s), ` +
          `${resultado.usuariosImpactados} usuário(s) impactado(s), ` +
          `${resultado.atribuicoesCriadas} atribuição(ões) criada(s).`
        : 'Publicada sem retreinamento.' +
          (revisaoPublicada.justificativa
            ? ` Justificativa: ${revisaoPublicada.justificativa}`
            : ''));

    const aviso =
      await this.historico.registrarSemInterromper({
        documentoId: documento.id,
        tipo: 'APROVADA_PUBLICADA',
        titulo: 'Aprovada e publicada (Vigente)',
        descricao,
        revisao: revisaoPublicada,
        statusAnterior: 'Aprovação',
        statusNovo: 'Vigente',
        usuarioId: usuario.id,
        usuarioNome: usuario.nome
      });

    if (aviso) {
      avisos.push(aviso);
    }

    return {
      aviso: avisos.join(' ')
    };
  }

  // ==========================================================
  // INTERNOS
  // ==========================================================

  private async upload(
    documento: IDocumento,
    revisao: string,
    arquivo: File,
    sobrescrever: boolean
  ): Promise<{ arquivoUrl: string; biblioteca: string }> {

    const area =
      (documento.area || '').trim();

    if (!area) {
      throw new Error(
        'Este documento não tem área definida, então não é possível saber em qual pasta do SharePoint salvar o arquivo.'
      );
    }

    const resultado =
      await this.sharePoint.uploadArquivo(
        area,
        documento.codigo,
        revisao,
        arquivo,
        sobrescrever
      );

    return {
      arquivoUrl: resultado.arquivoUrl,
      biblioteca: resultado.biblioteca
    };
  }
}
