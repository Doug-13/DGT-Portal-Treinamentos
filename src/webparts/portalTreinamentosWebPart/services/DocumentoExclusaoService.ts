import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

import {
  DataverseService
} from './DataverseService';

import {
  DocumentoHistoricoService
} from './DocumentoHistoricoService';

import {
  estagioRevisao,
  STATUS_REVISAO_CANCELADA
} from './DocumentoRevisaoFluxoService';

import {
  obterPersistenciaFluxo
} from './fluxo/persistenciaFluxo';

import {
  SharePointDocumentoService
} from './sharepoint/SharePointDocumentoService';

// ============================================================
// EXCLUSÃO DE DOCUMENTO (administrador) — LIBERA O CÓDIGO
//
// Para documentos criados por engano. Só é permitida quando:
//   • nenhuma revisão foi publicada (nunca houve Vigente), e
//   • não há treinamento vinculado ao documento.
// Documento que já foi vigente é evidência de treinamento/conformidade:
// não se exclui — inativa-se.
//
// "Excluir" não apaga nada: o registro sai de uso e o CÓDIGO é
// liberado para um novo documento.
//   1. fluxos em andamento são cancelados (pendências somem);
//   2. revisões ficam "Cancelada" e inativas;
//   3. vínculos com processos são desativados;
//   4. a pasta do SharePoint é renomeada (o novo documento com o mesmo
//      código não sobrescreve os arquivos do excluído);
//   5. o documento fica inativo com o código renomeado
//      (ex.: ARQ-MAP-003-EXC-202610211530) — o original fica no histórico;
//   6. o histórico registra quem excluiu, quando e por quê.
// ============================================================

export interface IAnaliseExclusao {
  podeExcluir: boolean;
  motivos: string[];
  avisos: string[];
}

export interface IResultadoExclusao {
  codigoLiberado: string;
  codigoArquivado: string;
  avisos: string[];
}

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const carimbo = (): string => {
  const agora = new Date();
  const dois = (valor: number): string => (valor < 10 ? `0${valor}` : String(valor));
  return `${agora.getFullYear()}${dois(agora.getMonth() + 1)}${dois(agora.getDate())}${dois(agora.getHours())}${dois(agora.getMinutes())}`;
};

export class DocumentoExclusaoService {

  private readonly dataverse: DataverseService;

  private readonly sharePoint?: SharePointDocumentoService;

  public constructor(
    dataverse: DataverseService,
    sharePoint?: SharePointDocumentoService
  ) {
    this.dataverse = dataverse;
    this.sharePoint = sharePoint;
  }

