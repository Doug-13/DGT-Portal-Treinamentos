import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  AutorizacaoService,
  IContextoAcesso
} from '../services/AutorizacaoService';

export interface IUseAutorizacao {
  contexto?: IContextoAcesso;
  carregando: boolean;
  erro: string;
  recarregar: () => Promise<void>;
}

export const useAutorizacao = (
  dataverse:
    DataverseService,
  email:
    string
): IUseAutorizacao => {

  const [
    contexto,
    setContexto
  ] =
    React.useState<
      IContextoAcesso | undefined
    >(undefined);

  const [
    carregando,
    setCarregando
  ] =
    React.useState(
      true
    );

  const [
    erro,
    setErro
  ] =
    React.useState('');

  const service =
    React.useMemo(
      () =>
        new AutorizacaoService(
          dataverse
        ),
      [
        dataverse
      ]
    );

  const recarregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!email.trim()) {

          setContexto(
            undefined
          );

          setCarregando(
            false
          );

          setErro(
            'E-mail do usuário não informado.'
          );

          return;
        }

        setCarregando(
          true
        );

        setErro('');

        try {

          const retorno =
            await service
              .carregar(
                email
              );

          setContexto(
            retorno
          );

        } catch (e) {

          setContexto(
            undefined
          );

          setErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível carregar as permissões do usuário.'
          );

        } finally {

          setCarregando(
            false
          );
        }
      },
      [
        email,
        service
      ]
    );

  React.useEffect(
    () => {

      recarregar()
        .catch(
          (
            error:
              unknown
          ) =>
            console.error(
              error
            )
        );

    },
    [
      recarregar
    ]
  );

  return {
    contexto,
    carregando,
    erro,
    recarregar
  };
};