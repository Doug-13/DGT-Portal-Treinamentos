import {
  IDocumento
} from '../../models/Documento';

import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoResponsavel
} from '../../models/Fluxo';

import {
  IDocumentoProcessoVinculo,
  IProcesso
} from '../../models/Processo';

import {
  DataverseService
} from '../DataverseService';

import {
  DocumentoHistoricoService
} from '../DocumentoHistoricoService';

import {
  estagioRevisao
} from '../DocumentoRevisaoFluxoService';

import {
  carregarVinculosPortal,
  obterAutorDaRevisao
} from '../fluxo/AutorRevisaoService';

import {
  IMapeamentoEtapa
} from '../fluxo/FluxoEngine';

import {
  obterPersistenciaFluxo
} from '../fluxo/persistenciaFluxo';

import {
  resolverResponsaveis
} from '../fluxo/ResolvedorResponsaveis';

// ============================================================
// TRANSFERIR DOCUMENTOS DE UM PROCESSO PARA OUTRO (administrador)
//
// Para cada documento vinculado ao processo de origem:
//   • revisão em andamento COM fluxo iniciado → a revisão passa para
//     o fluxo publicado do destino, NA MESMA ETAPA (pelo id da etapa;
//     se não houver, pelo nome);
//   • revisão em andamento sem fluxo iniciado, ou sem revisão em
//     andamento → só o vínculo muda (a próxima revisão segue o destino);
//   • revisões concluídas (vigentes/antigas) ficam como estão: o
//     histórico delas continua apontando para o processo de origem.
// O vínculo vai para o destino (mantendo "principal") e o de origem
// é desativado. Tudo fica registrado como alterado por administrador.
// ============================================================

export type SituacaoTransferencia =
  | 'transferivel'
  | 'soVinculo'
  | 'bloqueado';

export interface IItemTransferencia {
  documento: IDocumento;
  vinculo: IDocumentoProcessoVinculo;
  revisaoId?: string;
  revisao?: string;
  statusRevisao?: string;
  situacao: SituacaoTransferencia;
  etapaOrigem?: string;
  etapaDestino?: string;
  // Explica o que acontece (ou por que não pode).
  detalhe: string;
  avisos: string[];
  mapeamento: IMapeamentoEtapa[];
}

export interface IResultadoItemTransferencia {
  documento: IDocumento;
  ok: boolean;
  mensagem: string;
}

const guid = (
  valor: unknown
): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const texto = (
  registro: Record<string, unknown>,
  campo: string
): string =>
  registro[campo] === undefined || registro[campo] === null
    ? ''
    : String(registro[campo]);

export class TransferenciaProcessoService {

  private readonly dataverse: DataverseService;

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  private get persistencia(): ReturnType<typeof obterPersistenciaFluxo> {
    return obterPersistenciaFluxo(this.dataverse);
  }

  // Revisões em andamento (não vigentes, não canceladas) por documento.
  private async revisoesEmAndamento(): Promise<Record<string, Record<string, unknown>>> {

    const registros =
      await this.dataverse.getDocumentoRevisoesEmAndamento();

    const mapa: Record<string, Record<string, unknown>> = {};

    registros.forEach(
      registro => {
        const status =
          texto(registro, 'dgt_status@OData.Community.Display.V1.FormattedValue');
        const estagio = estagioRevisao(status);
        if (estagio === 'vigente' || estagio === 'cancelada') {
          return;
        }
        mapa[guid(registro._dgt_documento_value)] = registro;
      }
    );

    return mapa;
  }

  private ator(
    nome: string,
    id: string
  ): IFluxoAtor {
    return {
      id: id || 'administrador',
      nome: `${nome || 'Administrador'} (Administrador)`,
      papeisTeste: []
    };
  }

  // ----------------------------------------------------------
  // ANÁLISE (nada é gravado)
  // ----------------------------------------------------------

