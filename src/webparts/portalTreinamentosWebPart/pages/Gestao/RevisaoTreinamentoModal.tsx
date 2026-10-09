import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  IImpactoRevisao,
  IResultadoRevisao,
  IRevisaoTreinamento,
  TreinamentoRevisaoService,
  ehTabelaRevisaoInexistente,
  rotuloRevisao
} from '../../services/TreinamentoRevisaoService';

// ============================================================
// GESTÃO — REVISAR TREINAMENTO
//
// Fluxo recomendado:
//   1. "Editar" o treinamento (módulos, avaliação, textos).
//   2. "Revisar treinamento" → registrar a nova revisão:
//        motivo + o que mudou + exige retreinamento?
//          SIM → quem já concluiu ganha uma nova atribuição
//                (a conclusão anterior continua no histórico);
//          NÃO → as conclusões continuam válidas (justificativa).
//
// A aba "Histórico de revisões" mostra todas as revisões, com
// quem registrou, quando, motivo, decisão e impacto.
// ============================================================

export interface IRevisaoTreinamentoModalProps {
  treinamento?: {
    id: string;
    codigo: string;
    nome: string;
  };
  service: TreinamentoRevisaoService;
  responsavel: string;
  onEditar?: () => void;
  onFechar: () => void;
  onPublicada?: (revisao: IRevisaoTreinamento) => void;
}

type Aba = 'nova' | 'historico';

const COR = {
  azul: '#0B2D4D',
  azulBotao: '#0B5CAB',
  texto: '#334155',
  sec: '#64748B',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5',
  erro: '#B42318',
  erroClaro: '#FDECEA'
};

const botao: React.CSSProperties = {
  padding: '9px 15px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  border: `1px solid ${COR.borda}`,
  background: '#ffffff',
  color: COR.azul
};

const botaoPrimario: React.CSSProperties = {
  ...botao,
  border: 0,
  background: COR.azulBotao,
  color: '#ffffff'
};

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: COR.azul,
  marginBottom: 6
};

const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  border: `1px solid ${COR.borda}`,
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  color: COR.texto,
  resize: 'vertical'
};

const formatarData = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
};

