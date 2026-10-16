import * as React from 'react';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IAlteracaoOrcamento,
  IAreaOrcamento,
  IEventoOrcamento,
  ILinhaOrcamento,
  IPlanilhaOrcamento,
  OrcamentoService,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  STATUS_PLANILHA,
  statusEntregue
} from '../../services/orcamento/esquemaOrcamento';

import {
  IEstadoFluxoPlanilha,
  OrcamentoFluxoService
} from '../../services/orcamento/OrcamentoFluxoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IRegraCalculo,
  contasCalculadas
} from '../../services/orcamento/calculoOrcamento';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import TabelaOrcamento from './TabelaOrcamento';
import DevolverPlanilhaModal from './DevolverPlanilhaModal';
import PainelAlteracoes from './PainelAlteracoes';
import ConsolidadoMensal from './ConsolidadoMensal';
import PainelFluxoOrcamento from './PainelFluxoOrcamento';

import {
  COR,
  CaixaMensagem,
  CartaoNumero,
  FONTE,
  IconeOlho,
  SeloPrazo,
  SeloStatus,
  agruparLinhas,
  baixarCsv,
  botao,
  campo,
  cartao,
  explicarErro,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  gerarCsvOrcamento,
  nomeArquivoSeguro,
  somar,
  somarMeses
} from './orcamentoComum';

// ============================================================
// TODAS AS PLANILHAS (Administrador)
//
// • Lista de todas as planilhas do ano (filtro por área), com
//   situação, prazo de ajuste e total.
// • 👁 Ver: abre a planilha (somente leitura), com as linhas
//   alteradas desde a última devolução, o log e o histórico.
// • Devolver para ajuste: motivo obrigatório; prazo em dias úteis.
// • 👁 Consolidado mês a mês: soma de todas as planilhas.
// ============================================================

export interface ITodasPlanilhasViewProps {
  // Fluxo de aprovação (CONT-001).
  fluxo: OrcamentoFluxoService;
  fluxoAtivo: boolean;
  onFluxoAlterado?: () => void;
  servico: OrcamentoService;
  contexto: IContextoAcesso;
  ano: number;
  areas: IAreaOrcamento[];
  regras: IRegraCalculo[];
}

type Visao = 'lista' | 'planilha' | 'consolidado';