  public async analisar(
    origem: IProcesso,
    destino: IProcesso,
    vinculos: IDocumentoProcessoVinculo[],
    documentos: IDocumento[]
  ): Promise<{ definicaoDestino?: IFluxoDefinicao; itens: IItemTransferencia[] }> {

    const servico =
      this.persistencia.servico;

    const definicaoDestino =
      await servico.definicaoPublicada(destino.id);

    const doOrigem =
      vinculos.filter(item => item.processoId === guid(origem.id));

    if (!definicaoDestino) {
      return {
        itens: doOrigem.map(
          vinculo => ({
            documento: documentos.find(item => guid(item.id) === vinculo.documentoId) ||
              ({ id: vinculo.documentoId, codigo: vinculo.documentoCodigo || vinculo.documentoId, titulo: '' } as IDocumento),
            vinculo,
            situacao: 'bloqueado',
            detalhe: `O processo ${destino.nome} não tem fluxo publicado.`,
            avisos: [],
            mapeamento: []
          })
        )
      };
    }

    const emAndamento =
      await this.revisoesEmAndamento();

    const itens: IItemTransferencia[] = [];

    for (const vinculo of doOrigem) {

      const documento =
        documentos.find(item => guid(item.id) === vinculo.documentoId);

      if (!documento) {
        itens.push({
          documento: { id: vinculo.documentoId, codigo: vinculo.documentoCodigo || vinculo.documentoId, titulo: '' } as IDocumento,
          vinculo,
          situacao: 'bloqueado',
          detalhe: 'Documento não encontrado (inativo ou sem permissão de leitura).',
          avisos: [],
          mapeamento: []
        });
        continue;
      }

      const registro =
        emAndamento[guid(documento.id)];

      if (!registro) {
        itens.push({
          documento,
          vinculo,
          situacao: 'soVinculo',
          detalhe: 'Sem revisão em andamento: só o vínculo muda; a próxima revisão seguirá o fluxo do destino.',
          avisos: [],
          mapeamento: []
        });
        continue;
      }

      const revisaoId =
        guid(registro.dgt_documentorevisaoid);

      const base = {
        documento,
        vinculo,
        revisaoId,
        revisao: texto(registro, 'dgt_revisao'),
        statusRevisao: texto(registro, 'dgt_status@OData.Community.Display.V1.FormattedValue')
      };

      const instancia =
        await servico.obter(revisaoId);

      if (!instancia) {
        itens.push({
          ...base,
          situacao: 'soVinculo',
          detalhe: 'Revisão sem fluxo iniciado: só o vínculo muda; ao abrir a aba Fluxo de revisão ela começa no fluxo do destino.',
          avisos: estagioRevisao(base.statusRevisao) !== 'elaboracao'
            ? ['A revisão já saiu da Elaboração pelo fluxo padrão e terminará nele.']
            : [],
          mapeamento: []
        });
        continue;
      }

      if (instancia.status !== 'emAndamento') {
        itens.push({
          ...base,
          situacao: 'soVinculo',
          detalhe: 'O fluxo desta revisão já foi encerrado: só o vínculo muda.',
          avisos: [],
          mapeamento: []
        });
        continue;
      }

      const previa =
        await servico.transferirParaProcesso(
          revisaoId,
          definicaoDestino,
          {
            processoId: guid(destino.id),
            processoNome: destino.nome,
            ator: this.ator('', ''),
            justificativa: 'prévia'
          },
          false
        );

      itens.push({
        ...base,
        situacao: previa.ok ? 'transferivel' : 'bloqueado',
        etapaOrigem: previa.etapaOrigem,
        etapaDestino: previa.etapaDestino,
        detalhe: previa.ok
          ? `A revisão continua na etapa "${previa.etapaDestino}" do fluxo v${definicaoDestino.versao}.`
          : previa.erros.join(' '),
        avisos: previa.avisos,
        mapeamento: previa.mapeamento
      });
    }

    return { definicaoDestino, itens };
  }

  // ----------------------------------------------------------
  // ATUALIZAR PARA A VERSÃO PUBLICADA (mesmo processo)
  //
  // Revisões em andamento do processo que estão numa versão ANTIGA
  // do fluxo passam para a versão publicada, na mesma etapa. A partir
  // daí seguem o fluxo novo: novas etapas DEPOIS da atual passam a
  // fazer parte do caminho; responsáveis e opções da etapa atual são
  // os da versão nova. Nada é feito nos vínculos.
  // ----------------------------------------------------------

