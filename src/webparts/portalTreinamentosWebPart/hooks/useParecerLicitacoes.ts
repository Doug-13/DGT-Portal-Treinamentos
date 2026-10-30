import * as React from 'react';

import {
  DataverseService
} from '../services/DataverseService';

import {
  DecisaoParecer,
  ILicitacaoResultado,
  IParecerLicitacao,
  ISituacaoParecer
} from '../models/Licitacao';

import {
  LicitacaoParecerService,
  agruparPorEdital,
  ehErroTabelaInexistente,
  gerarChaveEdital
} from '../services/LicitacaoParecerService';

// ============================================================
// MÓDULO LICITAÇÕES — ESTADO DOS PARECERES
//
// Carrega todos os pareceres uma vez ao abrir a tela. Como a
// chave do edital é estável, qualquer nova busca no PNCP já
// mostra o parecer dado anteriormente para o mesmo edital.
// ============================================================

export type SituacaoPareceres =
  | 'semConexao'
  | 'carregando'
  | 'ok'
  | 'tabelaInexistente'
  | 'erro';

export interface IUseParecerLicitacoes {
  situacao: SituacaoPareceres;
  erro?: string;
  total: number;
  podeRegistrar: boolean;
  // Parecer vigente de cada edital (base de conhecimento da IA).
  atuais: IParecerLicitacao[];
  obter: (item: ILicitacaoResultado) => ISituacaoParecer | undefined;
  // Histórico de um edital pela chave (mais recente primeiro).
  historicoDe: (chaveEdital: string) => IParecerLicitacao[];
  consultarNovoDeOutraPessoa: (item: ILicitacaoResultado) => Promise<IParecerLicitacao | undefined>;
  registrar: (
    item: ILicitacaoResultado,
    decisao: DecisaoParecer,
    justificativa: string
  ) => Promise<IParecerLicitacao>;
  recarregar: () => void;
}

export const useParecerLicitacoes = (
  dataverseService?: DataverseService,
  nomeUsuario?: string
): IUseParecerLicitacoes => {

  const servico = React.useMemo(
    () => (dataverseService ? new LicitacaoParecerService(dataverseService) : undefined),
    [dataverseService]
  );

  const [pareceres, setPareceres] = React.useState<IParecerLicitacao[]>([]);
  const [situacao, setSituacao] = React.useState<SituacaoPareceres>(servico ? 'carregando' : 'semConexao');
  const [erro, setErro] = React.useState<string | undefined>(undefined);
  const [versao, setVersao] = React.useState<number>(0);

  React.useEffect(() => {

    if (!servico) {
      setSituacao('semConexao');
      return undefined;
    }

    let ativo = true;

    setSituacao('carregando');
    setErro(undefined);

    servico.listar()
      .then(lista => {
        if (ativo) {
          setPareceres(lista);
          setSituacao('ok');
        }
      })
      .catch(falha => {
        if (!ativo) {
          return;
        }
        console.error('[Licitações] Falha ao carregar pareceres:', falha);
        if (ehErroTabelaInexistente(falha)) {
          setSituacao('tabelaInexistente');
        } else {
          setSituacao('erro');
          setErro((falha as Error).message);
        }
      });

    return () => {
      ativo = false;
    };
  }, [servico, versao]);

  const porEdital = React.useMemo(
    () => agruparPorEdital(pareceres),
    [pareceres]
  );

  const obter = React.useCallback(
    (item: ILicitacaoResultado): ISituacaoParecer | undefined =>
      porEdital[gerarChaveEdital(item)],
    [porEdital]
  );

  // Lê do Dataverse o parecer vigente do edital. Se outra pessoa
  // registrou depois que esta tela carregou, ele entra na tela e é
  // devolvido para a página avisar antes de registrar de novo.
  const consultarNovoDeOutraPessoa = React.useCallback(
    async (item: ILicitacaoResultado): Promise<IParecerLicitacao | undefined> => {
      if (!servico) {
        return undefined;
      }
      const vigente = await servico.obterVigente(gerarChaveEdital(item)).catch(() => undefined);
      if (!vigente) {
        return undefined;
      }
      const local = porEdital[gerarChaveEdital(item)];
      if (local && local.atual.id === vigente.id) {
        return undefined;
      }
      setPareceres(atual => (atual.some(p => p.id === vigente.id) ? atual : [vigente].concat(atual)));
      return vigente;
    },
    [servico, porEdital]
  );

  const registrar = React.useCallback(
    async (
      item: ILicitacaoResultado,
      decisao: DecisaoParecer,
      justificativa: string
    ): Promise<IParecerLicitacao> => {

      if (!servico) {
        throw new Error('Conexão com o Dataverse indisponível nesta tela.');
      }

      const novo = await servico.registrar(item, decisao, justificativa, nomeUsuario || '');

      // Entra no topo (é o mais recente) sem precisar recarregar.
      setPareceres(atual => [novo].concat(atual));

      return novo;
    },
    [servico, nomeUsuario]
  );

  const recarregar = React.useCallback(
    (): void => setVersao(atual => atual + 1),
    []
  );

  const atuais = React.useMemo(
    () => Object.keys(porEdital).map(chave => porEdital[chave].atual),
    [porEdital]
  );

  return {
    situacao,
    erro,
    atuais,
    total: Object.keys(porEdital).length,
    podeRegistrar: situacao === 'ok',
    obter,
    historicoDe: (chave: string) => (porEdital[chave] ? porEdital[chave].historico : []),
    registrar,
    consultarNovoDeOutraPessoa,
    recarregar
  };
};

export default useParecerLicitacoes;
