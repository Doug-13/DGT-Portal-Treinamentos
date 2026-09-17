import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IPublicarRevisao,
  IResultadoPublicacaoRevisao,
  RevisaoDocumentoAdminService
} from '../services/RevisaoDocumentoAdminService';

export interface IUseRevisaoDocumento {
  processando: boolean;
  erro: string;
  resultado?: IResultadoPublicacaoRevisao;

  publicar:
    (
      dados:
        IPublicarRevisao
    ) => Promise<IResultadoPublicacaoRevisao>;

  limparResultado:
    () => void;
}

export const useRevisaoDocumento = (
  dataverse: DataverseService
): IUseRevisaoDocumento => {

  const [
    processando,
    setProcessando
  ] =
    React.useState(false);

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const [
    resultado,
    setResultado
  ] =
    React.useState<
      IResultadoPublicacaoRevisao | undefined
    >(undefined);

  const service =
    React.useMemo(
      () =>
        new RevisaoDocumentoAdminService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const publicar =
    React.useCallback(
      async (
        dados:
          IPublicarRevisao
      ): Promise<IResultadoPublicacaoRevisao> => {

        setProcessando(true);
        setErro('');
        setResultado(
          undefined
        );

        try {
          const retorno =
            await service.publicar(
              dados
            );

          setResultado(
            retorno
          );

          return retorno;
        } catch (e) {
          const mensagem =
            e instanceof Error
              ? e.message
              : 'Erro ao publicar revisão documental.';

          setErro(
            mensagem
          );

          throw e;
        } finally {
          setProcessando(false);
        }
      },
      [
        service
      ]
    );

  const limparResultado =
    React.useCallback(
      (): void => {
        setResultado(
          undefined
        );
        setErro('');
      },
      []
    );

  return {
    processando,
    erro,
    resultado,
    publicar,
    limparResultado
  };
};
