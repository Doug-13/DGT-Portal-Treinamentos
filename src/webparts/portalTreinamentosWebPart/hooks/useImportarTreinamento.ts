import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  IDgtTrainingJsonV1,
  IResultadoValidacaoImport,
  validarDgtTrainingJsonV1
} from '../services/TreinamentoImportValidator';

import {
  IResultadoImportacaoTreinamento,
  TreinamentoImportService
} from '../services/TreinamentoImportService';

export interface IUseImportarTreinamento {
  arquivoNome:
    string;

  dados?:
    IDgtTrainingJsonV1;

  validacao:
    IResultadoValidacaoImport;

  lendo:
    boolean;

  importando:
    boolean;

  erro:
    string;

  resultado?:
    IResultadoImportacaoTreinamento;

  carregarArquivo:
    (
      arquivo:
        File
    ) => Promise<void>;

  importar:
    () => Promise<void>;

  limpar:
    () => void;
}

const validacaoInicial:
  IResultadoValidacaoImport = {
  valido:
    false,

  erros: [],

  avisos: []
};

export const useImportarTreinamento =
  (
    dataverse:
      DataverseService
  ):
    IUseImportarTreinamento => {

    const service =
      React.useMemo(
        () =>
          new TreinamentoImportService(
            dataverse
          ),
        [
          dataverse
        ]
      );

    const [
      arquivoNome,
      setArquivoNome
    ] =
      React.useState('');

    const [
      dados,
      setDados
    ] =
      React.useState<
        IDgtTrainingJsonV1 | undefined
      >(
        undefined
      );

    const [
      validacao,
      setValidacao
    ] =
      React.useState<
        IResultadoValidacaoImport
      >(
        validacaoInicial
      );

    const [
      lendo,
      setLendo
    ] =
      React.useState(
        false
      );

    const [
      importando,
      setImportando
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
      resultado,
      setResultado
    ] =
      React.useState<
        IResultadoImportacaoTreinamento | undefined
      >(
        undefined
      );

    const carregarArquivo =
      React.useCallback(
        async (
          arquivo:
            File
        ): Promise<void> => {

          setLendo(
            true
          );

          setErro('');
          setResultado(
            undefined
          );

          try {

            if (
              !arquivo.name
                .toLowerCase()
                .endsWith(
                  '.json'
                )
            ) {
              throw new Error(
                'Selecione um arquivo .json.'
              );
            }

            const texto =
              await arquivo.text();

            const bruto =
              JSON.parse(
                texto
              ) as unknown;

            const validado =
              validarDgtTrainingJsonV1(
                bruto
              );

            setArquivoNome(
              arquivo.name
            );

            setValidacao(
              validado.resultado
            );

            setDados(
              validado.dados
            );

          } catch (e) {

            setArquivoNome(
              arquivo.name
            );

            setDados(
              undefined
            );

            setValidacao(
              validacaoInicial
            );

            setErro(
              e instanceof Error
                ? e.message
                : 'Não foi possível ler o arquivo.'
            );

          } finally {

            setLendo(
              false
            );
          }
        },
        []
      );

    const importar =
      React.useCallback(
        async (): Promise<void> => {

          if (
            !dados ||
            !validacao.valido
          ) {
            throw new Error(
              'O arquivo precisa estar válido antes da importação.'
            );
          }

          setImportando(
            true
          );

          setErro('');
          setResultado(
            undefined
          );

          try {

            const retorno =
              await service
                .importar(
                  dados
                );

            setResultado(
              retorno
            );

          } catch (e) {

            setErro(
              e instanceof Error
                ? e.message
                : 'Erro ao importar treinamento.'
            );

            throw e;

          } finally {

            setImportando(
              false
            );
          }
        },
        [
          dados,
          service,
          validacao.valido
        ]
      );

    const limpar =
      React.useCallback(
        (): void => {

          setArquivoNome('');
          setDados(
            undefined
          );

          setValidacao(
            validacaoInicial
          );

          setErro('');
          setResultado(
            undefined
          );
        },
        []
      );

    return {
      arquivoNome,
      dados,
      validacao,
      lendo,
      importando,
      erro,
      resultado,
      carregarArquivo,
      importar,
      limpar
    };
  };