  public async analisar(
    documento: IDocumento,
    revisoes: IDocumentoRevisao[]
  ): Promise<IAnaliseExclusao> {

    const motivos: string[] = [];
    const avisos: string[] = [];

    const publicadas =
      revisoes.filter(revisao => estagioRevisao(revisao.status) === 'vigente');

    if (publicadas.length > 0) {
      motivos.push(
        `O documento já teve revisão publicada (${publicadas.map(item => item.revisao).join(', ')}). ` +
        'Documentos que já foram vigentes não podem ser excluídos: são evidência de treinamento e conformidade. ' +
        'Para tirá-lo de uso, inative o documento.'
      );
    }

    // Documento de CONTROLE de um treinamento (mesmo código do
    // treinamento): excluir tiraria o treinamento do fluxo.
    try {
      const codigo =
        documento.codigo.trim().toUpperCase().replace(/'/g, "''");

      const treinamentoDoCodigo =
        await this.dataverse.listarRegistros(
          'dgt_treinamento',
          `$select=dgt_treinamentoid,dgt_name&$filter=dgt_codigo eq '${codigo}'&$top=1`
        );

      if (treinamentoDoCodigo.length > 0) {
        motivos.push(
          `Este é o documento de controle do treinamento ${documento.codigo}. ` +
          'Excluí-lo tiraria o treinamento do fluxo de treinamentos. Para descontinuar, inative o treinamento.'
        );
      }
    } catch (error) {
      console.error(error);
      avisos.push('Não foi possível conferir se este documento controla um treinamento.');
    }

    try {
      const treinamentos =
        (await this.dataverse.getTreinamentosDocumentoAdmin(documento.id))
          .filter(registro => registro.dgt_ativo !== false && registro.statecode !== 1);

      if (treinamentos.length > 0) {
        motivos.push(
          `Há ${treinamentos.length} treinamento(s) vinculado(s) a este documento. Desvincule-os antes de excluir.`
        );
      }
    } catch (error) {
      console.error(error);
      avisos.push('Não foi possível conferir os treinamentos vinculados; confira manualmente antes de excluir.');
    }

    if (!this.sharePoint) {
      avisos.push(
        'Sem acesso à biblioteca do SharePoint nesta tela: a pasta dos arquivos não será renomeada. ' +
        'Um novo documento com o mesmo código pode substituir arquivos de mesmo nome.'
      );
    }

    return {
      podeExcluir: motivos.length === 0,
      motivos,
      avisos
    };
  }

  public async excluir(
    documento: IDocumento,
    revisoes: IDocumentoRevisao[],
    justificativa: string,
    usuario: { id: string; nome: string }
  ): Promise<IResultadoExclusao> {

    const analise =
      await this.analisar(documento, revisoes);

    if (!analise.podeExcluir) {
      throw new Error(analise.motivos.join(' '));
    }

    if (justificativa.trim().length < 10) {
      throw new Error('Informe a justificativa da exclusão (mínimo 10 caracteres).');
    }

    const avisos: string[] = [];

    const codigoLiberado =
      documento.codigo.trim().toUpperCase();

    const codigoArquivado =
      `${codigoLiberado}-EXC-${carimbo()}`.substring(0, 100);

    const nomeUsuario =
      `${usuario.nome || 'Administrador'} (Administrador)`;

    const persistencia =
      obterPersistenciaFluxo(this.dataverse);

    // 1) Fluxos em andamento: cancelados (com registro no histórico).
    for (const revisao of revisoes) {
      try {
        const instancia =
          await persistencia.repositorio.obter(revisao.id);

        if (!instancia || instancia.status !== 'emAndamento') {
          continue;
        }

        const agora = new Date().toISOString();

        instancia.tarefas.forEach(
          tarefa => {
            if (tarefa.status === 'pendente') {
              tarefa.status = 'cancelada';
              tarefa.concluidaEm = agora;
              tarefa.concluidaPorNome = nomeUsuario;
            }
          }
        );

        instancia.status = 'cancelado';
        instancia.concluidoEm = agora;

        instancia.historico.unshift({
          id: `hist-${new Date().getTime()}`,
          data: agora,
          elementoId: instancia.elementoAtualId,
          elementoNome: 'Documento excluído',
          acaoChave: 'documentoExcluidoAdministrador',
          acaoRotulo: `Documento excluído — alterado por administrador (código ${codigoLiberado} liberado)`,
          resultado: 'cancelado',
          comentario: justificativa.trim(),
          executadoPorId: usuario.id,
          executadoPorNome: nomeUsuario,
          sistema: false,
          revisao: instancia.revisao
        });

        const definicao =
          await persistencia.servico.definicaoDaInstancia(instancia);

        await persistencia.repositorio.salvar(
          instancia,
          {
            fluxoRegistroId: definicao ? definicao.registroId : undefined,
            rotuloRevisao: `${codigoLiberado} ${revisao.revisao}`
          }
        );
      } catch (error) {
        console.error(error);
        avisos.push(`O fluxo da ${revisao.revisao} não pôde ser cancelado; confira as pendências.`);
      }
    }

    // 2) Revisões: "Cancelada" (se a opção existir) e inativas.
    for (const revisao of revisoes) {
      try {
        await this.dataverse.alterarStatusDocumentoRevisao(revisao.id, STATUS_REVISAO_CANCELADA);
      } catch (error) {
        console.error(error);
        avisos.push(
          `A ${revisao.revisao} não pôde receber o status "Cancelada" ` +
          '(rode scripts/dataverse/adicionar-status-cancelada-revisao.ps1).'
        );
      }
      try {
        await this.dataverse.atualizarRegistro('dgt_documentorevisao', revisao.id, { dgt_ativa: false });
      } catch (error) {
        console.error(error);
      }
    }

    // 3) Vínculos com processos.
    try {
      const dados =
        await persistencia.processos.carregar(true, []);

      for (const vinculo of dados.vinculos.filter(item => item.documentoId === guid(documento.id))) {
        await persistencia.processos.removerVinculo(vinculo);
      }
    } catch (error) {
      console.error(error);
      avisos.push('Os vínculos com processos não puderam ser desativados; remova-os pela tela do processo.');
    }

    // 4) Pasta do SharePoint: renomeada, e os endereços das revisões
    //    passam a apontar para a pasta nova.
    if (this.sharePoint && documento.area) {
      try {
        const pasta =
          await this.sharePoint.renomearPastaDocumento(documento.area, codigoLiberado, codigoArquivado);

        if (pasta) {
          for (const revisao of revisoes.filter(item => !!item.arquivoUrl)) {
            const url = revisao.arquivoUrl as string;
            let novaUrl = url;
            try {
              const endereco = new URL(url);
              const caminho = decodeURI(endereco.pathname);
              if (caminho.toLowerCase().indexOf(pasta.antigo.toLowerCase() + '/') === 0) {
                novaUrl = `${endereco.origin}${encodeURI(pasta.novo + caminho.substring(pasta.antigo.length))}`;
              }
            } catch {
              novaUrl = url;
            }
            if (novaUrl !== url) {
              await this.dataverse.atualizarRegistro('dgt_documentorevisao', revisao.id, { dgt_arquivourl: novaUrl });
            }
          }
        }
      } catch (error) {
        console.error(error);
        avisos.push(
          'A pasta do documento no SharePoint não pôde ser renomeada. Um novo documento com o mesmo código ' +
          'usará a mesma pasta (arquivos com o mesmo nome seriam substituídos).'
        );
      }
    }

    // 5) Documento: inativo, com o código arquivado (libera o original).
    await this.dataverse.atualizarRegistro(
      'dgt_documento',
      documento.id,
      {
        dgt_codigo: codigoArquivado,
        dgt_ativo: false,
        dgt_name: `[EXCLUÍDO] ${documento.titulo || codigoLiberado}`.substring(0, 100)
      }
    );

    // 6) Histórico.
    const aviso =
      await new DocumentoHistoricoService(this.dataverse)
        .registrarSemInterromper({
          documentoId: documento.id,
          tipo: 'OUTRO',
          titulo: 'Documento excluído (alterado por administrador)',
          descricao:
            `Documento ${codigoLiberado} excluído por ${nomeUsuario}. O código ${codigoLiberado} foi liberado para ` +
            `reutilização; este registro passou a ${codigoArquivado}. Justificativa: ${justificativa.trim()}`,
          motivo: justificativa.trim(),
          dadosAnteriores: { codigo: codigoLiberado, titulo: documento.titulo },
          usuarioId: usuario.id || undefined,
          usuarioNome: nomeUsuario
        });

    if (aviso) {
      avisos.push(aviso);
    }

    return { codigoLiberado, codigoArquivado, avisos };
  }
}