  public async analisarAtualizacao(
    processo: IProcesso,
    vinculos: IDocumentoProcessoVinculo[],
    documentos: IDocumento[]
  ): Promise<{ definicaoDestino?: IFluxoDefinicao; itens: IItemTransferencia[]; atualizadas: number }> {

    const servico =
      this.persistencia.servico;

    const definicaoDestino =
      await servico.definicaoPublicada(processo.id);

    if (!definicaoDestino) {
      return { itens: [], atualizadas: 0 };
    }

    const emAndamento =
      await this.revisoesEmAndamento();

    const itens: IItemTransferencia[] = [];

    let atualizadas = 0;

    const doProcesso =
      vinculos.filter(item => item.processoId === guid(processo.id));

    for (const vinculo of doProcesso) {

      const documento =
        documentos.find(item => guid(item.id) === vinculo.documentoId);

      const registro =
        documento ? emAndamento[guid(documento.id)] : undefined;

      if (!documento || !registro) {
        continue;
      }

      const revisaoId =
        guid(registro.dgt_documentorevisaoid);

      const instancia =
        await servico.obter(revisaoId);

      // Sem fluxo iniciado (começa na versão publicada), encerrado ou
      // de outro processo: nada a fazer.
      if (
        !instancia ||
        instancia.status !== 'emAndamento' ||
        guid(instancia.processoId) !== guid(processo.id)
      ) {
        continue;
      }

      if (instancia.fluxoVersao >= definicaoDestino.versao) {
        atualizadas++;
        continue;
      }

      const base = {
        documento,
        vinculo,
        revisaoId,
        revisao: texto(registro, 'dgt_revisao'),
        statusRevisao: texto(registro, 'dgt_status@OData.Community.Display.V1.FormattedValue')
      };

      const previa =
        await servico.transferirParaProcesso(
          revisaoId,
          definicaoDestino,
          {
            processoId: guid(processo.id),
            processoNome: processo.nome,
            ator: this.ator('', ''),
            justificativa: '',
            tipo: 'versao'
          },
          false
        );

      itens.push({
        ...base,
        situacao: previa.ok ? 'transferivel' : 'bloqueado',
        etapaOrigem: previa.etapaOrigem ? `${previa.etapaOrigem} (v${instancia.fluxoVersao})` : undefined,
        etapaDestino: previa.etapaDestino,
        detalhe: previa.ok
          ? `Passa para a v${definicaoDestino.versao} na etapa "${previa.etapaDestino}".`
          : `${previa.erros.join(' ')} Continua na v${instancia.fluxoVersao} até concluir.`,
        avisos: previa.avisos,
        mapeamento: previa.mapeamento
      });
    }

    return { definicaoDestino, itens, atualizadas };
  }

