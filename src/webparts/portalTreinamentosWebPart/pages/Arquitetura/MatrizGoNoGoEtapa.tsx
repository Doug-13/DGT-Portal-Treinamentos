import * as React from 'react';

import {
  IAnaliseGoNoGo,
  ICriterioGoNoGo
} from '../../services/bom/BomService';

import {
  LIMITE_GO,
  LIMITE_GO_COM_RESTRICAO,
  calcularPontuacao,
  decisaoPorPontuacao,
  liberaSelecaoKit
} from '../../services/bom/esquemaBom';

import {
  COR,
  DECISAO,
  Selo,
  botao,
  campo,
  cartao,
  formatarNumero
} from './arquiteturaComum';

// ============================================================
// ETAPA 2 — MATRIZ GO/NO-GO
//
// Nota de 1 a 5 por critério; pontuação ponderada de 0 a 100.
//   80 ou mais → GO · 60 a 79 → GO com restrição · abaixo → NO-GO
// GO libera a seleção de kit; GO com restrição libera quando o
// parecer descreve as restrições. Cada "Registrar análise" cria
// um registro novo (o histórico nunca é alterado).
// ============================================================

export interface IMatrizGoNoGoEtapaProps {
  criterios: ICriterioGoNoGo[];
  analises: IAnaliseGoNoGo[];
  salvando: boolean;
  onRegistrar: (
    notas: { [criterioId: string]: number },
    justificativas: { [criterioId: string]: string },
    parecer: string
  ) => Promise<void>;
}

const ESCALA = [
  'Muito desfavorável / alto risco',
  'Desfavorável',
  'Aceitável',
  'Favorável',
  'Muito favorável'
];

