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
  IDocumentoProcessoVinculo,
  IProcesso
} from '../models/Processo';

import {
  IContextoAcesso
} from '../services/AutorizacaoService';

import {
  DataverseService
} from '../services/DataverseService';

import {
  calcularProximaRevisao,
  obterRevisaoEmAndamento
} from '../services/DocumentoRevisaoFluxoService';

import {
  fluxoCatalogo
} from '../services/fluxo/FluxoCatalogoLocal';

import {
  FluxoRepositorioLocal
} from '../services/fluxo/FluxoRepositorioLocal';

import {
  FluxoService
} from '../services/fluxo/FluxoService';

import {
  carregarDadosProcessos,
  definirProcessoPrincipalTeste,
  processoPrincipalDoDocumento,
  vincularDocumentoTeste,
  vinculosDoDocumento
} from '../services/processos/ProcessoService';

// ============================================================
// HOOK — FLUXO DE REVISÃO EM MODO DE TESTE
//
// Documento → Processo (principal) → Fluxo publicado do processo
//           → Instância do fluxo nesta revisão
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

// Em que ponto a tela está:
//   semProcesso       → documento não vinculado a nenhum processo
//   escolherPrincipal → vinculado a vários; falta escolher qual governa
//   semFluxo          → o processo não tem fluxo publicado
//   pronto            → fluxo em andamento ou concluído
export type SituacaoFluxoRevisao =
  | 'carregando'
  | 'semProcesso'
  | 'escolherPrincipal'
  | 'semFluxo'
  | 'pronto'
  | 'erro';

export interface IUseFluxoRevisaoTeste {
  situacao: SituacaoFluxoRevisao;
  processando: boolean;
  erro: string;
  errosAcao: string[];
  avisoProcessos: string;
  revisaoAlvo?: IRevisaoAlvoFluxo;
  processos: IProcesso[];
  vinculos: IDocumentoProcessoVinculo[];
  processoAtual?: IProcesso;
  definicao?: IFluxoDefinicao;
  instancia?: IFluxoInstancia;
  atores: IAtorSimulado[];
  atorSelecionado?: IAtorSimulado;
  selecionarAtor: (chave: string) => void;
  vincularProcesso: (processoId: string) => Promise<void>;
  escolherPrincipal: (processoId: string) => Promise<void>;
  executar: (
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ) => Promise<boolean>;
  reiniciar: () => Promise<void>;
  recarregar: () => Promise<void>;
  limparErros: () => void;
}

// Um único serviço por carregamento da página.
const servico =
  new FluxoService(
    new FluxoRepositorioLocal(),
    fluxoCatalogo
  );

interface IPapelFluxo {
  papelTeste: string;
  tipo: string;
  descricao: string;
}

// Papéis (responsáveis) que aparecem nas etapas do fluxo.
const papeisDaDefinicao = (
  definicao: IFluxoDefinicao | undefined
): IPapelFluxo[] => {

  const lista: IPapelFluxo[] = [];

  if (!definicao) {
    return lista;
  }

  definicao.elementos.forEach(
    elemento => {
      elemento.responsaveis.forEach(
        responsavel => {
          if (
            responsavel.papelTeste &&
            !lista.some(item => item.papelTeste === responsavel.papelTeste)
          ) {
            lista.push({
              papelTeste: responsavel.papelTeste,
              tipo: responsavel.tipo,
              descricao: responsavel.descricao
            });
          }
        }
      );
    }
  );

  return lista;
};

// O que o usuário REAL poderia fazer, pelas regras disponíveis hoje:
//   - Administrador: todas as etapas (para testar);
//   - autor da revisão: etapas do tipo "Autor da revisão";
//   - Gestor: etapas do tipo "Gestor da área".
// Grupo, função, setor e usuário específico só serão resolvidos
// quando as tabelas existirem; até lá, use os usuários simulados.
const papeisDoUsuarioReal = (
  contexto: IContextoAcesso | undefined,
  revisaoResponsavelId: string | undefined,
  papeis: IPapelFluxo[]
): IPapelFluxo[] => {

  if (!contexto) {
    return [];
  }

  if (contexto.perfil === 'Administrador') {
    return papeis;
  }

  const ehAutor =
    !!contexto.usuarioId &&
    !!revisaoResponsavelId &&
    contexto.usuarioId === revisaoResponsavelId;

  return papeis.filter(
    papel =>
      (papel.tipo === 'autorRevisao' && ehAutor) ||
      (papel.tipo === 'gestorArea' && contexto.perfil === 'Gestor')
  );
};

