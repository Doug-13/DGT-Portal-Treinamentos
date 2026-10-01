import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../models/Documento';

import {
  IFluxoAtor,
  IFluxoDefinicao,
  IFluxoInstancia
} from '../models/Fluxo';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  calcularProximaRevisao,
  obterRevisaoEmAndamento
} from '../services/DocumentoRevisaoFluxoService';

import {
  FluxoRepositorioLocal
} from '../services/fluxo/FluxoRepositorioLocal';

import {
  FluxoService
} from '../services/fluxo/FluxoService';

// ============================================================
// HOOK — FLUXO DE REVISÃO EM MODO DE TESTE
//
// Nada aqui grava no Dataverse. O estado fica no localStorage do
// navegador, por revisão.
// ============================================================

export interface IAtorSimulado {
  chave: string;
  rotulo: string;
  descricao: string;
  ator: IFluxoAtor;
}

export interface IRevisaoAlvoFluxo {
  id: string;
  revisao: string;

  // true = não existe revisão em andamento; a simulação usa uma
  // revisão "virtual" (próximo número).
  virtual: boolean;
}

export interface IUseFluxoRevisaoTeste {
  carregando: boolean;
  processando: boolean;
  erro: string;
  errosAcao: string[];
  revisaoAlvo?: IRevisaoAlvoFluxo;
  definicao?: IFluxoDefinicao;
  instancia?: IFluxoInstancia;
  atores: IAtorSimulado[];
  atorSelecionado?: IAtorSimulado;
  selecionarAtor: (chave: string) => void;
  executar: (
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ) => Promise<boolean>;
  reiniciar: () => Promise<void>;
  limparErros: () => void;
}

// Um único serviço por carregamento da página.
const servico =
  new FluxoService(
    new FluxoRepositorioLocal()
  );

const papeisDoUsuarioReal = (
  contexto: IContextoAcesso | undefined,
  revisaoResponsavelId: string | undefined
): string[] => {

  const papeis: string[] = [];

  if (!contexto) {
    return papeis;
  }

  if (
    contexto.usuarioId &&
    revisaoResponsavelId &&
    contexto.usuarioId === revisaoResponsavelId
  ) {
    papeis.push('autor');
  }

  if (
    contexto.perfil === 'Gestor' ||
    contexto.perfil === 'Administrador'
  ) {
    papeis.push('coordenacao');
  }

  if (contexto.perfil === 'Administrador') {
    papeis.push('qualidade');

    if (papeis.indexOf('autor') < 0) {
      papeis.push('autor');
    }
  }

  return papeis;
};

const DESCRICAO_PAPEL: Record<string, string> = {
  autor: 'autor da revisão',
  coordenacao: 'gestor da área',
  qualidade: 'Qualidade'
};

