import * as React from 'react';
import { DataverseService, IDataverseRecord } from '../services/DataverseService';
import {
  IAvaliacao,
  IAlternativaAvaliacao,
  IEnvioAvaliacao,
  IEstadoTentativasAvaliacao,
  IQuestaoAvaliacao,
  IResultadoAvaliacao
} from '../models/Avaliacao';

type Registro = IDataverseRecord;

const texto = (r: Registro, chave: string, padrao = ''): string => {
  const valor = r[chave];
  return valor === undefined || valor === null ? padrao : String(valor);
};

const numero = (r: Registro, chave: string, padrao = 0): number => {
  const valor = Number(r[chave]);
  return Number.isFinite(valor) ? valor : padrao;
};

const booleano = (r: Registro, chave: string, padrao = false): boolean => {
  const valor = r[chave];
  return typeof valor === 'boolean' ? valor : padrao;
};

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const embaralhar = <T,>(itens: T[]): T[] => {
  const resultado = itens.slice();

  for (let i = resultado.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const atual = resultado[i];
    resultado[i] = resultado[j];
    resultado[j] = atual;
  }

  return resultado;
};

export interface IUseAvaliacaoResult {
  avaliacao?: IAvaliacao;
  carregando: boolean;
  erro: string;
  inicio?: Date;
  tentativas: IEstadoTentativasAvaliacao;
  envioPreparado?: IEnvioAvaliacao;
  resultado?: IResultadoAvaliacao;
  processando: boolean;
  carregar: (
    treinamentoId: string,
    usuarioTreinamentoId?: string
  ) => Promise<boolean>;
  enviar: (
    usuarioTreinamentoId: string,
    respostas: Record<string, string[]>
  ) => Promise<IResultadoAvaliacao | undefined>;
  limparEnvio: () => void;
  resetar: () => void;
}

const estadoInicialTentativas: IEstadoTentativasAvaliacao = {
  realizadas: 0,
  permitidas: 0,
  restantes: 0,
  proximaTentativa: 1
};

