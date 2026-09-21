import * as React from 'react';

import {
  MSGraphClientV3
} from '@microsoft/sp-http';

import {
  CalendarService,
  IEventoCalendario
} from '../services/microsoft365/CalendarService';

export interface IUseCalendarEvents {
  eventos:
    IEventoCalendario[];

  carregando:
    boolean;

  erro:
    string;

  recarregar:
    () => Promise<void>;
}

export const useCalendarEvents =
  (
    graphClient:
      MSGraphClientV3 | undefined,
    dias = 15,
    limite = 5
  ):
    IUseCalendarEvents => {

    const [
      eventos,
      setEventos
    ] =
      React.useState<
        IEventoCalendario[]
      >([]);

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

    const carregar =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !graphClient
          ) {

            setEventos(
              []
            );

            setErro(
              'Microsoft Graph não foi inicializado.'
            );

            setCarregando(
              false
            );

            return;
          }

          setCarregando(
            true
          );

          setErro('');

          try {

            const service =
              new CalendarService(
                graphClient
              );

            setEventos(
              await service
                .listarProximosEventos(
                  dias,
                  limite
                )
            );

          } catch (e) {

            setEventos(
              []
            );

            setErro(
              e instanceof Error
                ? e.message
                : 'Não foi possível carregar os eventos do Microsoft 365.'
            );

          } finally {

            setCarregando(
              false
            );
          }
        },
        [
          graphClient,
          dias,
          limite
        ]
      );

    React.useEffect(
      () => {

        carregar()
          .catch(
            (
              error:
                unknown
            ) =>
              console.error(
                'Erro ao carregar calendário:',
                error
              )
          );

      },
      [
        carregar
      ]
    );

    return {
      eventos,
      carregando,
      erro,
      recarregar:
        carregar
    };
  };
