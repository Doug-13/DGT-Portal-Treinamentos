import * as React from 'react';

import {
  DataverseService,
  IDataverseRecord
} from '../services/DataverseService';

import {
  IModuloTreinamento,
  StatusUsuarioModulo
} from '../models/Modulo';

type Registro =
  IDataverseRecord;

const texto =
  (
    registro:
      Registro,
    chave:
      string,
    padrao =
      ''
  ): string => {

    const valor =
      registro[
        chave
      ];

    return (
      valor ===
        null ||
      valor ===
        undefined
    )
      ? padrao
      : String(
          valor
        );
  };

const numero =
  (
    registro:
      Registro,
    chave:
      string,
    padrao =
      0
  ): number => {

    const valor =
      Number(
        registro[
          chave
        ]
      );

    return Number.isFinite(
      valor
    )
      ? valor
      : padrao;
  };

const booleano =
  (
    registro:
      Registro,
    chave:
      string,
    padrao =
      false
  ): boolean => {

    const valor =
      registro[
        chave
      ];

    return typeof valor ===
      'boolean'
      ? valor
      : padrao;
  };

const guid =
  (
    valor:
      unknown
  ): string =>
    String(
      valor ||
      ''
    )
      .replace(
        /[{}]/g,
        ''
      )
      .trim()
      .toLowerCase();

const nomeStatus =
  (
    status:
      number
  ): string => {

    switch (
      status
    ) {
      case StatusUsuarioModulo.EmAndamento:
        return 'Em andamento';

      case StatusUsuarioModulo.Concluido:
        return 'Concluído';

      default:
        return 'Não iniciado';
    }
  };

const nomeTipo =
  (
    tipo:
      number
  ): string => {

    const nomes:
      Record<
        number,
        string
      > = {
      100000000:
        'Documento',

      100000001:
        'Vídeo',

      100000002:
        'Página',

      100000003:
        'Conteúdo HTML',

      100000004:
        'Link externo',

      100000005:
        'Outro'
    };

    return nomes[
      tipo
    ] ||
      'Outro';
  };

export interface IUseModulosResult {

  modulos:
    IModuloTreinamento[];

  carregando:
    boolean;

  erro:
    string;

  processandoModuloId:
    string;

  progresso:
    number;

  avaliacaoLiberada:
    boolean;

  carregar:
    (
      treinamentoId:
        string,
      usuarioTreinamentoId?:
        string
    ) => Promise<void>;

  iniciar:
    (
      modulo:
        IModuloTreinamento
    ) => Promise<void>;

  concluir:
    (
      modulo:
        IModuloTreinamento
    ) => Promise<void>;
}