  public async atualizarVersao(
    itens: IItemTransferencia[],
    processo: IProcesso,
    definicaoDestino: IFluxoDefinicao,
    usuario: { id: string; nome: string }
  ): Promise<IResultadoItemTransferencia[]> {

    const persistencia =
      this.persistencia;

    const vinculosUsuarios =
      await carregarVinculosPortal(this.dataverse);

    const ator: IFluxoAtor = {
      id: usuario.id || 'usuario',
      nome: usuario.nome || 'Usuário',
      papeisTeste: []
    };

    const resultados: IResultadoItemTransferencia[] = [];

    for (const item of itens) {

      if (item.situacao !== 'transferivel' || !item.revisaoId) {
        resultados.push({ documento: item.documento, ok: false, mensagem: item.detalhe });
        continue;
      }

      try {
        const autor =
          await obterAutorDaRevisao(this.dataverse, item.revisaoId);

        const resultado =
          await persistencia.servico.transferirParaProcesso(
            item.revisaoId,
            definicaoDestino,
            {
              processoId: guid(processo.id),
              processoNome: processo.nome,
              ator,
              justificativa: `Atualização para a versão ${definicaoDestino.versao} do fluxo.`,
              tipo: 'versao'
            },
            true,
            {
              rotuloRevisao: `${item.documento.codigo} ${item.revisao || ''}`.trim(),
              resolverResponsaveis: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>) =>
                resolverResponsaveis(
                  responsaveis,
                  { revisaoResponsavelId: autor, documentoAreaId: item.documento.areaId, valores },
                  vinculosUsuarios
                )
            }
          );

        resultados.push({
          documento: item.documento,
          ok: resultado.ok,
          mensagem: resultado.ok
            ? `Atualizado para a v${definicaoDestino.versao}, etapa "${resultado.etapaDestino}".`
            : resultado.erros.join(' ')
        });

      } catch (error) {
        console.error(error);
        resultados.push({
          documento: item.documento,
          ok: false,
          mensagem: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return resultados;
  }

  // ----------------------------------------------------------
  // EXECUÇÃO
  // ----------------------------------------------------------

  public async transferir(
    itens: IItemTransferencia[],
    origem: IProcesso,
    destino: IProcesso,
    definicaoDestino: IFluxoDefinicao,
    justificativa: string,
    usuario: { id: string; nome: string }
  ): Promise<IResultadoItemTransferencia[]> {

    const persistencia =
      this.persistencia;

    const resultados: IResultadoItemTransferencia[] = [];

    const vinculosUsuarios =
      await carregarVinculosPortal(this.dataverse);

    const ator =
      this.ator(usuario.nome, usuario.id);

    for (const item of itens) {

      if (item.situacao === 'bloqueado') {
        resultados.push({ documento: item.documento, ok: false, mensagem: item.detalhe });
        continue;
      }

      try {

        // 1) Fluxo da revisão em andamento (antes do vínculo: se falhar,
        //    o documento continua inteiro no processo de origem).
        if (item.situacao === 'transferivel' && item.revisaoId) {

          const autor =
            await obterAutorDaRevisao(this.dataverse, item.revisaoId);

          const resultado =
            await persistencia.servico.transferirParaProcesso(
              item.revisaoId,
              definicaoDestino,
              {
                processoId: guid(destino.id),
                processoNome: destino.nome,
                ator,
                justificativa
              },
              true,
              {
                rotuloRevisao: `${item.documento.codigo} ${item.revisao || ''}`.trim(),
                resolverResponsaveis: (responsaveis: IFluxoResponsavel[], valores?: Record<string, string>) =>
                  resolverResponsaveis(
                    responsaveis,
                    { revisaoResponsavelId: autor, documentoAreaId: item.documento.areaId, valores },
                    vinculosUsuarios
                  )
              }
            );

          if (!resultado.ok) {
            resultados.push({ documento: item.documento, ok: false, mensagem: resultado.erros.join(' ') });
            continue;
          }
        }

        // 2) Vínculo: cria o do destino, passa o "principal" e desativa
        //    o de origem (nessa ordem, para o documento nunca ficar sem).
        const antes =
          (await persistencia.processos.carregar(true, [])).vinculos;

        await persistencia.processos.vincularDocumento(item.documento.id, destino.id, antes);

        if (item.vinculo.principal) {
          const depois =
            (await persistencia.processos.carregar(true, [])).vinculos;
          await persistencia.processos.definirPrincipal(item.documento.id, destino.id, depois);
        }

        await persistencia.processos.removerVinculo(item.vinculo);

        // 3) Histórico do documento.
        await new DocumentoHistoricoService(this.dataverse)
          .registrarSemInterromper({
            documentoId: item.documento.id,
            tipo: 'OUTRO',
            titulo: 'Processo alterado (alterado por administrador)',
            descricao:
              `Processo ${origem.codigo ? `${origem.codigo} — ` : ''}${origem.nome} → ` +
              `${destino.codigo ? `${destino.codigo} — ` : ''}${destino.nome}.` +
              (item.situacao === 'transferivel'
                ? ` Revisão ${item.revisao || ''} mantida na etapa "${item.etapaDestino}" (fluxo v${definicaoDestino.versao}).`
                : ' Só o vínculo foi alterado.') +
              ` Justificativa: ${justificativa.trim()}`,
            motivo: justificativa.trim(),
            usuarioId: usuario.id || undefined,
            usuarioNome: ator.nome
          });

        resultados.push({
          documento: item.documento,
          ok: true,
          mensagem:
            item.situacao === 'transferivel'
              ? `Transferido; revisão ${item.revisao || ''} na etapa "${item.etapaDestino}".`
              : 'Vínculo transferido.'
        });

      } catch (error) {
        console.error(error);
        resultados.push({
          documento: item.documento,
          ok: false,
          mensagem: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return resultados;
  }
}
