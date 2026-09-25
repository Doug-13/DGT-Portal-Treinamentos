import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  SharePointDocumentoService
} from '../services/sharepoint/SharePointDocumentoService';

import {
  DocumentoRevisaoFluxoService,
  IUsuarioFluxo,
  resumirErro
} from '../services/DocumentoRevisaoFluxoService';

import {
  IResultadoPublicacaoRevisao
} from '../services/RevisaoDocumentoAdminService';

import {
  IDocumento,
  IDocumentoEvento,
  IDocumentoRevisao
} from '../models/Documento';

export interface IUseDocumentoRevisaoFluxo {
  processando: boolean;
  erro: string;
  aviso: string;

  eventos: IDocumentoEvento[];
  carregandoHistorico: boolean;
  erroHistorico: string;

  criarNovaRevisao: (
    dados: {
      motivoAlteracao: string;
      descricaoAlteracoes: string;
      arquivo?: File;
    }
  ) => Promise<boolean>;

  editarRevisao: (
    revisao: IDocumentoRevisao,
    dados: {
      motivoAlteracao: string;
      descricaoAlteracoes: string;
      arquivo?: File;
    }
  ) => Promise<boolean>;

  enviarParaAprovacao: (
    revisao: IDocumentoRevisao
  ) => Promise<boolean>;

  reprovar: (
    revisao: IDocumentoRevisao,
    motivo: string
  ) => Promise<boolean>;

  registrarPublicacao: (
    revisao: IDocumentoRevisao,
    resultado: IResultadoPublicacaoRevisao
  ) => Promise<void>;

  recarregarHistorico: () => Promise<void>;

  limparMensagens: () => void;
}

const mensagemErro = (
  e: unknown,
  padrao: string
): string =>
  e instanceof Error
    ? resumirErro(e.message) || padrao
    : padrao;