const formatarDataHora = (valor: string): string => {
  const data = new Date(valor);
  return isNaN(data.getTime())
    ? '—'
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const MatrizGoNoGoEtapa: React.FC<IMatrizGoNoGoEtapaProps> = ({
  criterios,
  analises,
  salvando,
  onRegistrar
}) => {

  const ativos = criterios.filter(item => item.ativo);
  const ultima = analises[0];

  const notasIniciais = (): { [id: string]: number } => {
    const mapa: { [id: string]: number } = {};
    ativos.forEach(criterio => {
      const anterior = ultima ? ultima.notas.find(nota => nota.criterioId === criterio.id) : undefined;
      mapa[criterio.id] = anterior ? anterior.nota : 3;
    });
    return mapa;
  };

  const [notas, setNotas] = React.useState<{ [id: string]: number }>(notasIniciais);
  const [justificativas, setJustificativas] = React.useState<{ [id: string]: string }>({});
  const [parecer, setParecer] = React.useState<string>(ultima ? ultima.parecer : '');
  const [verHistorico, setVerHistorico] = React.useState<string>('');

  React.useEffect(() => {
    setNotas(notasIniciais());
    setParecer(ultima ? ultima.parecer : '');
    setJustificativas({});
  }, [criterios, analises]);

  const somaPesos =
    Math.round(ativos.reduce((soma, item) => soma + item.peso, 0) * 100) / 100;

  const pontuacao =
    calcularPontuacao(ativos.map(item => ({ nota: notas[item.id] || 3, peso: item.peso })));

  const decisao = decisaoPorPontuacao(pontuacao);
  const libera = liberaSelecaoKit(decisao, parecer);
  const exigeParecer = decisao === 'GO com restrição' && !parecer.trim();
  const pesosValidos = Math.abs(somaPesos - 100) < 0.01;

  // Critérios que mais tiram pontos (para orientar o parecer).
  const perdas =
    ativos
      .map(item => ({ nome: item.nome, perda: (5 - (notas[item.id] || 3)) * item.peso * 0.2 }))
      .filter(item => item.perda > 0)
      .sort((a, b) => b.perda - a.perda)
      .slice(0, 3);

  const registrar = (): void => {
    if (!pesosValidos || salvando) {
      return;
    }
    onRegistrar(notas, justificativas, parecer).catch(() => undefined);
  };

  const estiloDecisao = DECISAO[decisao];

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: COR.texto2 }}>
        Nota de 1 a 5 por critério. A pontuação ponderada vai de 0 a 100: <strong>{LIMITE_GO} ou mais é GO</strong>,
        de {LIMITE_GO_COM_RESTRICAO} a {LIMITE_GO - 1} é <strong>GO com restrição</strong> e abaixo de {LIMITE_GO_COM_RESTRICAO} é <strong>NO-GO</strong>.
      </p>

      {
        !pesosValidos && (
          <div role="alert" style={{ ...cartao, background: '#FDE7E9', borderColor: '#B42318', fontSize: '13px' }}>
            Os pesos dos critérios ativos somam <strong>{formatarNumero(somaPesos)}%</strong>. Eles precisam somar 100% para registrar uma análise.
            Ajuste a tabela <strong>Critério Go/No-Go</strong> no Dataverse.
          </div>
        )
      }

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '16px', alignItems: 'start' }}>

        {/* Critérios */}
        <div style={{ ...cartao, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Critério', 'Nota', 'Peso', 'Pontos'].map(coluna => (
                  <th key={coluna} style={{ textAlign: coluna === 'Critério' ? 'left' : 'center', padding: '10px 12px', fontSize: '12px', color: COR.texto2, background: '#F8FAFC', borderBottom: `1px solid ${COR.borda}` }}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {
                ativos.map(criterio => {
                  const nota = notas[criterio.id] || 3;
                  return (
                    <tr key={criterio.id}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', fontSize: '13.5px', color: COR.azul }}>{criterio.nome}</strong>
                        <span style={{ fontSize: '12px', color: COR.texto2 }}>{criterio.descricao}</span>
                        <input
                          aria-label={`Justificativa de ${criterio.nome}`}
                          style={{ ...campo, marginTop: '6px', padding: '5px 8px', fontSize: '12px' }}
                          placeholder="Justificativa (opcional)"
                          value={justificativas[criterio.id] || ''}
                          onChange={e => setJustificativas({ ...justificativas, [criterio.id]: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          {
                            [1, 2, 3, 4, 5].map(valor => (
                              <button
                                key={valor}
                                type="button"
                                aria-label={`Nota ${valor}`}
                                aria-pressed={nota === valor}
                                onClick={() => setNotas({ ...notas, [criterio.id]: valor })}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700,
                                  border: `1px solid ${nota === valor ? COR.azul : COR.borda}`,
                                  background: nota === valor ? COR.azul : '#FFFFFF',
                                  color: nota === valor ? '#FFFFFF' : COR.azul
                                }}
                              >
                                {valor}
                              </button>
                            ))
                          }
                        </div>
                        <div style={{ fontSize: '11px', color: COR.texto2, marginTop: '4px' }}>{ESCALA[nota - 1]}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', fontSize: '13px' }}>
                        {formatarNumero(criterio.peso)}%
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${COR.borda}`, textAlign: 'center', verticalAlign: 'top', fontSize: '13px', fontWeight: 700 }}>
                        {formatarNumero(nota * criterio.peso * 0.2)} / {formatarNumero(criterio.peso)}
                      </td>
                    </tr>
                  );
                })
              }
              <tr>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total</td>
                <td style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>{formatarNumero(pontuacao)} / 100</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resultado */}
        <div>
          <div style={{ ...cartao, borderTop: `4px solid ${estiloDecisao.cor}` }}>
            <span style={{ fontSize: '12px', color: COR.texto2 }}>Pontuação</span>
            <div style={{ fontSize: '34px', fontWeight: 800, color: COR.azul }}>{formatarNumero(pontuacao)}<span style={{ fontSize: '15px', color: COR.texto2 }}> / 100</span></div>
            <Selo {...estiloDecisao} />

            <div style={{ position: 'relative', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #FDE7E9 0 60%, #FFF4E5 60% 80%, #E7F6EC 80% 100%)', margin: '14px 0 4px' }}>
              <div style={{ position: 'absolute', left: `calc(${Math.min(100, pontuacao)}% - 6px)`, top: '-3px', width: '12px', height: '14px', borderRadius: '3px', background: COR.azul }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COR.texto2 }}>
              <span>0</span><span>{LIMITE_GO_COM_RESTRICAO}</span><span>{LIMITE_GO}</span><span>100</span>
            </div>

            {
              perdas.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: COR.texto2 }}>
                  Mais pesam contra: {perdas.map(item => `${item.nome} (−${formatarNumero(item.perda)})`).join(' · ')}
                </div>
              )
            }

            <label htmlFor="go-parecer" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: COR.azul, margin: '14px 0 5px' }}>
              Parecer {decisao === 'GO com restrição' ? <span style={{ color: '#B42318' }}>* obrigatório para GO com restrição</span> : ''}
            </label>
            <textarea
              id="go-parecer"
              rows={4}
              style={{ ...campo, resize: 'vertical', ...(exigeParecer ? { borderColor: '#B45309' } : {}) }}
              placeholder={decisao === 'GO com restrição' ? 'Descreva as restrições e condições para seguir…' : 'Observações da análise…'}
              value={parecer}
              onChange={e => setParecer(e.target.value)}
            />

            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', background: libera ? '#E7F6EC' : '#F1F5F9', color: COR.azul }}>
              {
                libera
                  ? '✓ Ao registrar, a seleção de kit fica liberada.'
                  : exigeParecer
                    ? '! Preencha o parecer para liberar a seleção de kit.'
                    : '🔒 Com esta pontuação, a seleção de kit fica bloqueada.'
              }
            </div>

            <button type="button" style={{ ...botao('principal', salvando || !pesosValidos), width: '100%', marginTop: '12px' }} disabled={salvando || !pesosValidos} onClick={registrar}>
              {salvando ? 'Registrando…' : 'Registrar análise'}
            </button>
          </div>
        </div>
      </div>

      {/* Histórico das análises */}
      <div style={cartao}>
        <h3 style={{ margin: '0 0 10px', fontSize: '15px', color: COR.azul }}>Análises registradas ({analises.length})</h3>
        {
          analises.length === 0
            ? <p style={{ margin: 0, fontSize: '13px', color: COR.texto2 }}>Nenhuma análise registrada ainda.</p>
            : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {
                  analises.map((analise, indice) => (
                    <li key={analise.id} style={{ padding: '10px 0 10px 12px', borderBottom: `1px solid ${COR.borda}`, borderLeft: `4px solid ${DECISAO[analise.decisao].cor}` }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12.5px' }}>
                        <strong>{formatarDataHora(analise.data)}</strong>
                        <Selo {...DECISAO[analise.decisao]} />
                        <span>{formatarNumero(analise.pontuacao)} pontos</span>
                        {indice === 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: COR.texto2 }}>VÁLIDA</span>}
                        <span style={{ flex: 1 }} />
                        <button type="button" style={botao('secundario')} onClick={() => setVerHistorico(verHistorico === analise.id ? '' : analise.id)}>
                          {verHistorico === analise.id ? 'Ocultar notas' : 'Ver notas'}
                        </button>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#334155' }}>Executado por <strong>{analise.avaliadorNome}</strong></div>
                      {analise.parecer && <div style={{ marginTop: '6px', padding: '6px 10px', background: '#F2F2F2', borderLeft: '3px solid #05C3DD', borderRadius: '4px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{analise.parecer}</div>}
                      {
                        verHistorico === analise.id && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '12.5px' }}>
                            <tbody>
                              {analise.notas.map(nota => (
                                <tr key={nota.criterioId}>
                                  <td style={{ padding: '4px 0' }}>{nota.criterioNome}{nota.justificativa ? <span style={{ color: COR.texto2 }}> — {nota.justificativa}</span> : ''}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>nota {nota.nota}</td>
                                  <td style={{ padding: '4px 0', textAlign: 'right' }}>{formatarNumero(nota.pontos)} / {formatarNumero(nota.peso)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      }
                    </li>
                  ))
                }
              </ol>
            )
        }
      </div>
    </div>
  );
};

export default MatrizGoNoGoEtapa;