export const useAvaliacao = (
  service: DataverseService
): IUseAvaliacaoResult => {
  const [avaliacao, setAvaliacao] = React.useState<IAvaliacao | undefined>();
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [inicio, setInicio] = React.useState<Date | undefined>();
  const [tentativas, setTentativas] =
    React.useState<IEstadoTentativasAvaliacao>(estadoInicialTentativas);
  const [envioPreparado, setEnvioPreparado] =
    React.useState<IEnvioAvaliacao | undefined>();
  const [resultado, setResultado] =
    React.useState<IResultadoAvaliacao | undefined>();
  const [processando, setProcessando] = React.useState(false);

  const resetar = React.useCallback((): void => {
    setAvaliacao(undefined);
    setErro('');
    setInicio(undefined);
    setTentativas(estadoInicialTentativas);
    setEnvioPreparado(undefined);
    setResultado(undefined);
    setProcessando(false);
  }, []);

  const carregar = React.useCallback(async (
    treinamentoId: string,
    usuarioTreinamentoId?: string
  ): Promise<boolean> => {
    setCarregando(true);
    setErro('');
    setEnvioPreparado(undefined);
    setResultado(undefined);

    try {
      const avaliacoes = await service.getAvaliacoesTreinamento(treinamentoId);

      if (avaliacoes.length === 0) {
        throw new Error('Nenhuma avaliação ativa foi localizada para este treinamento.');
      }

      const registro = avaliacoes[0];
      const avaliacaoId = guid(registro.dgt_avaliacaoid);

      const questoesRegistros = await service.getQuestoesAvaliacao(avaliacaoId);

      const questoesComAlternativas = await Promise.all(
        questoesRegistros.map(async (questaoRegistro): Promise<IQuestaoAvaliacao> => {
          const questaoId = guid(questaoRegistro.dgt_questaoid);
          const alternativasRegistros =
            await service.getAlternativasQuestao(questaoId);

          let alternativas: IAlternativaAvaliacao[] =
            alternativasRegistros.map(alternativaRegistro => ({
              id: guid(alternativaRegistro.dgt_alternativaid),
              texto: texto(alternativaRegistro, 'dgt_name'),
              ordem: numero(alternativaRegistro, 'dgt_ordem')
            }));

          if (booleano(registro, 'dgt_embaralharalternativas')) {
            alternativas = embaralhar(alternativas);
          }

          return {
            id: questaoId,
            nome: texto(questaoRegistro, 'dgt_name'),
            enunciado: texto(questaoRegistro, 'dgt_enunciado'),
            ordem: numero(questaoRegistro, 'dgt_ordem'),
            peso: numero(questaoRegistro, 'dgt_peso', 1),
            multiplasRespostas: booleano(
              questaoRegistro,
              'dgt_multiplasrespostas'
            ),
            alternativas
          };
        })
      );

      let questoes = questoesComAlternativas.slice();

      if (booleano(registro, 'dgt_embaralharquestoes')) {
        questoes = embaralhar(questoes);
      }

      const quantidadeConfigurada = numero(
        registro,
        'dgt_quantidadequestoes',
        questoes.length
      );

      if (
        booleano(registro, 'dgt_sortearquestoes') &&
        quantidadeConfigurada > 0 &&
        quantidadeConfigurada < questoes.length
      ) {
        questoes = questoes.slice(0, quantidadeConfigurada);
      }

      const tentativasPermitidas = numero(
        registro,
        'dgt_tentativaspermitidas',
        1
      );

      const tentativasRealizadas = usuarioTreinamentoId
        ? (
          await service.getTentativasUsuarioAvaliacao(
            usuarioTreinamentoId,
            avaliacaoId
          )
        ).length
        : 0;

      const restantes = Math.max(
        tentativasPermitidas - tentativasRealizadas,
        0
      );

      if (restantes <= 0) {
        throw new Error(
          `O limite de ${tentativasPermitidas} tentativa(s) desta avaliação foi atingido.`
        );
      }

      const novaAvaliacao: IAvaliacao = {
        id: avaliacaoId,
        nome: texto(registro, 'dgt_name', 'Avaliação'),
        descricao: texto(registro, 'dgt_descricao'),
        notaMinima: numero(registro, 'dgt_notaminima', 70),
        quantidadeQuestoes: quantidadeConfigurada,
        tentativasPermitidas,
        tempoLimiteMin: numero(registro, 'dgt_tempolimitemin', 0),
        sortearQuestoes: booleano(registro, 'dgt_sortearquestoes'),
        embaralharQuestoes: booleano(registro, 'dgt_embaralharquestoes'),
        embaralharAlternativas: booleano(
          registro,
          'dgt_embaralharalternativas'
        ),
        mostrarResultado: booleano(registro, 'dgt_mostrarresultado', true),
        mostrarRespostasCorretas: booleano(
          registro,
          'dgt_mostrarrespostascorretas',
          false
        ),
        questoes
      };

      setAvaliacao(novaAvaliacao);
      setTentativas({
        realizadas: tentativasRealizadas,
        permitidas: tentativasPermitidas,
        restantes,
        proximaTentativa: tentativasRealizadas + 1
      });
      setInicio(new Date());

      return true;
    } catch (e) {
      setAvaliacao(undefined);
      setInicio(undefined);
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível carregar a avaliação.'
      );
      return false;
    } finally {
      setCarregando(false);
    }
  }, [service]);

  const enviar = React.useCallback(async (
    usuarioTreinamentoId: string,
    respostas: Record<string, string[]>
  ): Promise<IResultadoAvaliacao | undefined> => {
    if (!avaliacao || !inicio) {
      setErro('A avaliação ainda não foi iniciada.');
      return undefined;
    }

    if (!usuarioTreinamentoId) {
      setErro('A atribuição do treinamento não foi localizada.');
      return undefined;
    }

    const termino = new Date();
    const tempoUtilizadoSeg = Math.max(
      Math.round((termino.getTime() - inicio.getTime()) / 1000),
      0
    );

    const payload: IEnvioAvaliacao = {
      usuarioTreinamentoId,
      avaliacaoId: avaliacao.id,
      dataInicio: inicio.toISOString(),
      dataTermino: termino.toISOString(),
      tempoUtilizadoSeg,
      numeroTentativa: tentativas.proximaTentativa,
      respostas: avaliacao.questoes.map(questao => ({
        questaoId: questao.id,
        alternativasSelecionadas: respostas[questao.id] || []
      }))
    };

    setEnvioPreparado(payload);
    setProcessando(true);
    setErro('');

    try {
      const novoResultado = await service.processarAvaliacao(payload);
      setResultado(novoResultado);

      setTentativas(atual => ({
        realizadas: atual.realizadas + 1,
        permitidas: atual.permitidas,
        restantes: novoResultado.tentativasRestantes,
        proximaTentativa: atual.proximaTentativa + 1
      }));

      return novoResultado;
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Não foi possível processar a avaliação.'
      );
      return undefined;
    } finally {
      setProcessando(false);
    }
  }, [avaliacao, inicio, service, tentativas.proximaTentativa]);

  const limparEnvio = React.useCallback((): void => {
    setEnvioPreparado(undefined);
    setResultado(undefined);
    setProcessando(false);
  }, []);

  return {
    avaliacao,
    carregando,
    erro,
    inicio,
    tentativas,
    envioPreparado,
    resultado,
    processando,
    carregar,
    enviar,
    limparEnvio,
    resetar
  };
};

export default useAvaliacao;
