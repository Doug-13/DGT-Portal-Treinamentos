import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  ICicloHomologacao,
  IFornecedor
} from '../../services/fornecedores/modeloFornecedores';

import {
  Aviso,
  COR,
  ajuda,
  botao
} from '../Kits/kitsComum';

import {
  ICardQuadro,
  QuadroKanban
} from './HomologacaoFornecedorView';

// ============================================================
// FORNECEDORES — QUADRO GERAL DE HOMOLOGAÇÕES
//
// Todos os ciclos em aberto e os concluídos nos últimos 60 dias. Clicar
// no card abre o fornecedor na aba Homologação (onde o card é editado).
// Arrastar entre colunas abertas: só o administrador do módulo.
// ============================================================

const DIAS_CONCLUIDOS = 60;

const QuadroHomologacoesView: React.FC<{
  servico: FornecedoresService;
  fornecedores: IFornecedor[];
  administra: boolean;
  usuarioNome: string;
  abrir: (fornecedorId: string) => void;
}> = ({ servico, fornecedores, administra, usuarioNome, abrir }) => {

  const [ciclos, setCiclos] = React.useState<ICicloHomologacao[] | undefined>(undefined);
  const [disponivel, setDisponivel] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [busca, setBusca] = React.useState('');

  const carregar = React.useCallback(async (): Promise<void> => {
    try {
      const r = await servico.listarCiclos(undefined, DIAS_CONCLUIDOS);
      setDisponivel(r.disponivel);
      setCiclos(r.ciclos);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  if (!disponivel) {
    return (
      <Aviso tipo="info">
        A tabela de ciclos de homologação ainda não existe no Dataverse. Rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.
      </Aviso>
    );
  }

  const nome: Record<string, IFornecedor> = {};
  fornecedores.forEach(f => { nome[f.id] = f; });
  const termo = busca.trim().toLowerCase();

  const cards: ICardQuadro[] = (ciclos || [])
    .filter(c => nome[c.fornecedorId])
    .filter(c => !termo || nome[c.fornecedorId].razaoSocial.toLowerCase().indexOf(termo) >= 0 || (c.protocolo || '').toLowerCase().indexOf(termo) >= 0)
    .sort((a, b) => (a.etapaDesde < b.etapaDesde ? -1 : 1))
    .map(c => ({
      ciclo: c,
      titulo: nome[c.fornecedorId].razaoSocial,
      subtitulo: [`Ciclo ${c.numero}`, c.motivo, c.protocolo].filter(Boolean).join(' · ')
    }));

  return (
    <div>
      {erro && <Aviso tipo="alerta" acao={<button type="button" style={botao('secundario')} onClick={() => { setErro(''); carregar().catch(() => undefined); }}>Tentar de novo</button>}>{erro}</Aviso>}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <input aria-label="Buscar no quadro" placeholder="Buscar fornecedor ou protocolo…" value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding: '8px 10px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '8px', fontFamily: 'inherit', fontSize: '13.5px', minWidth: '260px' }} />
        <span style={ajuda}>
          Ciclos em aberto e concluídos nos últimos {DIAS_CONCLUIDOS} dias. Clique no card para abrir o fornecedor.
          {administra ? ' Arraste entre as colunas abertas para mover.' : ''}
        </span>
      </div>

      {!ciclos && !erro && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando o quadro…</div>}
      {ciclos && cards.length === 0 && <Aviso tipo="info">Nenhum ciclo de homologação no período.</Aviso>}

      {ciclos && cards.length > 0 && (
        <QuadroKanban
          cards={cards}
          podeMover={administra}
          aoAbrir={c => abrir(c.fornecedorId)}
          aoSoltar={(c, destino) => {
            servico.moverCiclo(c, destino, usuarioNome)
              .then(() => carregar())
              .catch(e => setErro(String((e as Error)?.message || e)));
          }}
        />
      )}
    </div>
  );
};

export default QuadroHomologacoesView;