export const useFluxoRevisaoTeste = (
  documento: IDocumento | undefined,
  revisoes: IDocumentoRevisao[],
  contexto: IContextoAcesso | undefined,
  dataverseService?: DataverseService
): IUseFluxoRevisaoTeste => {

  const [situacao, setSituacao] =
    React.useState<SituacaoFluxoRevisao>('carregando');

  const [instancia, setInstancia] =
    React.useState<IFluxoInstancia | undefined>(undefined);

  const [definicao, setDefinicao] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [processos, setProcessos] =
    React.useState<IProcesso[]>([]);

  const [vinculos, setVinculos] =
    React.useState<IDocumentoProcessoVinculo[]>([]);

  const [processoAtualId, setProcessoAtualId] =
    React.useState<string | undefined>(undefined);

  const [avisoProcessos, setAvisoProcessos] =
    React.useState<string>('');

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

        const papeis =
          papeisDaDefinicao(definicao);

        const papeisReais =
          papeisDoUsuarioReal(
            contexto,
            revisaoEmAndamento?.responsavelId,
            papeis
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
                ? `Seu acesso real permite agir como: ${papeisReais.map(papel => papel.descricao).join(', ')}.`
                : 'Com seu acesso real você não é responsável por nenhuma etapa deste fluxo. Use um usuário simulado.',
            ator: {
              id: contexto?.usuarioId || 'usuario-atual',
              nome: nomeReal,
              papeisTeste: papeisReais.map(papel => papel.papelTeste)
            }
          },
          ...papeis.map(
            papel => ({
              chave: papel.papelTeste,
              rotulo: `${papel.descricao} (simulado)`,
              descricao: `Pode executar as etapas de "${papel.descricao}".`,
              ator: {
                id: `simulado-${papel.papelTeste}`,
                nome: `${papel.descricao} (simulado)`,
                papeisTeste: [papel.papelTeste]
              }
            })
          )
        ];
      },
      [contexto, revisaoEmAndamento, definicao]
    );

  const atorSelecionado =
    atores.find(
      item => item.chave === atorChave
    ) || atores[0];

  const carregar =
    React.useCallback(
      async (
        forcarReleitura: boolean = false
      ): Promise<void> => {

        if (!documento || !revisaoAlvo) {
          setSituacao('erro');
          setErro('Documento não carregado.');
          return;
        }

        setSituacao('carregando');
        setErro('');

        try {

          const dados =
            await carregarDadosProcessos(
              dataverseService,
              forcarReleitura
            );

          setProcessos(dados.processos);
          setVinculos(dados.vinculos);
          setAvisoProcessos(dados.aviso);

          // 1) Revisão já tem fluxo? Ele vale até o fim, mesmo que o
          //    processo ou o fluxo do processo mudem depois.
          const existente =
            await servico.obter(revisaoAlvo.id);

          if (existente) {

            const definicaoExistente =
              await servico.definicaoDaInstancia(existente);

            setInstancia(existente);
            setDefinicao(definicaoExistente);
            setProcessoAtualId(existente.processoId);

            if (!definicaoExistente) {
              setErro(
                `A versão ${existente.fluxoVersao} do fluxo usada por esta revisão não foi encontrada neste navegador.`
              );
              setSituacao('erro');
              return;
            }

            setSituacao('pronto');
            return;
          }

          setInstancia(undefined);
          setDefinicao(undefined);

          // 2) Qual processo governa o documento?
          const doDocumento =
            vinculosDoDocumento(documento.id, dados.vinculos);

          if (doDocumento.length === 0) {
            setProcessoAtualId(undefined);
            setSituacao('semProcesso');
            return;
          }

          const principalId =
            processoPrincipalDoDocumento(documento.id, dados.vinculos);

          if (!principalId) {
            setProcessoAtualId(undefined);
            setSituacao('escolherPrincipal');
            return;
          }

          setProcessoAtualId(principalId);

          const processo =
            dados.processos.find(
              item => item.id === principalId
            );

          if (!processo) {
            setSituacao('semProcesso');
            return;
          }

          // 3) Inicia com a versão publicada do fluxo do processo.
          const resultado =
            await servico.iniciar(
              processo,
              {
                revisaoId: revisaoAlvo.id,
                documentoId: documento.id,
                revisao: revisaoAlvo.revisao,
                ator: atores[0].ator,
                simulado: true
              }
            );

          if (
            !resultado.ok ||
            !resultado.instancia
          ) {
            setSituacao('semFluxo');
            return;
          }

          setInstancia(resultado.instancia);
          setDefinicao(
            await servico.definicaoDaInstancia(resultado.instancia)
          );
          setSituacao('pronto');

        } catch (error) {

          console.error(error);

          setErro('Não foi possível carregar a simulação do fluxo.');
          setSituacao('erro');
        }
      },
      [documento, revisaoAlvo, atores, dataverseService]
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

  const vincularProcesso =
    async (
      processoId: string
    ): Promise<void> => {

      if (!documento) {
        return;
      }

      vincularDocumentoTeste(
        documento.id,
        processoId,
        vinculos
      );

      definirProcessoPrincipalTeste(
        documento.id,
        processoId
      );

      await carregar();
    };

  const escolherPrincipal =
    async (
      processoId: string
    ): Promise<void> => {

      if (!documento) {
        return;
      }

      definirProcessoPrincipalTeste(
        documento.id,
        processoId
      );

      await carregar();
    };

  return {
    situacao,
    processando,
    erro,
    errosAcao,
    avisoProcessos,
    revisaoAlvo,
    processos,
    vinculos: documento
      ? vinculosDoDocumento(documento.id, vinculos)
      : [],
    processoAtual: processos.find(
      item => item.id === processoAtualId
    ),
    definicao,
    instancia,
    atores,
    atorSelecionado,
    selecionarAtor: (chave: string) => {
      setAtorChave(chave);
      setErrosAcao([]);
    },
    vincularProcesso,
    escolherPrincipal,
    executar,
    reiniciar,
    recarregar: () => carregar(true),
    limparErros: () => setErrosAcao([])
  };
};