const RevisaoTreinamentoModal: React.FC<IRevisaoTreinamentoModalProps> = ({
  treinamento,
  service,
  responsavel,
  onEditar,
  onFechar,
  onPublicada
}) => {

  const [aba, setAba] = React.useState<Aba>('nova');
  const [revisoes, setRevisoes] = React.useState<IRevisaoTreinamento[]>([]);
  const [impacto, setImpacto] = React.useState<IImpactoRevisao | undefined>(undefined);
  const [carregando, setCarregando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');
  const [tabelaFaltando, setTabelaFaltando] = React.useState<boolean>(false);

  const [motivo, setMotivo] = React.useState<string>('');
  const [alteracoes, setAlteracoes] = React.useState<string>('');
  const [retreinar, setRetreinar] = React.useState<boolean | undefined>(undefined);
  const [justificativa, setJustificativa] = React.useState<string>('');
  const [prazoDias, setPrazoDias] = React.useState<string>('30');
  const [verPessoas, setVerPessoas] = React.useState<boolean>(false);

  const [publicando, setPublicando] = React.useState<boolean>(false);
  const [progresso, setProgresso] = React.useState<string>('');
  const [resultado, setResultado] = React.useState<IResultadoRevisao | undefined>(undefined);

  // Abre / troca de treinamento: reinicia e carrega.
  React.useEffect(() => {

    if (!treinamento) {
      return undefined;
    }

    let ativo = true;

    setAba('nova');
    setMotivo('');
    setAlteracoes('');
    setRetreinar(undefined);
    setJustificativa('');
    setPrazoDias('30');
    setVerPessoas(false);
    setResultado(undefined);
    setErro('');
    setTabelaFaltando(false);
    setImpacto(undefined);
    setCarregando(true);

    Promise.all([
      service.listar(treinamento.id),
      service.analisarImpacto(treinamento.id)
    ])
      .then(([lista, analise]) => {
        if (ativo) {
          setRevisoes(lista);
          setImpacto(analise);
        }
      })
      .catch(falha => {
        if (!ativo) {
          return;
        }
        if (ehTabelaRevisaoInexistente(falha)) {
          setTabelaFaltando(true);
        } else {
          setErro(falha instanceof Error ? falha.message : 'Falha ao carregar as revisões.');
        }
      })
      .then(() => {
        if (ativo) {
          setCarregando(false);
        }
      })
      .catch(() => undefined);

    return () => {
      ativo = false;
    };
  }, [treinamento, service]);

  // Esc fecha (exceto durante a publicação).
  React.useEffect(() => {
    if (!treinamento) {
      return undefined;
    }
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape' && !publicando) {
        onFechar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [treinamento, publicando, onFechar]);

  if (!treinamento) {
    return null;
  }

  const atual = revisoes.length > 0 ? revisoes[0].numero : 0;
  const proxima = rotuloRevisao(atual + 1);
  const totalConcluidos = impacto ? impacto.concluidos.length : 0;

  const podePublicar =
    !carregando &&
    !publicando &&
    !tabelaFaltando &&
    motivo.trim().length >= 5 &&
    alteracoes.trim().length >= 5 &&
    retreinar !== undefined &&
    (retreinar ? true : justificativa.trim().length >= 5);

  const publicar = (): void => {

    if (!podePublicar || retreinar === undefined) {
      return;
    }

    if (
      retreinar &&
      totalConcluidos > 0 &&
      !window.confirm(
        `Confirmar a ${proxima} com RETREINAMENTO?\n\n` +
        `${totalConcluidos} colaborador(es) que já concluíram receberão uma nova atribuição. ` +
        'As conclusões e certificados anteriores continuam no histórico.'
      )
    ) {
      return;
    }

    setPublicando(true);
    setErro('');
    setProgresso('');

    const dias = parseInt(prazoDias, 10);

    service.publicar(
      {
        treinamentoId: treinamento.id,
        treinamentoCodigo: treinamento.codigo,
        motivo,
        alteracoes,
        requerRetreinamento: retreinar,
        justificativa,
        prazoDias: retreinar && !isNaN(dias) && dias > 0 ? dias : undefined,
        responsavel
      },
      setProgresso
    )
      .then(final => {
        setResultado(final);
        setRevisoes(lista => [final.revisao].concat(lista));
        if (onPublicada) {
          onPublicada(final.revisao);
        }
      })
      .catch(falha => {
        setErro(falha instanceof Error ? falha.message : 'Não foi possível registrar a revisão.');
      })
      .then(() => {
        setPublicando(false);
        setProgresso('');
      })
      .catch(() => undefined);
  };

  const opcao = (valor: boolean): React.CSSProperties => {
    const ativa = retreinar === valor;
    return {
      ...botao,
      flex: '1 1 220px',
      textAlign: 'left',
      padding: '12px 14px',
      border: `2px solid ${ativa ? (valor ? COR.ambar : COR.verde) : COR.borda}`,
      background: ativa ? (valor ? COR.ambarClaro : COR.verdeClaro) : '#ffffff'
    };
  };

  // ----------------------------------------------------------
  // Conteúdo: nova revisão
  // ----------------------------------------------------------

  const renderNova = (): React.ReactNode => {

    if (resultado) {
      return (
        <div>
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: COR.verdeClaro,
              border: `1px solid ${COR.verde}`,
              color: COR.azul,
              fontSize: 13,
              lineHeight: 1.6
            }}
          >
            <strong style={{ fontSize: 15 }}>✓ {resultado.revisao.rotulo} registrada.</strong>
            <br />
            {resultado.revisao.requerRetreinamento
              ? (
                <>
                  Retreinamento: <strong>{resultado.criados}</strong> nova(s) atribuição(ões)
                  {resultado.jaExistiam > 0 ? `, ${resultado.jaExistiam} já existia(m)` : ''}
                  {' '}de {resultado.impactados} colaborador(es) que já tinham concluído.
                  As conclusões e certificados anteriores continuam no histórico.
                </>
              )
              : 'Sem retreinamento: as conclusões existentes continuam válidas. Novos colaboradores já fazem a nova revisão.'}
          </div>

          {resultado.falhas.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 8,
                background: COR.erroClaro,
                color: COR.erro,
                fontSize: 12
              }}
            >
              <strong>Falhas ({resultado.falhas.length}):</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {resultado.falhas.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" style={botao} onClick={() => setAba('historico')}>
              Ver histórico de revisões
            </button>
            <button type="button" style={botaoPrimario} onClick={onFechar}>
              Concluir
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: COR.fundo,
            border: `1px solid ${COR.borda}`,
            fontSize: 12.5,
            color: COR.texto,
            lineHeight: 1.6,
            marginBottom: 18
          }}
        >
          <strong style={{ color: COR.azul }}>Revisão atual: {rotuloRevisao(atual)} → nova: {proxima}</strong>
          <br />
          1. Faça os ajustes do conteúdo em <strong>Editar</strong> (módulos, avaliação, textos).
          {' '}2. Registre aqui a revisão. Quem já concluiu <strong>mantém</strong> a conclusão e o certificado.
          {onEditar && (
            <>
              {' '}
              <button
                type="button"
                onClick={onEditar}
                style={{ ...botao, padding: '3px 10px', fontSize: 12, marginLeft: 4 }}
              >
                Abrir edição ↗
              </button>
            </>
          )}
        </div>

        <label style={rotulo} htmlFor="rev-motivo">Motivo da revisão *</label>
        <input
          id="rev-motivo"
          style={campo}
          value={motivo}
          maxLength={500}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ex.: atualização do POP CPU-POP-002 para a Rev.03"
          disabled={publicando}
        />

        <label style={{ ...rotulo, marginTop: 14 }} htmlFor="rev-alteracoes">O que mudou no treinamento *</label>
        <textarea
          id="rev-alteracoes"
          style={campo}
          rows={4}
          value={alteracoes}
          maxLength={4000}
          onChange={e => setAlteracoes(e.target.value)}
          placeholder="Ex.: novo passo 14 no Módulo 3; 4 questões novas na avaliação; ajuste no glossário."
          disabled={publicando}
        />

        <span style={{ ...rotulo, marginTop: 16 }}>Esta revisão exige retreinamento? *</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={opcao(true)}
            aria-pressed={retreinar === true}
            onClick={() => setRetreinar(true)}
            disabled={publicando}
          >
            ↻ Sim, retreinar
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: COR.sec, marginTop: 3 }}>
              {carregando
                ? 'Calculando impacto…'
                : `${totalConcluidos} colaborador(es) que já concluíram receberão uma nova atribuição.`}
            </span>
          </button>
          <button
            type="button"
            style={opcao(false)}
            aria-pressed={retreinar === false}
            onClick={() => setRetreinar(false)}
            disabled={publicando}
          >
            ✓ Não, manter conclusões
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: COR.sec, marginTop: 3 }}>
              Conclusões e certificados continuam válidos. Novos colaboradores fazem a nova revisão.
            </span>
          </button>
        </div>

        {impacto && impacto.emAndamento > 0 && (
          <p style={{ fontSize: 11.5, color: COR.sec, margin: '8px 0 0' }}>
            {impacto.emAndamento} colaborador(es) estão com o treinamento em aberto e já farão o conteúdo revisado.
          </p>
        )}

        {retreinar === true && (
          <div style={{ marginTop: 14 }}>
            <label style={rotulo} htmlFor="rev-prazo">Prazo para o retreinamento (dias)</label>
            <input
              id="rev-prazo"
              type="number"
              min={1}
              max={365}
              style={{ ...campo, width: 140 }}
              value={prazoDias}
              onChange={e => setPrazoDias(e.target.value)}
              disabled={publicando}
            />

            {totalConcluidos > 0 && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setVerPessoas(!verPessoas)}
                  style={{ ...botao, padding: '4px 10px', fontSize: 12 }}
                >
                  {verPessoas ? '▾ Ocultar colaboradores' : `▸ Ver os ${totalConcluidos} colaborador(es)`}
                </button>
                {verPessoas && impacto && (
                  <ul
                    style={{
                      margin: '8px 0 0',
                      padding: '8px 12px 8px 28px',
                      maxHeight: 160,
                      overflowY: 'auto',
                      border: `1px solid ${COR.borda}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: COR.texto
                    }}
                  >
                    {impacto.concluidos.map(p => (
                      <li key={p.usuarioId}>
                        {p.nome}
                        <span style={{ color: COR.sec }}> · concluiu em {formatarData(p.dataConclusao)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {retreinar === false && (
          <div style={{ marginTop: 14 }}>
            <label style={rotulo} htmlFor="rev-justificativa">
              Justificativa para não retreinar *
            </label>
            <textarea
              id="rev-justificativa"
              style={campo}
              rows={3}
              value={justificativa}
              maxLength={4000}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Ex.: ajustes de redação e layout, sem mudança de procedimento."
              disabled={publicando}
            />
          </div>
        )}

        {erro && (
          <p
            role="alert"
            style={{
              margin: '14px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: COR.erroClaro,
              color: COR.erro,
              fontSize: 12.5
            }}
          >
            ! {erro}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 18 }}>
          {progresso && <span style={{ fontSize: 12, color: COR.sec, marginRight: 'auto' }}>{progresso}</span>}
          <button type="button" style={botao} onClick={onFechar} disabled={publicando}>
            Cancelar
          </button>
          <button
            type="button"
            style={{ ...botaoPrimario, opacity: podePublicar ? 1 : 0.5, cursor: podePublicar ? 'pointer' : 'not-allowed' }}
            onClick={publicar}
            disabled={!podePublicar}
          >
            {publicando ? 'Registrando…' : `Registrar ${proxima}`}
          </button>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------
  // Conteúdo: histórico
  // ----------------------------------------------------------

  const renderHistorico = (): React.ReactNode => {

    if (carregando) {
      return <p style={{ fontSize: 13, color: COR.sec }}>Carregando…</p>;
    }

    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {revisoes.map(r => (
          <li
            key={r.id}
            style={{
              padding: '12px 14px',
              border: `1px solid ${COR.borda}`,
              borderLeft: `4px solid ${r.requerRetreinamento ? COR.ambar : COR.verde}`,
              borderRadius: 8,
              marginBottom: 8
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: COR.azul, fontSize: 14 }}>{r.rotulo}</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: r.requerRetreinamento ? COR.ambarClaro : COR.verdeClaro,
                  color: r.requerRetreinamento ? COR.ambar : COR.verde
                }}
              >
                {r.requerRetreinamento
                  ? `↻ Retreinamento${r.atribuicoesCriadas !== undefined ? ` · ${r.atribuicoesCriadas} atribuição(ões)` : ''}`
                  : '✓ Sem retreinamento'}
              </span>
              <span style={{ fontSize: 11.5, color: COR.sec, marginLeft: 'auto' }}>
                {r.responsavel} · {formatarData(r.vigencia)}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: COR.texto }}>
              <strong>Motivo:</strong> {r.motivo}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: COR.texto, whiteSpace: 'pre-wrap' }}>
              <strong>Alterações:</strong> {r.alteracoes}
            </p>
            {!r.requerRetreinamento && r.justificativa && (
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: COR.texto }}>
                <strong>Justificativa:</strong> {r.justificativa}
              </p>
            )}
          </li>
        ))}

        <li
          style={{
            padding: '10px 14px',
            border: `1px dashed ${COR.borda}`,
            borderRadius: 8,
            fontSize: 12.5,
            color: COR.sec
          }}
        >
          <strong style={{ color: COR.azul }}>Rev.00</strong> · versão original do treinamento
        </li>
      </ul>
    );
  };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Revisar treinamento ${treinamento.codigo}`}
      onClick={() => { if (!publicando) { onFechar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: 'rgba(11,45,77,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'Segoe UI', Arial, sans-serif"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,.3)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ padding: '18px 22px 0', borderBottom: `1px solid ${COR.borda}` }}>
          <span style={{ fontSize: 12, color: COR.sec }}>{treinamento.codigo}</span>
          <h2 style={{ margin: '2px 0 12px', fontSize: 18, color: COR.azul }}>
            Revisar treinamento — {treinamento.nome}
          </h2>
          <div style={{ display: 'flex', gap: 4 }} role="tablist">
            {([
              ['nova', 'Nova revisão'],
              ['historico', `Histórico de revisões (${revisoes.length + 1})`]
            ] as Array<[Aba, string]>).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                style={{
                  padding: '9px 14px',
                  border: 0,
                  borderBottom: `3px solid ${aba === id ? COR.azulBotao : 'transparent'}`,
                  background: 'transparent',
                  color: aba === id ? COR.azul : COR.sec,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: -1
                }}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 22 }}>
          {tabelaFaltando
            ? (
              <p
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 8,
                  background: COR.ambarClaro,
                  color: COR.azul,
                  fontSize: 13,
                  lineHeight: 1.6
                }}
              >
                A tabela de revisões ainda não existe no Dataverse. Execute o script
                {' '}<code>scripts\dataverse\criar-tabela-revisoes-treinamento.ps1</code> e reabra esta tela.
              </p>
            )
            : aba === 'nova'
              ? renderNova()
              : renderHistorico()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RevisaoTreinamentoModal;