export const useModulos =
  (
    service:
      DataverseService
  ):
    IUseModulosResult => {

    const [
      modulos,
      setModulos
    ] =
      React.useState<
        IModuloTreinamento[]
      >([]);

    const [
      carregando,
      setCarregando
    ] =
      React.useState(
        false
      );

    const [
      erro,
      setErro
    ] =
      React.useState('');

    const [
      processandoModuloId,
      setProcessandoModuloId
    ] =
      React.useState('');

    const idsAtuais =
      React.useRef<{
        treinamentoId:
          string;

        usuarioTreinamentoId?:
          string;
      }>({
        treinamentoId:
          ''
      });

    const carregar =
      React.useCallback(
        async (
          treinamentoId:
            string,
          usuarioTreinamentoId?:
            string
        ): Promise<void> => {

          idsAtuais.current = {
            treinamentoId,
            usuarioTreinamentoId
          };

          setCarregando(
            true
          );

          setErro('');

          try {

            const [
              mestres,
              progressos
            ] =
              await Promise.all([
                service
                  .getModulosTreinamento(
                    treinamentoId
                  ),

                usuarioTreinamentoId
                  ? service
                    .getUsuarioModulos(
                      usuarioTreinamentoId
                    )
                  : Promise.resolve(
                    []
                  )
              ]);

            const progressoPorModulo =
              new Map<
                string,
                Registro
              >();

            progressos.forEach(
              item => {

                progressoPorModulo.set(
                  guid(
                    item
                      ._dgt_modulo_value
                  ),
                  item
                );
              }
            );

            const resultado:
              IModuloTreinamento[] =
              mestres.map(
                item => {

                  const id =
                    guid(
                      item
                        .dgt_moduloid
                    );

                  const progressoUsuario =
                    progressoPorModulo
                      .get(
                        id
                      );

                  const status =
                    progressoUsuario
                      ? numero(
                        progressoUsuario,
                        'dgt_status',
                        StatusUsuarioModulo
                          .NaoIniciado
                      )
                      : StatusUsuarioModulo
                        .NaoIniciado;

                  return {
                    id,

                    titulo:
                      texto(
                        item,
                        'dgt_titulo'
                      ),

                    descricao:
                      texto(
                        item,
                        'dgt_descricao'
                      ),

                    ordem:
                      numero(
                        item,
                        'dgt_ordem'
                      ),

                    duracaoMin:
                      numero(
                        item,
                        'dgt_duracaomin'
                      ),

                    tipoModulo:
                      numero(
                        item,
                        'dgt_tipomodulo'
                      ),

                    tipoModuloNome:
                      texto(
                        item,
                        'dgt_tipomodulo@OData.Community.Display.V1.FormattedValue',
                        nomeTipo(
                          numero(
                            item,
                            'dgt_tipomodulo'
                          )
                        )
                      ),

                    obrigatorio:
                      booleano(
                        item,
                        'dgt_obrigatorio'
                      ),

                    ativo:
                      booleano(
                        item,
                        'dgt_ativo',
                        true
                      ),

                    urlConteudo:
                      texto(
                        item,
                        'dgt_urlconteudo'
                      ),

                    usuarioModuloId:
                      progressoUsuario
                        ? guid(
                          progressoUsuario
                            .dgt_usuariomoduloid
                        )
                        : '',

                    statusModulo:
                      status,

                    statusModuloNome:
                      progressoUsuario
                        ? texto(
                          progressoUsuario,
                          'dgt_status@OData.Community.Display.V1.FormattedValue',
                          nomeStatus(
                            status
                          )
                        )
                        : nomeStatus(
                          status
                        ),

                    dataInicio:
                      progressoUsuario
                        ? texto(
                          progressoUsuario,
                          'dgt_datainicio'
                        )
                        : '',

                    dataConclusao:
                      progressoUsuario
                        ? texto(
                          progressoUsuario,
                          'dgt_dataconclusao'
                        )
                        : ''
                  };
                }
              );

            setModulos(
              resultado.sort(
                (
                  a,
                  b
                ) =>
                  a.ordem -
                  b.ordem
              )
            );

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao carregar módulos.'
            );

            setModulos(
              []
            );

          } finally {

            setCarregando(
              false
            );
          }
        },
        [
          service
        ]
      );

    const recarregar =
      React.useCallback(
        async (): Promise<void> => {

          const atual =
            idsAtuais.current;

          if (
            atual.treinamentoId
          ) {

            await carregar(
              atual.treinamentoId,
              atual.usuarioTreinamentoId
            );
          }
        },
        [
          carregar
        ]
      );

    const iniciar =
      React.useCallback(
        async (
          modulo:
            IModuloTreinamento
        ): Promise<void> => {

          const usuarioTreinamentoId =
            idsAtuais.current
              .usuarioTreinamentoId;

          if (
            !usuarioTreinamentoId
          ) {

            setErro(
              'A atribuição do treinamento não foi identificada.'
            );

            return;
          }

          setProcessandoModuloId(
            modulo.id
          );

          setErro('');

          try {

            let usuarioModuloId =
              modulo.usuarioModuloId;

            if (
              !usuarioModuloId
            ) {

              usuarioModuloId =
                await service
                  .garantirUsuarioModulo(
                    usuarioTreinamentoId,
                    modulo.id,
                    modulo.titulo
                  );
            }

            await service
              .iniciarUsuarioModulo(
                usuarioModuloId
              );

            await recarregar();

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao iniciar módulo.'
            );

          } finally {

            setProcessandoModuloId(
              ''
            );
          }
        },
        [
          service,
          recarregar
        ]
      );

    const concluir =
      React.useCallback(
        async (
          modulo:
            IModuloTreinamento
        ): Promise<void> => {

          if (
            !modulo.usuarioModuloId
          ) {

            setErro(
              'Registro de progresso do módulo não encontrado.'
            );

            return;
          }

          setProcessandoModuloId(
            modulo.id
          );

          setErro('');

          try {

            await service
              .concluirUsuarioModulo(
                modulo.usuarioModuloId
              );

            await recarregar();

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao concluir módulo.'
            );

          } finally {

            setProcessandoModuloId(
              ''
            );
          }
        },
        [
          service,
          recarregar
        ]
      );

    const obrigatorios =
      modulos.filter(
        modulo =>
          modulo.obrigatorio
      );

    const concluidos =
      obrigatorios.filter(
        modulo =>
          modulo.statusModulo ===
          StatusUsuarioModulo
            .Concluido
      ).length;

    const progresso =
      obrigatorios.length >
        0
        ? Math.round(
          (
            concluidos /
            obrigatorios.length
          ) *
          100
        )
        : 0;

    const avaliacaoLiberada =
      obrigatorios.length ===
        0 ||
      concluidos ===
        obrigatorios.length;

    return {
      modulos,
      carregando,
      erro,
      processandoModuloId,
      progresso,
      avaliacaoLiberada,
      carregar,
      iniciar,
      concluir
    };
  };

export default useModulos;