export const useFluxoRevisaoTeste = (
  documento: IDocumento | undefined,
  revisoes: IDocumentoRevisao[],
  contexto: IContextoAcesso | undefined
): IUseFluxoRevisaoTeste => {

  const [instancia, setInstancia] =
    React.useState<IFluxoInstancia | undefined>(undefined);

  const [carregando, setCarregando] =
    React.useState<boolean>(true);

  const [processando, setProcessando] =
    React.useState<boolean>(false);

  const [erro, setErro] =
    React.useState<string>('');

  const [errosAcao, setErrosAcao] =
    React.useState<string[]>([]);

  const [atorChave, setAtorChave] =
    React.useState<string>('eu');

  const revisaoEmAndamento =
    React.useMemo(
      () => obterRevisaoEmAndamento(revisoes || []),
      [revisoes]
    );

  const revisaoAlvo: IRevisaoAlvoFluxo | undefined =
    React.useMemo(
      () => {

        if (!documento) {
          return undefined;
        }

        if (revisaoEmAndamento) {
          return {
            id: revisaoEmAndamento.id,
            revisao: revisaoEmAndamento.revisao,
            virtual: false
          };
        }

        return {
          id: `virtual-${documento.id}`,
          revisao: calcularProximaRevisao(revisoes || []),
          virtual: true
        };
      },
      [documento, revisaoEmAndamento, revisoes]
    );

  const atores: IAtorSimulado[] =
    React.useMemo(
      () => {

        const papeisReais =
          papeisDoUsuarioReal(
            contexto,
            revisaoEmAndamento?.responsavelId
          );

        const nomeReal =
          contexto?.nome ||
          contexto?.email ||
          'Usuário atual';

        return [
          {
            chave: 'eu',
            rotulo: `Eu (${nomeReal})`,
            descricao:
              papeisReais.length > 0
                ? `Seu acesso real permite agir como: ${papeisReais.map(papel => DESCRICAO_PAPEL[papel] || papel).join(', ')}.`
                : 'Com seu acesso real você não é responsável por nenhuma etapa deste fluxo.',
            ator: {
              id: contexto?.usuarioId || 'usuario-atual',
              nome: nomeReal,
              papeisTeste: papeisReais
            }
          },
          {
            chave: 'autor',
            rotulo: 'Autor da revisão (simulado)',
            descricao: 'Pode executar a etapa Elaboração.',
            ator: {
              id: 'simulado-autor',
              nome: 'Autor (simulado)',
              papeisTeste: ['autor']
            }
          },
          {
            chave: 'coordenacao',
            rotulo: 'Gestor da área (simulado)',
            descricao: 'Pode executar a etapa Revisão técnica.',
            ator: {
              id: 'simulado-coordenacao',
              nome: 'Gestor da área (simulado)',
              papeisTeste: ['coordenacao']
            }
          },
          {
            chave: 'qualidade',
            rotulo: 'Qualidade (simulado)',
            descricao: 'Pode executar a etapa Aprovação.',
            ator: {
              id: 'simulado-qualidade',
              nome: 'Qualidade (simulado)',
              papeisTeste: ['qualidade']
            }
          }
        ];
      },
      [contexto, revisaoEmAndamento]
    );

  const atorSelecionado =
    atores.find(
      item => item.chave === atorChave
    ) || atores[0];

  const carregar =
    React.useCallback(
      async (): Promise<void> => {

        if (!documento || !revisaoAlvo) {
          setInstancia(undefined);
          setCarregando(false);
          return;
        }

        setCarregando(true);
        setErro('');

        try {

          const resultado =
            await servico.iniciar(
              documento.tipo,
              {
                revisaoId: revisaoAlvo.id,
                documentoId: documento.id,
                revisao: revisaoAlvo.revisao,
                ator: atores[0].ator,
                simulado: true
              }
            );

          if (!resultado.ok) {
            setErro(resultado.erros.join(' '));
          }

          setInstancia(resultado.instancia);

        } catch (error) {

          console.error(error);

          setErro(
            'Não foi possível carregar a simulação do fluxo.'
          );

        } finally {
          setCarregando(false);
        }
      },
      [documento, revisaoAlvo, atores]
    );

  React.useEffect(
    () => {
      carregar()
        .catch(
          (error: unknown) => console.error(error)
        );
    },
    [documento?.id, revisaoAlvo?.id]
  );

  const definicao =
    instancia
      ? servico.definicaoDaInstancia(instancia)
      : undefined;

  const executar =
    async (
      acaoChave: string,
      comentario: string,
      valores: Record<string, string>
    ): Promise<boolean> => {

      if (!revisaoAlvo || !atorSelecionado) {
        return false;
      }

      setProcessando(true);
      setErrosAcao([]);

      try {

        const resultado =
          await servico.executar(
            revisaoAlvo.id,
            {
              acaoChave,
              comentario,
              valores,
              ator: atorSelecionado.ator
            }
          );

        if (!resultado.ok) {
          setErrosAcao(resultado.erros);
          return false;
        }

        setInstancia(resultado.instancia);
        return true;

      } catch (error) {

        console.error(error);

        setErrosAcao([
          'Erro inesperado ao executar a ação.'
        ]);

        return false;

      } finally {
        setProcessando(false);
      }
    };

  const reiniciar =
    async (): Promise<void> => {

      if (!revisaoAlvo) {
        return;
      }

      await servico.reiniciar(revisaoAlvo.id);

      setErrosAcao([]);

      await carregar();
    };

  return {
    carregando,
    processando,
    erro,
    errosAcao,
    revisaoAlvo,
    definicao,
    instancia,
    atores,
    atorSelecionado,
    selecionarAtor: (chave: string) => {
      setAtorChave(chave);
      setErrosAcao([]);
    },
    executar,
    reiniciar,
    limparErros: () => setErrosAcao([])
  };
};