const TodasPlanilhasView: React.FC<ITodasPlanilhasViewProps> = (props) => {

  const { servico, contexto, ano, fluxo, fluxoAtivo, onFluxoAlterado } = props;

  const [estadoFluxo, setEstadoFluxo] = React.useState<IEstadoFluxoPlanilha | undefined>(undefined);
  const [podeAgirFluxo, setPodeAgirFluxo] = React.useState(false);
  const [processandoFluxo, setProcessandoFluxo] = React.useState(false);
  const [vinculosFluxo, setVinculosFluxo] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [usuariosFluxo, setUsuariosFluxo] = React.useState<Array<{ id: string; nome: string }>>([]);

  const [planilhas, setPlanilhas] = React.useState<IPlanilhaOrcamento[]>([]);
  const [linhas, setLinhas] = React.useState<ILinhaOrcamento[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [alerta, setAlerta] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [filtroArea, setFiltroArea] = React.useState('*');
  const [visao, setVisao] = React.useState<Visao>('lista');
  const [abertaId, setAbertaId] = React.useState('');
  const [eventos, setEventos] = React.useState<IEventoOrcamento[]>([]);
  const [carregandoEventos, setCarregandoEventos] = React.useState(false);
  const [alteracoes, setAlteracoes] = React.useState<IAlteracaoOrcamento[]>([]);
  const [carregandoAlteracoes, setCarregandoAlteracoes] = React.useState(false);
  const [devolvendo, setDevolvendo] = React.useState<IPlanilhaOrcamento | undefined>(undefined);
  const [enviandoDevolucao, setEnviandoDevolucao] = React.useState(false);
  const [erroDevolucao, setErroDevolucao] = React.useState('');

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await servico.listarPlanilhas(ano);
      setPlanilhas(lista);
      setLinhas(lista.length > 0 ? await servico.carregarLinhasDePlanilhas(lista.map(item => item.id)) : []);
    } catch (falha) {
      setErro(explicarErro(falha));
      setPlanilhas([]);
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  }, [servico, ano]);

  React.useEffect(() => {
    setVisao('lista');
    setAbertaId('');
    carregar().catch(() => undefined);
  }, [carregar]);

  const carregarDetalhes = async (planilhaId: string): Promise<void> => {
    setEstadoFluxo(undefined);
    if (fluxoAtivo) {
      try {
        const planilha =
          (await servico.listarPlanilhas(ano)).filter(item => item.id === planilhaId)[0];
        const estado = planilha ? await fluxo.carregar(planilha) : undefined;
        if (planilha && estado) {
          const [podeAgir, vinculos, usuarios] = await Promise.all([
            fluxo.podeAgir(estado, planilha, contexto),
            fluxo.vinculos(),
            fluxo.usuarios()
          ]);
          setPodeAgirFluxo(podeAgir);
          setVinculosFluxo(vinculos);
          setUsuariosFluxo(usuarios);
        }
        setEstadoFluxo(estado);
      } catch (falha) {
        setAlerta(`Fluxo de aprovação indisponível: ${explicarErro(falha)}`);
      }
    }
    setCarregandoEventos(true);
    setCarregandoAlteracoes(true);
    try {
      setEventos(await servico.listarEventos(planilhaId));
    } catch (falha) {
      setEventos([]);
      setAlerta(`Histórico indisponível: ${explicarErro(falha)}`);
    } finally {
      setCarregandoEventos(false);
    }
    try {
      setAlteracoes(await servico.listarAlteracoes(planilhaId));
    } catch (falha) {
      setAlteracoes([]);
      setAlerta(`Log de alterações indisponível: ${explicarErro(falha)}`);
    } finally {
      setCarregandoAlteracoes(false);
    }
  };

  const abrirPlanilha = (id: string): void => {
    setAbertaId(id);
    setVisao('planilha');
    setAviso('');
    setAlerta('');
    setEventos([]);
    setAlteracoes([]);
    carregarDetalhes(id).catch(() => undefined);
  };

  const voltarLista = (): void => {
    setVisao('lista');
    setAbertaId('');
  };

  const confirmarDevolucao = async (motivo: string): Promise<void> => {
    if (!devolvendo) {
      return;
    }
    setEnviandoDevolucao(true);
    setErroDevolucao('');
    try {
      // Planilha no fluxo de aprovação: volta para a etapa de
      // preenchimento (registrado no fluxo e no histórico). Sem fluxo:
      // devolução simples, como antes.
      const estado = fluxoAtivo ? await fluxo.carregar(devolvendo) : undefined;
      let avisoHistorico = '';
      if (estado) {
        const resultado = await fluxo.devolverComoAdministrador(devolvendo, motivo, contexto);
        if (!resultado.ok) {
          throw new Error(resultado.erros.join(' '));
        }
        avisoHistorico = resultado.avisos.join('\n');
        if (onFluxoAlterado) {
          onFluxoAlterado();
        }
      } else {
        avisoHistorico = await servico.devolverPlanilha(devolvendo, motivo, contexto);
      }
      const nome = devolvendo.areaNome || `${devolvendo.gestorNome} (Geral)`;
      setDevolvendo(undefined);
      await carregar();
      if (abertaId) {
        await carregarDetalhes(abertaId);
      }
      setAviso(`✓ Planilha de ${nome} devolvida para ajuste.`);
      if (avisoHistorico) {
        setAlerta(avisoHistorico);
      }
    } catch (falha) {
      setErroDevolucao(explicarErro(falha));
    } finally {
      setEnviandoDevolucao(false);
    }
  };

  // Ação do fluxo executada pelo Administrador (quando ele também é
  // responsável pela etapa atual).
  const executarFluxo = async (
    planilha: IPlanilhaOrcamento,
    acaoChave: string,
    comentario: string,
    valores: Record<string, string>
  ): Promise<string[]> => {
    setProcessandoFluxo(true);
    try {
      const resultado = await fluxo.executar(planilha, contexto, acaoChave, comentario, valores);
      if (!resultado.ok) {
        return resultado.erros;
      }
      await carregar();
      await carregarDetalhes(planilha.id);
      setAviso('✓ Ação do fluxo registrada.');
      if (resultado.avisos.length > 0) {
        setAlerta(resultado.avisos.join('\n'));
      }
      if (onFluxoAlterado) {
        onFluxoAlterado();
      }
      return [];
    } catch (falha) {
      return [explicarErro(falha)];
    } finally {
      setProcessandoFluxo(false);
    }
  };

  const cancelarDevolucao = React.useCallback((): void => {
    setDevolvendo(undefined);
  }, []);

  const calculadas = React.useMemo(() => contasCalculadas(props.regras), [props.regras]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const modalDevolucao = devolvendo && (
    <DevolverPlanilhaModal
      gestorNome={devolvendo.areaId ? `os gestores da área ${devolvendo.areaNome}` : devolvendo.gestorNome}
      ano={ano}
      enviando={enviandoDevolucao}
      erro={erroDevolucao}
      onConfirmar={motivo => { confirmarDevolucao(motivo).catch(() => undefined); }}
      onCancelar={cancelarDevolucao}
    />
  );

  const mensagens = (
    <>
      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="alerta" texto={alerta} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />
    </>
  );

  if (carregando) {
    return <div style={{ ...cartao, color: COR.texto2 }}>Carregando as planilhas de {ano}...</div>;
  }

  if (visao === 'consolidado') {
    return (
      <ConsolidadoMensal
        ano={ano}
        planilhas={planilhas}
        linhas={linhas}
        areas={props.areas}
        onVoltar={voltarLista}
      />
    );
  }

  const aberta = planilhas.filter(item => item.id === abertaId)[0];

  if (visao === 'planilha' && aberta) {

    // Só as linhas preenchidas (valor ou descrição).
    const linhasDaAberta =
      linhas.filter(linha =>
        linha.planilhaId === aberta.id &&
        (totalLinha(linha) !== 0 || !!linha.descricao));

    // Linhas alteradas pelo gestor depois da última devolução.
    const destacadas: { [chave: string]: string } = {};
    if (aberta.dataDevolucao) {
      const limite = new Date(aberta.dataDevolucao).getTime();
      alteracoes
        .filter(item => new Date(item.data).getTime() >= limite && item.origem === 'Gestor')
        .forEach(item => {
          destacadas[item.linhaId] = 'alterada após a devolução';
        });
    }
    const qtdDestacadas = Object.keys(destacadas).length;
    const prazo = aberta.status === STATUS_PLANILHA.devolvida ? situacaoPrazo(aberta.prazoAjuste, aberta.dataDevolucao) : undefined;

    return (
      <>
        {mensagens}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button type="button" onClick={voltarLista} style={botao('secundario')}>← Voltar</button>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul }}>{aberta.areaNome || 'Geral (sem área)'}</div>
            <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
              Criada por {aberta.gestorNome || '—'} · atualizada em {formatarDataHora(aberta.alteradoEm)}
            </div>
          </div>
          <SeloStatus status={aberta.status} />
          {prazo && <SeloPrazo prazo={aberta.prazoAjuste} situacao={prazo} />}
          {statusEntregue(aberta.status) && (
            <button
              type="button"
              onClick={() => { setErroDevolucao(''); setDevolvendo(aberta); }}
              style={botao('perigo')}
              title={estadoFluxo ? 'Devolve para a etapa de preenchimento do fluxo, fora das ações do processo (fica registrado).' : undefined}
            >
              Devolver para ajuste
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              baixarCsv(
                `${nomeArquivoSeguro(`Orcamento_${ano}_${aberta.areaNome}_${aberta.gestorNome}`)}.csv`,
                gerarCsvOrcamento(ano, linhasDaAberta, false)
              )
            }
            disabled={linhasDaAberta.length === 0}
            style={botao('secundario', linhasDaAberta.length === 0)}
          >
            Exportar CSV
          </button>
        </div>

        {aberta.status === STATUS_PLANILHA.devolvida && (
          <div style={{ ...cartao, background: '#FFF5F5', borderColor: '#F3C1C1', fontSize: '13px', color: COR.azul }}>
            <strong style={{ color: COR.perigo }}>Aguardando ajuste do gestor.</strong>{' '}
            Devolvida por {aberta.devolvidoPor || '—'} em {formatarDataHora(aberta.dataDevolucao)}
            {aberta.prazoAjuste && <> · prazo até <strong>{formatarData(aberta.prazoAjuste)}</strong></>}.
            <div style={{ marginTop: '6px', whiteSpace: 'pre-line' }}>Motivo: {aberta.motivoDevolucao || '—'}</div>
          </div>
        )}

        {(aberta.status === STATUS_PLANILHA.enviada || aberta.status === STATUS_PLANILHA.emAprovacao) && aberta.dataDevolucao && (
          <CaixaMensagem
            tipo="info"
            texto={`Planilha reenviada após devolução em ${formatarDataHora(aberta.dataDevolucao)}. ${qtdDestacadas} linha(s) alterada(s) pelo gestor desde então — destacadas em azul na tabela e listadas no log abaixo.`}
          />
        )}

        {linhasDaAberta.length === 0 ? (
          <div style={{ ...cartao, textAlign: 'center', color: COR.texto2 }}>Esta planilha ainda não tem valores preenchidos.</div>
        ) : (
          <TabelaOrcamento linhas={linhasDaAberta} ano={ano} somenteLeitura={true} calculadas={calculadas} destacadas={destacadas} />
        )}

        {estadoFluxo && (
          <div style={{ marginTop: '16px' }}>
            <PainelFluxoOrcamento
              estado={estadoFluxo}
              dadosResponsaveis={fluxo.dadosResponsaveis(aberta)}
              vinculos={vinculosFluxo}
              usuarios={usuariosFluxo}
              podeAgir={podeAgirFluxo}
              processando={processandoFluxo}
              onExecutar={(acaoChave, comentario, valores) => executarFluxo(aberta, acaoChave, comentario, valores)}
              diagramaAberto={true}
            />
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <PainelAlteracoes
            alteracoes={alteracoes}
            carregando={carregandoAlteracoes}
            desde={aberta.dataDevolucao || undefined}
            modoInicial="desde"
            titulo="Linhas alteradas"
            aberto={true}
          />
        </div>

        <div style={cartao}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: COR.azul, marginBottom: '10px' }}>Histórico</div>
          {carregandoEventos ? (
            <div style={{ fontSize: '13px', color: COR.texto2 }}>Carregando o histórico...</div>
          ) : eventos.length === 0 ? (
            <div style={{ fontSize: '13px', color: COR.texto2 }}>Nenhum envio ou devolução registrado ainda.</div>
          ) : (
            eventos.map(evento => (
              <div key={evento.id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: `1px solid ${COR.borda}` }}>
                <div style={{ minWidth: '128px', fontSize: '12.5px', color: COR.texto2 }}>{formatarDataHora(evento.data)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: evento.tipo === STATUS_PLANILHA.devolvida ? COR.perigo : '#107C10' }}>
                    {evento.tipo}
                    <span style={{ fontWeight: 500, color: COR.texto2 }}> · {evento.usuarioNome || '—'}</span>
                  </div>
                  {evento.motivo && (
                    <div style={{ fontSize: '13px', color: COR.azul, marginTop: '3px', whiteSpace: 'pre-line' }}>{evento.motivo}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {modalDevolucao}
      </>
    );
  }

  // ---------------- Lista ----------------

  const areasComPlanilha: IAreaOrcamento[] = [];
  planilhas.forEach(item => {
    if (!areasComPlanilha.some(area => area.id === item.areaId)) {
      areasComPlanilha.push({ id: item.areaId, nome: item.areaNome || 'Geral (sem área)' });
    }
  });
  areasComPlanilha.sort((a, b) => a.nome.localeCompare(b.nome));

  const visiveis = planilhas.filter(item => filtroArea === '*' || item.areaId === filtroArea);

  // Áreas com mais de uma planilha no ano (dois gestores iniciaram ao
  // mesmo tempo antes da equipe existir). O gestor vê a mais antiga.
  const duplicadas: string[] = [];
  planilhas.forEach((item, indice) => {
    if (
      item.areaId &&
      duplicadas.indexOf(item.areaId) < 0 &&
      planilhas.some((outra, outroIndice) => outroIndice !== indice && outra.areaId === item.areaId)
    ) {
      duplicadas.push(item.areaId);
    }
  });
  const idsVisiveis = visiveis.map(item => item.id);
  const linhasVisiveis = linhas.filter(linha => idsVisiveis.indexOf(linha.planilhaId) >= 0);
  const totalConsolidado = somar(somarMeses(linhasVisiveis));
  const enviadas = visiveis.filter(item => statusEntregue(item.status)).length;
  const emAprovacao = visiveis.filter(item => item.status === STATUS_PLANILHA.emAprovacao).length;
  const aprovadas = visiveis.filter(item => item.status === STATUS_PLANILHA.aprovada).length;
  const devolvidas = visiveis.filter(item => item.status === STATUS_PLANILHA.devolvida);
  const atrasadas = devolvidas.filter(item => {
    const prazo = situacaoPrazo(item.prazoAjuste, item.dataDevolucao);
    return !!prazo && prazo.atrasado;
  }).length;
  const grupos = agruparLinhas(linhasVisiveis);

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
    <>
      {mensagens}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <CartaoNumero titulo="Planilhas" valor={String(visiveis.length)} detalhe={`${enviadas} enviada(s)`} />
        {fluxoAtivo && (
          <CartaoNumero titulo="Em aprovação" valor={String(emAprovacao)} detalhe={`${aprovadas} aprovada(s)`} />
        )}
        <CartaoNumero titulo="Em preenchimento" valor={String(visiveis.length - enviadas - devolvidas.length)} />
        <CartaoNumero titulo="Devolvidas para ajuste" valor={String(devolvidas.length)} detalhe={atrasadas > 0 ? `${atrasadas} com prazo vencido` : 'Nenhuma atrasada'} />
        <CartaoNumero titulo="Total consolidado" valor={formatarMoeda(totalConsolidado)} detalhe={`Ano ${ano}`} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filtroArea}
          onChange={evento => setFiltroArea(evento.target.value)}
          aria-label="Filtrar por área"
          style={{ ...campo, width: 'auto', minWidth: '220px' }}
        >
          <option value="*">Todas as áreas</option>
          {areasComPlanilha.map(area => (
            <option key={area.id || 'geral'} value={area.id}>{area.nome}</option>
          ))}
        </select>
        <button type="button" onClick={() => { carregar().catch(() => undefined); }} style={botao('secundario')}>
          Atualizar
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setVisao('consolidado')}
          disabled={planilhas.length === 0}
          style={{ ...botao('principal', planilhas.length === 0), display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          title="Ver o consolidado geral mês a mês"
        >
          <IconeOlho /> Consolidado mês a mês
        </button>
      </div>

      <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
        {visiveis.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
            Nenhuma planilha de {ano} {filtroArea === '*' ? 'iniciada ainda' : 'para esta área'}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th style={cabecalho}>Área</th>
                <th style={cabecalho}>Criada por</th>
                <th style={cabecalho}>Situação</th>
                <th style={{ ...cabecalho, textAlign: 'right' }}>Linhas com valor</th>
                <th style={{ ...cabecalho, textAlign: 'right' }}>Total anual</th>
                <th style={cabecalho}>Atualizada em</th>
                <th style={cabecalho} />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(item => {
                const daPlanilha = linhas.filter(linha => linha.planilhaId === item.id);
                const prazo =
                  item.status === STATUS_PLANILHA.devolvida
                    ? situacaoPrazo(item.prazoAjuste, item.dataDevolucao)
                    : item.status === STATUS_PLANILHA.emAprovacao && item.prazoEtapa
                      ? situacaoPrazo(item.prazoEtapa)
                      : undefined;
                return (
                  <tr key={item.id}>
                    <td style={{ ...celula, fontWeight: 600 }}>
                      {item.areaNome || 'Geral (sem área)'}
                      {item.areaId && duplicadas.indexOf(item.areaId) >= 0 && (
                        <div style={{ fontSize: '11.5px', color: COR.perigo, fontWeight: 700 }} title="Existe mais de uma planilha desta área no ano">
                          ⚠ planilha duplicada
                        </div>
                      )}
                      {item.areaId && !item.equipeId && (
                        <div style={{ fontSize: '11.5px', color: '#B45309', fontWeight: 600 }} title="Rode o script sincronizar-equipes-orcamento.ps1">
                          sem equipe (só quem criou vê)
                        </div>
                      )}
                    </td>
                    <td style={{ ...celula, color: COR.texto2 }}>{item.gestorNome || '—'}</td>
                    <td style={celula}>
                      <SeloStatus status={item.status} />
                      {item.status === STATUS_PLANILHA.emAprovacao && item.etapaAtual && (
                        <div style={{ fontSize: '12px', color: COR.azul, marginTop: '4px', fontWeight: 600 }}>{item.etapaAtual}</div>
                      )}
                      {prazo && (
                        <div style={{ marginTop: '4px' }}>
                          <SeloPrazo prazo={item.status === STATUS_PLANILHA.devolvida ? item.prazoAjuste : item.prazoEtapa} situacao={prazo} />
                        </div>
                      )}
                      {item.status === STATUS_PLANILHA.devolvida && item.motivoDevolucao && (
                        <div
                          title={item.motivoDevolucao}
                          style={{ fontSize: '12px', color: COR.texto2, marginTop: '4px', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {item.motivoDevolucao}
                        </div>
                      )}
                    </td>
                    <td style={{ ...celula, textAlign: 'right' }}>{daPlanilha.filter(linha => totalLinha(linha) !== 0).length}</td>
                    <td style={{ ...celula, textAlign: 'right', fontWeight: 700 }}>
                      {formatarMoeda(somar(daPlanilha.map(linha => totalLinha(linha))))}
                    </td>
                    <td style={{ ...celula, color: COR.texto2 }}>{formatarData(item.alteradoEm)}</td>
                    <td style={{ ...celula, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => abrirPlanilha(item.id)}
                        title="Ver a planilha, as linhas alteradas e o histórico"
                        style={{ ...botao('secundario'), marginRight: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <IconeOlho /> Ver
                      </button>
                      {statusEntregue(item.status) && (
                        <button type="button" onClick={() => { setErroDevolucao(''); setDevolvendo(item); }} style={botao('perigo')}>
                          Devolver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {grupos.length > 0 && (
        <div style={{ ...cartao, padding: 0, overflowX: 'auto' }}>
          <div style={{ padding: '14px 16px', fontSize: '15px', fontWeight: 700, color: COR.azul, borderBottom: `1px solid ${COR.borda}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1 }}>Consolidado por grupo (anual)</span>
            <button
              type="button"
              onClick={() => setVisao('consolidado')}
              title="Ver mês a mês"
              aria-label="Ver o consolidado mês a mês"
              style={{ border: `1px solid ${COR.borda}`, background: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', padding: '5px 9px', color: COR.azulAcao }}
            >
              <IconeOlho />
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th style={cabecalho}>Grupo</th>
                <th style={{ ...cabecalho, textAlign: 'right' }}>Total anual</th>
                <th style={{ ...cabecalho, textAlign: 'right' }}>% do total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(item => (
                <tr key={item.grupo}>
                  <td style={celula}>{item.grupo}</td>
                  <td style={{ ...celula, textAlign: 'right', fontWeight: 600 }}>{formatarMoeda(item.total)}</td>
                  <td style={{ ...celula, textAlign: 'right', color: COR.texto2 }}>
                    {totalConsolidado ? `${((item.total / totalConsolidado) * 100).toFixed(1).replace('.', ',')}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalDevolucao}
    </>
  );
};

export default TodasPlanilhasView;
