import * as React from 'react';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IAlteracaoOrcamento,
  ILinhaOrcamento,
  IPlanilhaOrcamento,
  OrcamentoService,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  IPendenciaAprovacao,
  OrcamentoFluxoService
} from '../../services/orcamento/OrcamentoFluxoService';

import {
  IRegraCalculo,
  contasCalculadas
} from '../../services/orcamento/calculoOrcamento';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import TabelaOrcamento from './TabelaOrcamento';
import PainelAlteracoes from './PainelAlteracoes';
import PainelFluxoOrcamento from './PainelFluxoOrcamento';
import EtapasFluxoOrcamento from './EtapasFluxoOrcamento';

import {
  COR,
  CaixaMensagem,
  CartaoNumero,
  FONTE,
  IconeOlho,
  SeloPrazo,
  botao,
  cartao,
  explicarErro,
  formatarDataHora,
  formatarMoeda,
  somar
} from './orcamentoComum';

// ============================================================
// APROVAÇÕES — etapas do fluxo CONT-001 aguardando o usuário
//
// Lista as planilhas do ano em que a etapa atual do fluxo (ex.:
// "Avaliação do Diretor da Área", "Avaliação Controladoria",
// "Diretoria Financeira") tem o usuário como responsável. Ao abrir:
// a planilha (somente leitura), as linhas alteradas desde a última
// devolução e o quadro do fluxo com as ações (Aprovar / Reprovar…).
// ============================================================

export interface IAprovacoesViewProps {
  servico: OrcamentoService;
  fluxo: OrcamentoFluxoService;
  contexto: IContextoAcesso;
  ano: number;
  regras: IRegraCalculo[];
  // Avisa a página quantas aprovações estão pendentes.
  onQuantidade?: (quantidade: number) => void;
}

