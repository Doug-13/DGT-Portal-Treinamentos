import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  HomologacaoFluxoService,
  IDisponibilidadeHomologacao,
  IEstadoFluxoCiclo
} from '../../services/fornecedores/HomologacaoFluxoService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IUsuarioAreaAdmin
} from '../../services/AreaAdminService';

import {
  IResponsavelResolvido
} from '../../models/Fluxo';

import {
  ETAPAS_HOMOLOGACAO,
  ICicloHomologacao,
  IDadosHomologacao,
  IdVerificacao,
  IFornecedor,
  IVerificacao,
  MOTIVOS_CICLO,
  ResultadoHomologacao,
  VERIFICACOES_HOMOLOGACAO
} from '../../services/fornecedores/modeloFornecedores';

import {
  ISituacaoDocumental
} from '../../services/fornecedores/situacaoDocumental';

import {
  cicloAberto,
  documentosManuaisPendentes,
  resultadoConclusivo,
  SituacaoVerificacao,
  sugerirVerificacoes,
  verificacoesOk
} from '../../services/fornecedores/homologacao';

import PainelFluxoOrcamento from '../Orcamento/PainelFluxoOrcamento';

import {
  Aviso,
  COR,
  CampoMotivo,
  Modal,
  Selo,
  TomSelo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  formatarDataHora,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO (item 9 da Ficha SUP-CPL-01)
//
// A etapa do ciclo segue o motor de fluxos (processo SUP-HOM, em
// Processos → Fluxos): Ficha recebida → Documentos pendentes → Análise
// Suprimentos → Análise Jurídico → Homologado / Reprovado. Quem decide
// o resultado é o Jurídico.
//
// O kanban é SOMENTE VISUALIZAÇÃO, para todos (inclusive o
// administrador): ninguém arrasta nem move card. A etapa só muda pelos
// botões do fluxo, com comentário e histórico.
//
// O checklist do item 9 continua no card: edita quem responde a etapa
// atual (ou o administrador do módulo, para correção de dados).
// ============================================================

const TOM: Record<SituacaoVerificacao, TomSelo> = {
  ok: 'ciano',
  atencao: 'indigo',
  pendente: 'azul',
  manual: 'cinza'
};

const ROTULO: Record<SituacaoVerificacao, string> = {
  ok: '✓ sistema: ok',
  atencao: '! atenção',
  pendente: 'pendente',
  manual: 'manual'
};

const hojeIso = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1);
  const dia = String(d.getDate());
  return `${d.getFullYear()}-${m.length < 2 ? '0' + m : m}-${dia.length < 2 ? '0' + dia : dia}`;
};

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const diasDesde = (iso: string): number => {
  const t = Date.parse(iso || '');
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const tomResultado = (r: ResultadoHomologacao): TomSelo =>
  r === 'Aprovado' ? 'ciano' : r === 'Aprovado com ressalvas' ? 'azul' : r === 'Reprovado' ? 'indigo' : 'cinza';

// Quem responde a etapa (descrições gravadas pelo motor no ciclo).
export const quemResponde = (ciclo: ICicloHomologacao): string => {
  try {
    const lista = ciclo.responsaveisEtapa ? (JSON.parse(ciclo.responsaveisEtapa) as IResponsavelResolvido[]) : [];
    return lista.map(r => r.descricao).filter((d, i, todos) => !!d && todos.indexOf(d) === i).join(' · ');
  } catch {
    return '';
  }
};

const prazoTexto = (prazo: string): { texto: string; atrasado: boolean } | undefined => {
  if (!prazo) {
    return undefined;
  }
  const atrasado = Date.parse(prazo) < Date.now();
  return { texto: `${atrasado ? '! venceu' : 'prazo'} ${dataBr(prazo.substring(0, 10))}`, atrasado };
};

const dadosDoCiclo = (c: ICicloHomologacao, f: IFornecedor): IDadosHomologacao => ({
  classificacaoRisco: c.classificacaoRisco,
  resultadoHomologacao: c.resultadoHomologacao || 'Pendente',
  ressalvas: c.ressalvas,
  validadeCadastro: c.validadeCadastro,
  verificacoes: { ...c.verificacoes },
  responsavelSuprimentos: c.responsavelSuprimentos,
  responsavelCompliance: c.responsavelCompliance,
  // Aberto: conferência viva do cadastro. Concluído: retrato da conclusão.
  bancarioConferido: c.concluidoEm ? c.bancarioConferido : f.bancarioConferido
});

// ------------------------------------------------------------
// Quadro (colunas + cards), SOMENTE LEITURA — usado aqui e na aba geral
// ------------------------------------------------------------

export interface ICardQuadro {
  ciclo: ICicloHomologacao;
  titulo: string;       // "Ciclo 2" ou a razão social (quadro geral)
  subtitulo: string;
}

export const QuadroKanban: React.FC<{
  cards: ICardQuadro[];
  selecionado?: string;
  aoAbrir: (ciclo: ICicloHomologacao) => void;
}> = ({ cards, selecionado, aoAbrir }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ETAPAS_HOMOLOGACAO.length}, minmax(190px, 1fr))`, gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
    {ETAPAS_HOMOLOGACAO.map(etapa => {
      const daColuna = cards.filter(c => c.ciclo.etapa === etapa.id);
      return (
        <section
          key={etapa.id}
          aria-label={`Coluna ${etapa.rotulo}`}
          style={{ background: COR.fundo, border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', padding: '8px', minHeight: '120px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: COR.texto2, margin: '2px 4px 8px' }}>
            <span>{etapa.rotulo}</span>
            <span>{daColuna.length}</span>
          </div>
          {daColuna.map(card => {
            const c = card.ciclo;
            const aberto = !c.concluidoEm;
            const ativo = selecionado === c.id;
            const prazo = aberto ? prazoTexto(c.prazoEtapa) : undefined;
            const quem = aberto ? quemResponde(c) : '';
            return (
              <div
                key={c.id}
                style={{
                  background: COR.branco,
                  border: `1px solid ${ativo ? COR.ciano : COR.cinzaClaro}`,
                  borderLeft: `4px solid ${aberto ? COR.ciano : COR.cinzaClaro}`,
                  borderRadius: '8px',
                  padding: '8px 10px',
                  marginBottom: '8px',
                  color: COR.azul,
                  opacity: aberto ? 1 : 0.8,
                  boxShadow: ativo ? '0 0 0 2px rgba(0, 174, 199, .25)' : 'none'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13.5px', lineHeight: 1.3 }}>{card.titulo}</div>
                <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>{card.subtitulo}</div>
                {quem && <div style={{ fontSize: '12px', marginTop: '4px' }}>Responde: {quem}</div>}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {aberto
                    ? <Selo tom="cinza">{`há ${diasDesde(c.etapaDesde)} dia(s)`}</Selo>
                    : <Selo tom={tomResultado(c.resultadoHomologacao)}>{c.resultadoHomologacao}</Selo>}
                  {prazo && <Selo tom={prazo.atrasado ? 'indigo' : 'azul'}>{prazo.texto}</Selo>}
                  <Selo tom="cinza">{`${verificacoesOk(c)}/9`}</Selo>
                  {c.classificacaoRisco && <Selo tom={c.classificacaoRisco === 'Alto' ? 'indigo' : 'azul'}>{`risco ${c.classificacaoRisco.toLowerCase()}`}</Selo>}
                </div>
                <button
                  type="button"
                  onClick={() => aoAbrir(c)}
                  aria-pressed={ativo}
                  style={{ marginTop: '6px', padding: 0, border: 0, background: 'none', color: COR.azul, fontWeight: 700, fontSize: '12.5px', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Abrir
                </button>
              </div>
            );
          })}
        </section>
      );
    })}
  </div>
);

// ------------------------------------------------------------
// Abrir ciclo (só o motivo: começa sempre na primeira etapa do fluxo)
// ------------------------------------------------------------

const AbrirCicloModal: React.FC<{
  motivoSugerido: string;
  fechar: () => void;
  confirmar: (motivo: string) => Promise<void>;
}> = ({ motivoSugerido, fechar, confirmar }) => {
  const [motivo, setMotivo] = React.useState(motivoSugerido);
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const ok = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await confirmar(motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Abrir ciclo de homologação"
      subtitulo="O ciclo começa na primeira etapa do fluxo de homologação. Os ciclos anteriores ficam como histórico."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={520}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando)} disabled={gravando} onClick={() => { ok().catch(() => undefined); }}>
            {gravando ? 'Abrindo…' : 'Abrir ciclo'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <label style={rotulo} htmlFor="ciclo-motivo">Motivo</label>
      <select id="ciclo-motivo" style={campo} value={motivo} onChange={e => setMotivo(e.target.value)}>
        {MOTIVOS_CICLO.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </Modal>
  );
};

// ------------------------------------------------------------
// Card aberto: fluxo (etapa, botões, histórico) + checklist do item 9
// ------------------------------------------------------------

export interface IContextoFluxoHomologacao {
  fluxo: HomologacaoFluxoService;
  contexto: IContextoAcesso;
}

const CardCiclo: React.FC<{
  servico: FornecedoresService;
  motor?: IContextoFluxoHomologacao;
  fornecedor: IFornecedor;
  ciclo: ICicloHomologacao;
  situacao: ISituacaoDocumental;
  aConferir: number;
  administra: boolean;
  usuarioNome: string;
  aoAlterar: (aviso?: string) => Promise<void>;
  irParaDocumentos?: () => void;
}> = ({ servico, motor, fornecedor, ciclo, situacao, aConferir, administra, usuarioNome, aoAlterar, irParaDocumentos }) => {

  const [d, setD] = React.useState<IDadosHomologacao>(() => dadosDoCiclo(ciclo, fornecedor));
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [avisos, setAvisos] = React.useState<string[]>([]);

  const [disponibilidade, setDisponibilidade] = React.useState<IDisponibilidadeHomologacao | undefined>(undefined);
  const [estado, setEstado] = React.useState<IEstadoFluxoCiclo | undefined>(undefined);
  const [podeAgir, setPodeAgir] = React.useState(false);
  const [vinculos, setVinculos] = React.useState<IUsuarioAreaAdmin[]>([]);
  const [usuarios, setUsuarios] = React.useState<Array<{ id: string; nome: string }>>([]);
  const [carregandoFluxo, setCarregandoFluxo] = React.useState(true);

  const aberto = !ciclo.concluidoEm;
  const pendentesManuais = documentosManuaisPendentes(situacao);

  React.useEffect(() => {
    setD(dadosDoCiclo(ciclo, fornecedor));
    setMotivo('');
    setErro('');
  }, [ciclo, fornecedor]);

  // Carrega o fluxo do ciclo. Ciclo aberto sem instância (aberto pela
  // ficha ou antes desta versão): inicia aqui, na primeira abertura.
  const carregarFluxo = React.useCallback(async (): Promise<void> => {
    if (!motor) {
      setCarregandoFluxo(false);
      return;
    }
    setCarregandoFluxo(true);
    try {
      const disp = await motor.fluxo.verificar();
      setDisponibilidade(disp);
      setVinculos(await motor.fluxo.vinculos());
      setUsuarios(await motor.fluxo.usuarios());
      if (!disp.ativo) {
        setEstado(undefined);
        return;
      }
      let atual = await motor.fluxo.carregar(ciclo);
      if (!atual && aberto) {
        const inicio = await motor.fluxo.iniciar(fornecedor, ciclo, motor.contexto, documentosManuaisPendentes(situacao));
        if (!inicio.ok) {
          setErro(inicio.erros.join(' '));
        }
        setAvisos(inicio.avisos);
        atual = await motor.fluxo.carregar(ciclo);
      }
      setEstado(atual);
      setPodeAgir(atual ? await motor.fluxo.podeAgir(atual, motor.contexto) : false);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregandoFluxo(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, ciclo.id, ciclo.fluxoIniciado, aberto]);

  React.useEffect(() => {
    carregarFluxo().catch(() => undefined);
  }, [carregarFluxo]);

  // Checklist: quem responde a etapa atual ou o administrador do módulo.
  const podeEditarChecklist = aberto && (podeAgir || administra);
  const somenteLeitura = !podeEditarChecklist;
  const sugestoes = sugerirVerificacoes(fornecedor, situacao);
  const mudar = (parcial: Partial<IDadosHomologacao>): void => setD(a => ({ ...a, ...parcial }));

  const mudarVerificacao = (id: IdVerificacao, ok: boolean): void =>
    setD(a => {
      const atual: IVerificacao = a.verificacoes[id] || { ok: false, data: '', responsavel: '' };
      return {
        ...a,
        verificacoes: {
          ...a.verificacoes,
          [id]: ok ? { ok: true, data: atual.data || hojeIso(), responsavel: atual.responsavel || usuarioNome } : { ok: false, data: '', responsavel: '' }
        }
      };
    });

  const executarAcao = async (acaoChave: string, comentario: string, valores: Record<string, string>): Promise<string[]> => {
    if (!motor) {
      return ['O fluxo de homologação não está disponível.'];
    }
    setGravando('fluxo');
    try {
      const r = await motor.fluxo.executar(fornecedor, ciclo, motor.contexto, acaoChave, comentario, valores, pendentesManuais);
      if (!r.ok) {
        return r.erros;
      }
      setAvisos(r.avisos);
      await aoAlterar(r.status ? `Ciclo ${ciclo.numero} concluído. Status do cadastro: ${r.status}.` : 'Etapa concluída.');
      await carregarFluxo();
      return [];
    } catch (e) {
      return [String((e as Error)?.message || e)];
    } finally {
      setGravando('');
    }
  };

  const gravarConclusao = async (): Promise<void> => {
    if (!motor || !estado) {
      return;
    }
    setGravando('conclusao');
    setErro('');
    try {
      const r = await motor.fluxo.gravarConclusao(fornecedor, ciclo, estado, motor.contexto);
      setAvisos(r.avisos);
      if (r.status) {
        await aoAlterar(`Ciclo ${ciclo.numero} concluído. Status do cadastro: ${r.status}.`);
      }
    } finally {
      setGravando('');
    }
  };

  const salvarChecklist = async (): Promise<void> => {
    setGravando('salvar');
    setErro('');
    try {
      await servico.salvarCiclo(ciclo, fornecedor, d, motivo, usuarioNome);
      await aoAlterar('Checklist salvo.');
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setGravando('');
    }
  };

  const fluxoConcluidoSemGravar = !!estado && estado.instancia.status === 'concluido' && aberto;

  return (
    <div style={{ ...painel, marginTop: '14px', borderTop: `4px solid ${aberto ? COR.ciano : COR.cinzaClaro}` }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Ciclo {ciclo.numero} — {ciclo.motivo || 'homologação'}</div>
          <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
            Aberto em {formatarDataHora(ciclo.criadoEm)}{ciclo.abertoPor ? ` por ${ciclo.abertoPor}` : ''}
            {aberto ? ` · em "${ciclo.etapa}" há ${diasDesde(ciclo.etapaDesde)} dia(s)` : ` · concluído em ${formatarDataHora(ciclo.concluidoEm)}`}
          </div>
        </div>
        {aberto ? <Selo tom="ciano">{ciclo.etapa}</Selo> : <Selo tom={tomResultado(ciclo.resultadoHomologacao)}>{ciclo.resultadoHomologacao}</Selo>}
      </div>

      {!aberto && <Aviso tipo="info">Ciclo concluído: somente leitura. Para renovar ou recontratar, abra um ciclo novo.</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {avisos.map(a => <Aviso key={a} tipo="alerta">{a}</Aviso>)}

      {/* Documentos do fornecedor (resumo) */}
      {aberto && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: COR.fundo, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px' }}>
          <span style={{ fontWeight: 700 }}>Documentos:</span>
          <span>{situacao.pendencias.length === 0 ? '✓ sem pendências' : `${situacao.faltando} faltando · ${situacao.vencidos} vencido(s) · ${situacao.aVencer} a vencer`}</span>
          {aConferir > 0 && <Selo tom="ciano">{`${aConferir} recebido(s) por e-mail a conferir`}</Selo>}
          {irParaDocumentos && <button type="button" style={botao('secundario')} onClick={irParaDocumentos}>Abrir documentos</button>}
        </div>
      )}

      {/* Fluxo (motor) */}
      {aberto && motor && carregandoFluxo && <div style={{ ...ajuda, marginBottom: '10px' }}>Carregando o fluxo de homologação…</div>}
      {aberto && motor && !carregandoFluxo && disponibilidade && !disponibilidade.ativo && (
        <Aviso tipo="alerta">
          Fluxo de homologação indisponível: {disponibilidade.motivo} Enquanto isso, o ciclo não muda de etapa.
        </Aviso>
      )}
      {!motor && aberto && <Aviso tipo="info">O fluxo de homologação não está disponível nesta tela.</Aviso>}

      {estado && motor && (
        <div style={{ marginBottom: '14px' }}>
          <PainelFluxoOrcamento
            estado={estado}
            dadosResponsaveis={motor.fluxo.dadosResponsaveis(estado.instancia)}
            vinculos={vinculos}
            usuarios={usuarios}
            podeAgir={podeAgir && aberto}
            processando={gravando === 'fluxo'}
            onExecutar={executarAcao}
            diagramaAberto={false}
            rotuloFluxo="Fluxo de homologação"
            textoConcluido="✓ Homologação concluída — fluxo encerrado"
            observacaoAcoes="Salve o checklist antes de enviar: as alterações não salvas do card não vão junto."
          />
          {aberto && !podeAgir && estado.instancia.status === 'emAndamento' && (
            <div style={{ ...ajuda, marginTop: '6px' }}>Você vê o andamento. Só quem responde a etapa atual age nela.</div>
          )}
        </div>
      )}

      {fluxoConcluidoSemGravar && (administra || podeAgir) && (
        <Aviso tipo="alerta" acao={<button type="button" style={botao('principal', !!gravando)} disabled={!!gravando} onClick={() => { gravarConclusao().catch(() => undefined); }}>{gravando === 'conclusao' ? 'Gravando…' : 'Gravar a conclusão'}</button>}>
          O fluxo foi concluído, mas o ciclo ainda não foi fechado no cadastro.
        </Aviso>
      )}

      <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: COR.texto2, margin: '6px 0' }}>Checklist do item 9</div>
      <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
          <thead>
            <tr>
              <th style={celulaCabecalho}>Verificação</th>
              {aberto && <th style={celulaCabecalho}>O que o sistema encontrou</th>}
              <th style={celulaCabecalho}>OK</th>
              <th style={celulaCabecalho}>Data</th>
              <th style={celulaCabecalho}>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {VERIFICACOES_HOMOLOGACAO.map(v => {
              const s = sugestoes[v.id];
              const marcada = d.verificacoes[v.id];
              return (
                <tr key={v.id}>
                  <td style={celula}>
                    <div style={{ fontWeight: 600 }}>{v.rotulo}</div>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>{v.fonte}</div>
                  </td>
                  {aberto && (
                    <td style={celula}>
                      <Selo tom={TOM[s.situacao]}>{ROTULO[s.situacao]}</Selo>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>{s.texto}</div>
                    </td>
                  )}
                  <td style={celula}>
                    <input type="checkbox" aria-label={`OK: ${v.rotulo}`} disabled={somenteLeitura} checked={!!marcada && marcada.ok} onChange={e => mudarVerificacao(v.id, e.target.checked)} />
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? (somenteLeitura
                        ? dataBr(marcada.data)
                        : <input type="date" aria-label={`Data: ${v.rotulo}`} style={{ ...campo, width: '150px' }} value={marcada.data}
                          onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, data: e.target.value } } })} />)
                      : '—'}
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? (somenteLeitura
                        ? (marcada.responsavel || '—')
                        : <input aria-label={`Responsável: ${v.rotulo}`} style={{ ...campo, minWidth: '160px' }} value={marcada.responsavel}
                          onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, responsavel: e.target.value } } })} />)
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px', fontSize: '13.5px' }}>
        <input type="checkbox" disabled={somenteLeitura} checked={d.bancarioConferido} onChange={e => mudar({ bancarioConferido: e.target.checked })} />
        Dados bancários confirmados por contato telefônico independente (número obtido fora da ficha)
      </label>

      {/* Resultado: definido pelo fluxo (Suprimentos e Jurídico) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 14px', fontSize: '13.5px', background: COR.fundo, borderRadius: '8px', padding: '10px 12px' }}>
        <div><span style={{ color: COR.texto2 }}>Classificação de risco: </span><strong>{ciclo.classificacaoRisco || '—'}</strong></div>
        <div><span style={{ color: COR.texto2 }}>Validade do cadastro: </span><strong>{ciclo.validadeCadastro ? dataBr(ciclo.validadeCadastro) : '—'}</strong></div>
        <div><span style={{ color: COR.texto2 }}>Resultado: </span><strong>{ciclo.resultadoHomologacao || 'Pendente'}</strong></div>
        <div><span style={{ color: COR.texto2 }}>Suprimentos: </span>{ciclo.responsavelSuprimentos || '—'}</div>
        <div><span style={{ color: COR.texto2 }}>Jurídico: </span>{ciclo.responsavelCompliance || '—'}</div>
        {ciclo.ressalvas && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: COR.texto2 }}>Ressalvas / parecer: </span>{ciclo.ressalvas}</div>}
        {aberto && <div style={{ ...ajuda, gridColumn: '1 / -1', margin: 0 }}>Risco e validade são preenchidos na etapa Análise Suprimentos; o resultado e as ressalvas, na decisão do Jurídico.</div>}
      </div>

      {podeEditarChecklist && (
        <>
          <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={!!gravando} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button type="button" style={botao('secundario', !!gravando)} disabled={!!gravando} onClick={() => { setD(dadosDoCiclo(ciclo, fornecedor)); setMotivo(''); }}>Desfazer</button>
            <button type="button" style={botao('principal', !!gravando || !motivo.trim())} disabled={!!gravando || !motivo.trim()}
              onClick={() => { salvarChecklist().catch(() => undefined); }}>
              {gravando === 'salvar' ? 'Salvando…' : 'Salvar checklist'}
            </button>
          </div>
          {!podeAgir && administra && <div style={{ ...ajuda, textAlign: 'right' }}>Edição como administrador do módulo (correção de dados). A etapa não muda.</div>}
        </>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Aba Homologação do fornecedor
// ------------------------------------------------------------

const HomologacaoFornecedorView: React.FC<{
  servico: FornecedoresService;
  motor?: IContextoFluxoHomologacao;
  fornecedor: IFornecedor;
  situacao: ISituacaoDocumental;
  aConferir: number;
  administra: boolean;
  usuarioNome: string;
  aoAlterar: (aviso?: string) => Promise<void>;
  irParaDocumentos?: () => void;
}> = ({ servico, motor, fornecedor, situacao, aConferir, administra, usuarioNome, aoAlterar, irParaDocumentos }) => {

  const [ciclos, setCiclos] = React.useState<ICicloHomologacao[] | undefined>(undefined);
  const [disponivel, setDisponivel] = React.useState(true);
  const [selecionado, setSelecionado] = React.useState<string>('');
  const [abrindo, setAbrindo] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const carregar = React.useCallback(async (): Promise<void> => {
    try {
      const r = await servico.listarCiclos(fornecedor.id);
      setDisponivel(r.disponivel);
      setCiclos(r.ciclos);
      setSelecionado(atual => {
        if (atual && r.ciclos.some(c => c.id === atual)) { return atual; }
        const aberto = cicloAberto(r.ciclos);
        return aberto ? aberto.id : (r.ciclos[0] ? r.ciclos[0].id : '');
      });
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id]);

  React.useEffect(() => {
    setCiclos(undefined);
    carregar().catch(() => undefined);
  }, [carregar]);

  const depoisDeAlterar = async (aviso?: string): Promise<void> => {
    await carregar();
    await aoAlterar(aviso);
  };

  if (!ciclos) {
    return erro ? <Aviso tipo="alerta">{erro}</Aviso> : <div style={{ padding: '20px', color: COR.texto2 }}>Carregando ciclos de homologação…</div>;
  }

  if (!disponivel) {
    return (
      <Aviso tipo="info">
        A tabela de ciclos de homologação ainda não existe no Dataverse. Rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.
      </Aviso>
    );
  }

  const aberto = cicloAberto(ciclos);
  const ciclo = ciclos.filter(c => c.id === selecionado)[0];
  const legadoConcluido = ciclos.length === 0 && resultadoConclusivo(fornecedor.resultadoHomologacao);
  const motivoSugerido = ciclos.length > 0
    ? 'Renovação da homologação'
    : (MOTIVOS_CICLO.indexOf(fornecedor.tipoSolicitacao) >= 0 ? fornecedor.tipoSolicitacao : 'Cadastro inicial');

  const cards: ICardQuadro[] = ciclos.map(c => ({
    ciclo: c,
    titulo: `Ciclo ${c.numero}`,
    subtitulo: [c.motivo, c.concluidoEm ? `concluído ${dataBr(c.concluidoEm)}` : ''].filter(Boolean).join(' · ')
  }));

  return (
    <div>
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: '220px', fontSize: '13px', color: COR.texto2 }}>
          {aberto
            ? `Ciclo ${aberto.numero} em andamento. A etapa muda só pelos botões do fluxo, com comentário.`
            : ciclos.length > 0 ? 'Nenhum ciclo em andamento.' : 'Nenhum ciclo de homologação registrado.'}
        </div>
        {administra && legadoConcluido && (
          <button type="button" style={botao('secundario')}
            onClick={() => {
              servico.registrarCicloAnterior(fornecedor, usuarioNome)
                .then(() => depoisDeAlterar('Homologação anterior registrada como ciclo 1.'))
                .catch(e => setErro(String((e as Error)?.message || e)));
            }}>
            Registrar a homologação atual como ciclo 1
          </button>
        )}
        {administra && !aberto && (
          <button type="button" style={botao('principal')} onClick={() => setAbrindo(true)}>Abrir ciclo</button>
        )}
      </div>

      {legadoConcluido && (
        <Aviso tipo="info">
          Este fornecedor foi homologado antes do kanban ({fornecedor.resultadoHomologacao}{fornecedor.validadeCadastro ? `, validade ${dataBr(fornecedor.validadeCadastro)}` : ''}).
          {administra ? ' Registre essa homologação como ciclo 1 para ela aparecer no histórico.' : ''}
        </Aviso>
      )}

      <QuadroKanban cards={cards} selecionado={selecionado} aoAbrir={c => setSelecionado(c.id)} />

      {ciclo && (
        <CardCiclo
          servico={servico}
          motor={motor}
          fornecedor={fornecedor}
          ciclo={ciclo}
          situacao={situacao}
          aConferir={aConferir}
          administra={administra}
          usuarioNome={usuarioNome}
          aoAlterar={depoisDeAlterar}
          irParaDocumentos={irParaDocumentos}
        />
      )}

      {abrindo && (
        <AbrirCicloModal
          motivoSugerido={motivoSugerido}
          fechar={() => setAbrindo(false)}
          confirmar={async motivo => {
            const id = await servico.iniciarCiclo(fornecedor, ciclos, motivo, usuarioNome);
            setAbrindo(false);
            setSelecionado(id);
            await depoisDeAlterar('Ciclo aberto na primeira etapa do fluxo.');
          }}
        />
      )}

      <div style={{ ...ajuda, marginTop: '12px' }}>O contrato é emitido só quando uma demanda fechar, assinado por Jurídico, Suprimentos, comprador e prestador. Contratos assinados ficam na aba Contratos.</div>
    </div>
  );
};

export default HomologacaoFornecedorView;