export const useDocumentoRevisaoFluxo = (
  dataverse: DataverseService | undefined,
  sharePoint: SharePointDocumentoService | undefined,
  documento: IDocumento | undefined,
  revisoes: IDocumentoRevisao[],
  usuario: IUsuarioFluxo,
  // Recarrega a lista de revisões na tela (vem do componente pai).
  onRecarregarRevisoes: () => Promise<void>
): IUseDocumentoRevisaoFluxo => {

  const [processando, setProcessando] =
    React.useState(false);

  const [erro, setErro] =
    React.useState('');

  const [aviso, setAviso] =
    React.useState('');

  const [eventos, setEventos] =
    React.useState<IDocumentoEvento[]>([]);

  const [carregandoHistorico, setCarregandoHistorico] =
    React.useState(false);

  const [erroHistorico, setErroHistorico] =
    React.useState('');

  const service =
    React.useMemo(
      () =>
        dataverse && sharePoint
          ? new DocumentoRevisaoFluxoService(
            dataverse,
            sharePoint
          )
          : undefined,
      [
        dataverse,
        sharePoint
      ]
    );

  const recarregarHistorico =
    React.useCallback(
      async (): Promise<void> => {

        if (!service || !documento) {
          setEventos([]);
          return;
        }

        setCarregandoHistorico(true);
        setErroHistorico('');

        try {
          setEventos(
            await service.historicoService.listar(
              documento.id,
              revisoes
            )
          );
        } catch (e) {
          setErroHistorico(
            mensagemErro(
              e,
              'Erro ao carregar o histórico do documento.'
            )
          );
        } finally {
          setCarregandoHistorico(false);
        }
      },
      [
        service,
        documento,
        revisoes
      ]
    );

  // Sempre que as revisões mudam (ações, recarga), o histórico é
  // recarregado para refletir o que acabou de acontecer.
  React.useEffect(
    () => {
      recarregarHistorico()
        .catch(
          (error: unknown) =>
            console.error(error)
        );
    },
    [
      recarregarHistorico
    ]
  );

  const executar =
    React.useCallback(
      async (
        acao: (
          fluxo: DocumentoRevisaoFluxoService,
          doc: IDocumento
        ) => Promise<{ aviso: string }>,
        padraoErro: string
      ): Promise<boolean> => {

        if (!service || !documento) {
          setErro(
            'Serviços de documento não disponíveis nesta tela.'
          );
          return false;
        }

        setProcessando(true);
        setErro('');
        setAviso('');

        try {
          const resultado =
            await acao(
              service,
              documento
            );

          setAviso(
            resultado.aviso
          );

          await onRecarregarRevisoes();

          return true;
        } catch (e) {
          setErro(
            mensagemErro(
              e,
              padraoErro
            )
          );

          return false;
        } finally {
          setProcessando(false);
        }
      },
      [
        service,
        documento,
        onRecarregarRevisoes
      ]
    );

  const criarNovaRevisao =
    React.useCallback(
      (
        dados: {
          motivoAlteracao: string;
          descricaoAlteracoes: string;
          arquivo?: File;
        }
      ): Promise<boolean> =>
        executar(
          (fluxo, doc) =>
            fluxo.criarNovaRevisao({
              documento: doc,
              revisoes,
              motivoAlteracao: dados.motivoAlteracao,
              descricaoAlteracoes: dados.descricaoAlteracoes,
              arquivo: dados.arquivo,
              usuario
            }),
          'Erro ao criar a nova revisão.'
        ),
      [
        executar,
        service,
        documento,
        revisoes,
        usuario
      ]
    );

  const editarRevisao =
    React.useCallback(
      (
        revisao: IDocumentoRevisao,
        dados: {
          motivoAlteracao: string;
          descricaoAlteracoes: string;
          arquivo?: File;
        }
      ): Promise<boolean> =>
        executar(
          (fluxo, doc) =>
            fluxo.editarRevisao({
              documento: doc,
              revisao,
              motivoAlteracao: dados.motivoAlteracao,
              descricaoAlteracoes: dados.descricaoAlteracoes,
              arquivo: dados.arquivo,
              usuario
            }),
          'Erro ao salvar a revisão.'
        ),
      [
        executar,
        service,
        documento,
        usuario
      ]
    );

  const enviarParaAprovacao =
    React.useCallback(
      (
        revisao: IDocumentoRevisao
      ): Promise<boolean> =>
        executar(
          (fluxo, doc) =>
            fluxo.enviarParaAprovacao(
              doc,
              revisao,
              usuario
            ),
          'Erro ao enviar para aprovação.'
        ),
      [
        executar,
        service,
        documento,
        usuario
      ]
    );

  const reprovar =
    React.useCallback(
      (
        revisao: IDocumentoRevisao,
        motivo: string
      ): Promise<boolean> =>
        executar(
          (fluxo, doc) =>
            fluxo.reprovar(
              doc,
              revisao,
              motivo,
              usuario
            ),
          'Erro ao reprovar a revisão.'
        ),
      [
        executar,
        service,
        documento,
        usuario
      ]
    );

  const registrarPublicacao =
    React.useCallback(
      async (
        revisao: IDocumentoRevisao,
        resultado: IResultadoPublicacaoRevisao
      ): Promise<void> => {

        if (!service || !documento) {
          return;
        }

        try {
          const retorno =
            await service.registrarPublicacao(
              documento,
              revisao,
              revisoes,
              resultado,
              usuario
            );

          setAviso(retorno.aviso);

          await onRecarregarRevisoes();
        } catch (e) {
          setAviso(
            mensagemErro(
              e,
              'A revisão foi publicada, mas houve falha ao registrar o histórico.'
            )
          );
        }
      },
      [
        service,
        documento,
        revisoes,
        usuario,
        onRecarregarRevisoes
      ]
    );

  const limparMensagens =
    React.useCallback(
      (): void => {
        setErro('');
        setAviso('');
      },
      []
    );

  return {
    processando,
    erro,
    aviso,
    eventos,
    carregandoHistorico,
    erroHistorico,
    criarNovaRevisao,
    editarRevisao,
    enviarParaAprovacao,
    reprovar,
    registrarPublicacao,
    recarregarHistorico,
    limparMensagens
  };
};