const AprovacoesView: React.FC<IAprovacoesViewProps> = (props) => {

  const { servico, fluxo, contexto, ano, onQuantidade } = props;

  const [pendencias, setPendencias] = React.useState<IPendenciaAprovacao[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [alerta, setAlerta] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [abertaId, setAbertaId] = React.useState('');
  const [linhas, setLinhas] = React.useState<ILinhaOrcamento[]>([]);
  const [alteracoes, setAlteracoes] = React.useState<IAlteracaoOrcamento[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = React.useState(false);
  const [processando, setProcessando] = React.useState(false);
  const [vinculos, setVinculos] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [usuarios, setUsuarios] = React.useState<Array<{ id: string; nome: string }>>([]);
  const [totais, setTotais] = React.useState<{ [planilhaId: string]: number }>({});
  const refFluxo = React.useRef<HTMLDivElement>(null);

  const calculadas = React.useMemo(() => contasCalculadas(props.regras), [props.regras]);

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      const planilhas = await servico.listarPlanilhas(ano);
      const lista = await fluxo.pendenciasDoUsuario(planilhas, contexto);
      setPendencias(lista);
      if (onQuantidade) {
        onQuantidade(lista.length);
      }
      const [vinculosLidos, usuariosLidos] = await Promise.all([fluxo.vinculos(), fluxo.usuarios()]);
      setVinculos(vinculosLidos);
      setUsuarios(usuariosLidos);
      if (lista.length > 0) {
        const todas = await servico.carregarLinhasDePlanilhas(lista.map(item => item.planilha.id));
        const mapa: { [id: string]: number } = {};
        todas.forEach(linha => {
          mapa[linha.planilhaId] = (mapa[linha.planilhaId] || 0) + totalLinha(linha);
        });
        setTotais(mapa);
      } else {
        setTotais({});
      }
    } catch (falha) {
      setErro(explicarErro(falha));
      setPendencias([]);
    } finally {
      setCarregando(false);
    }
  }, [servico, fluxo, contexto, ano, onQuantidade]);

  React.useEffect(() => {
    setAbertaId('');
    carregar().catch(() => undefined);
  }, [carregar]);

  const abrir = async (planilha: IPlanilhaOrcamento): Promise<void> => {
    setAbertaId(planilha.id);
    setAviso('');
    setAlerta('');
    setCarregandoDetalhe(true);
    try {
      setLinhas(await servico.carregarLinhas(planilha.id));
    } catch (falha) {
      setLinhas([]);
      setErro(explicarErro(falha));
    }
    try {
      setAlteracoes(await servico.listarAlteracoes(planilha.id));
    } catch {
      setAlteracoes([]);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const executar = async (
    pendencia: IPendenciaAprovacao,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<string[]> => {
    setProcessando(true);
    try {
      const resultado =
        await fluxo.executar(pendencia.planilha, contexto, acaoChave, comentario, valores);
      if (!resultado.ok) {
        return resultado.erros;
      }
      const acao =
        pendencia.estado.definicao.elementos
          .filter(item => item.id === pendencia.estado.instancia.elementoAtualId)
          .map(item => item.acoes.filter(a => a.chave === acaoChave)[0])[0];
      setAviso(`✓ ${pendencia.tarefa.elementoNome} — ${pendencia.planilha.areaNome || pendencia.planilha.gestorNome}: ${acao ? acao.rotulo : 'ação'} registrada.`);
      if (resultado.avisos.length > 0) {
        setAlerta(resultado.avisos.join('\n'));
      }
      setAbertaId('');
      await carregar();
      return [];
    } catch (falha) {
      return [explicarErro(falha)];
    } finally {
      setProcessando(false);
    }
  };

  const mensagens = (
    <>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="alerta" texto={alerta} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />
    </>
  );

  if (carregando) {
    return <div style={{ ...cartao, color: COR.texto2 }}>Procurando aprovações pendentes de {ano}...</div>;
  }

  const aberta = pendencias.filter(item => item.planilha.id === abertaId)[0];

  // ---------------- Detalhe ----------------
  if (aberta) {
    const comValor = linhas.filter(linha => totalLinha(linha) !== 0 || !!linha.descricao);
    const destacadas: { [chave: string]: string } = {};
    if (aberta.planilha.dataDevolucao) {
      const limite = new Date(aberta.planilha.dataDevolucao).getTime();
      alteracoes
        .filter(item => new Date(item.data).getTime() >= limite && item.origem === 'Gestor')
        .forEach(item => { destacadas[item.linhaId] = 'alterada após a devolução'; });
    }
    const qtdDestacadas = Object.keys(destacadas).length;

    return (
      <div style={{ fontFamily: FONTE }}>
        {mensagens}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button type="button" onClick={() => setAbertaId('')} style={botao('secundario')}>← Voltar</button>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul }}>
              {aberta.planilha.areaNome || 'Geral (sem área)'} — Orçamento {ano}
            </div>
            <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
              Etapa: <strong>{aberta.tarefa.elementoNome}</strong> · criada por {aberta.planilha.gestorNome || '—'} · enviada em {formatarDataHora(aberta.planilha.dataEnvio)}
            </div>
          </div>
          {aberta.tarefa.prazo && (
            <SeloPrazo prazo={aberta.tarefa.prazo} situacao={situacaoPrazo(aberta.tarefa.prazo, aberta.tarefa.criadaEm)} />
          )}
        </div>

        <EtapasFluxoOrcamento
          estado={aberta.estado}
          dadosResponsaveis={fluxo.dadosResponsaveis(aberta.planilha)}
          vinculos={vinculos}
          usuarios={usuarios}
          onVerDetalhes={() => { if (refFluxo.current) { refFluxo.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <CartaoNumero titulo="Total anual" valor={formatarMoeda(somar(linhas.map(linha => totalLinha(linha))))} detalhe={`${comValor.length} linha(s) com valor`} />
          {aberta.planilha.dataDevolucao && (
            <CartaoNumero titulo="Alteradas após a devolução" valor={String(qtdDestacadas)} detalhe={`Devolvida em ${formatarDataHora(aberta.planilha.dataDevolucao)}`} />
          )}
        </div>

        {carregandoDetalhe ? (
          <div style={{ ...cartao, color: COR.texto2 }}>Carregando a planilha...</div>
        ) : comValor.length === 0 ? (
          <div style={{ ...cartao, textAlign: 'center', color: COR.texto2 }}>A planilha não tem valores preenchidos.</div>
        ) : (
          <TabelaOrcamento linhas={comValor} ano={ano} somenteLeitura={true} calculadas={calculadas} destacadas={destacadas} />
        )}

        <div ref={refFluxo} style={{ marginTop: '16px' }}>
          <PainelFluxoOrcamento
            estado={aberta.estado}
            dadosResponsaveis={fluxo.dadosResponsaveis(aberta.planilha)}
            vinculos={vinculos}
            usuarios={usuarios}
            podeAgir={true}
            processando={processando}
            onExecutar={(acaoChave, comentario, valores) => executar(aberta, acaoChave, comentario, valores)}
            diagramaAberto={false}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <PainelAlteracoes
            alteracoes={alteracoes}
            carregando={carregandoDetalhe}
            desde={aberta.planilha.dataDevolucao || undefined}
            modoInicial="desde"
            titulo="Linhas alteradas"
            aberto={!!aberta.planilha.dataDevolucao}
          />
        </div>
      </div>
    );
  }

  // ---------------- Lista ----------------
  const cabecalho: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: '12px',
    color: COR.texto2,
    fontWeight: 700,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${COR.borda}`,
    whiteSpace: 'nowrap'
  };

  const celula: React.CSSProperties = {
    padding: '10px',
    fontSize: '13.5px',
    color: COR.azul,
    borderBottom: `1px solid ${COR.borda}`,
    verticalAlign: 'top'
  };

  return (
    <div style={{ fontFamily: FONTE }}>
      {mensagens}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: '13px', color: COR.texto2 }}>
          Planilhas de {ano} com uma etapa do fluxo de aprovação aguardando você.
        </div>
        <button type="button" onClick={() => { carregar().catch(() => undefined); }} style={botao('secundario')}>
          Atualizar
        </button>
      </div>

      <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
        {pendencias.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
            Nenhuma aprovação aguardando você em {ano}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th style={cabecalho}>Área</th>
                <th style={cabecalho}>Etapa</th>
                <th style={cabecalho}>Prazo</th>
                <th style={{ ...cabecalho, textAlign: 'right' }}>Total anual</th>
                <th style={cabecalho}>Enviada em</th>
                <th style={cabecalho} />
              </tr>
            </thead>
            <tbody>
              {pendencias.map(item => (
                <tr key={item.planilha.id}>
                  <td style={{ ...celula, fontWeight: 600 }}>
                    {item.planilha.areaNome || 'Geral (sem área)'}
                    <div style={{ fontSize: '12px', color: COR.texto2, fontWeight: 400 }}>criada por {item.planilha.gestorNome || '—'}</div>
                  </td>
                  <td style={celula}>{item.tarefa.elementoNome}</td>
                  <td style={celula}>
                    {item.tarefa.prazo
                      ? <SeloPrazo prazo={item.tarefa.prazo} situacao={situacaoPrazo(item.tarefa.prazo, item.tarefa.criadaEm)} />
                      : <span style={{ color: COR.texto2 }}>sem prazo</span>}
                  </td>
                  <td style={{ ...celula, textAlign: 'right', fontWeight: 700 }}>{formatarMoeda(totais[item.planilha.id] || 0)}</td>
                  <td style={{ ...celula, color: COR.texto2 }}>{formatarDataHora(item.planilha.dataEnvio)}</td>
                  <td style={{ ...celula, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => { abrir(item.planilha).catch(() => undefined); }}
                      style={{ ...botao('principal'), display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <IconeOlho /> Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AprovacoesView;
