import {
  MSGraphClientV3
} from '@microsoft/sp-http';

import {
  normalizarDataGraph
} from '../../utils/fusoHorario';

export interface IEventoCalendario {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  local: string;
  organizador: string;
  webLink: string;
  joinUrl: string;
  online: boolean;
}

interface IGraphDateTime {
  dateTime?: string;
  timeZone?: string;
}

interface IGraphLocation {
  displayName?: string;
}

interface IGraphEmailAddress {
  name?: string;
  address?: string;
}

interface IGraphOrganizer {
  emailAddress?: IGraphEmailAddress;
}

interface IGraphOnlineMeeting {
  joinUrl?: string;
}

interface IGraphEvent {
  id?: string;
  subject?: string;
  start?: IGraphDateTime;
  end?: IGraphDateTime;
  isAllDay?: boolean;
  location?: IGraphLocation;
  organizer?: IGraphOrganizer;
  webLink?: string;
  isOnlineMeeting?: boolean;
  onlineMeeting?: IGraphOnlineMeeting;
  onlineMeetingUrl?: string;
}

interface IGraphResponse {
  value?: IGraphEvent[];
}

const texto =
  (
    valor:
      string | undefined
  ): string =>
    (
      valor ||
      ''
    )
      .trim();

export class CalendarService {

  private readonly client:
    MSGraphClientV3;

  public constructor(
    client:
      MSGraphClientV3
  ) {
    this.client =
      client;
  }

  public async listarProximosEventos(
    dias = 15,
    limite = 5
  ): Promise<IEventoCalendario[]> {

    const inicio =
      new Date();

    const fim =
      new Date(
        inicio.getTime()
      );

    fim.setDate(
      fim.getDate() +
      dias
    );

    const resposta:
      IGraphResponse =
      await this.client
        .api(
          '/me/calendar/calendarView'
        )
        // Garante as datas em UTC; a tela converte para Brasília.
        .header(
          'Prefer',
          'outlook.timezone="UTC"'
        )
        .query({
          startDateTime:
            inicio.toISOString(),

          endDateTime:
            fim.toISOString()
        })
        .select(
          [
            'id',
            'subject',
            'start',
            'end',
            'isAllDay',
            'location',
            'organizer',
            'webLink',
            'isOnlineMeeting',
            'onlineMeeting',
            'onlineMeetingUrl'
          ]
            .join(',')
        )
        .orderby(
          'start/dateTime'
        )
        .top(
          limite
        )
        .get();

    const eventos =
      resposta.value ||
      [];

    return eventos
      .map(
        (
          item:
            IGraphEvent
        ): IEventoCalendario => {

          const organizador =
            item.organizer
              ?.emailAddress;

          return {
            id:
              texto(
                item.id
              ),

            titulo:
              texto(
                item.subject
              ) ||
              'Evento',

            // ISO em UTC real (com "Z") — ver utils/fusoHorario.ts
            inicio:
              normalizarDataGraph(
                item.start?.dateTime,
                item.start?.timeZone,
                item.isAllDay
              ),

            fim:
              normalizarDataGraph(
                item.end?.dateTime,
                item.end?.timeZone,
                item.isAllDay
              ),

            diaInteiro:
              Boolean(
                item.isAllDay
              ),

            local:
              texto(
                item.location
                  ?.displayName
              ),

            organizador:
              texto(
                organizador
                  ?.name
              ) ||
              texto(
                organizador
                  ?.address
              ),

            webLink:
              texto(
                item.webLink
              ),

            joinUrl:
              texto(
                item.onlineMeeting
                  ?.joinUrl
              ) ||
              texto(
                item.onlineMeetingUrl
              ),

            online:
              Boolean(
                item.isOnlineMeeting ||
                item.onlineMeeting
                  ?.joinUrl ||
                item.onlineMeetingUrl
              )
          };
        }
      )
      .filter(
        item =>
          Boolean(
            item.id
          )
      );
  }
}
